import { isOpen, isOverdue } from '../../domain/delay';
import { isValidColor, isValidPrefix, normalizePrefix, type SeriesDraft } from '../../domain/series';
import { isValidRecurrence } from '../../domain/recurrence';
import type { ISODate } from '../../lib/dates';
import { db, newId, type AppDB } from '../schema';
import type { ID, Series } from '../types';

export type SeriesError = 'name' | 'prefix' | 'recurrence' | 'colors';

export function validateSeries(draft: SeriesDraft): SeriesError[] {
  const errors: SeriesError[] = [];
  if (!draft.name.trim()) errors.push('name');
  if (!isValidPrefix(normalizePrefix(draft.taskPrefix))) errors.push('prefix');
  if (!isValidRecurrence(draft.recurrence)) errors.push('recurrence');
  if (!isValidColor(draft.colors.primary) || !isValidColor(draft.colors.secondary)) errors.push('colors');
  return errors;
}

function cleanDraft(draft: SeriesDraft): SeriesDraft {
  return {
    ...draft,
    name: draft.name.trim(),
    taskPrefix: normalizePrefix(draft.taskPrefix),
    recurrence: draft.recurrence.kind === 'custom' ? draft.recurrence : { kind: draft.recurrence.kind },
    memberIds: [...new Set(draft.memberIds)],
    defaultTopics: draft.defaultTopics.map((t) => t.trim()).filter(Boolean),
    registerName: draft.registerName.trim(),
  };
}

export async function createSeries(draft: SeriesDraft, d: AppDB = db): Promise<Series> {
  const errors = validateSeries(draft);
  if (errors.length) throw new Error(`Invalid series: ${errors.join(', ')}`);
  const now = Date.now();
  const s: Series = {
    ...cleanDraft(draft),
    id: newId(),
    taskCounter: 0,
    meetingCounter: 0,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  await d.series.add(s);
  return s;
}

/** التعديل مبيلمسش العدادات — أرقام المهام والاجتماعات القديمة ثابتة. */
export async function updateSeries(id: ID, draft: SeriesDraft, d: AppDB = db): Promise<void> {
  const errors = validateSeries(draft);
  if (errors.length) throw new Error(`Invalid series: ${errors.join(', ')}`);
  await d.series.update(id, { ...cleanDraft(draft), updatedAt: Date.now() });
}

export async function setSeriesArchived(id: ID, archived: boolean, d: AppDB = db): Promise<void> {
  await d.series.update(id, { archived, updatedAt: Date.now() });
}

/** حذف السلسلة مسموح بس لو مفيهاش اجتماعات ولا مهام. غير كده تتأرشف. */
export async function canDeleteSeries(id: ID, d: AppDB = db): Promise<boolean> {
  const [m, t] = await Promise.all([
    d.meetings.where('seriesId').equals(id).count(),
    d.tasks.where('seriesId').equals(id).count(),
  ]);
  return m + t === 0;
}

export async function deleteSeries(id: ID, d: AppDB = db): Promise<void> {
  await d.transaction('rw', [d.series, d.meetings, d.tasks, d.registerItems], async () => {
    if (!(await canDeleteSeries(id, d))) throw new Error('Series has meetings or tasks');
    await d.registerItems.where('seriesId').equals(id).delete();
    await d.series.delete(id);
  });
}

export async function seriesUsesPrefix(prefix: string, exceptId: ID | undefined, d: AppDB = db): Promise<boolean> {
  const p = normalizePrefix(prefix);
  return (await d.series.filter((s) => s.taskPrefix === p && s.id !== exceptId).count()) > 0;
}

export interface SeriesSummary {
  series: Series;
  openTasks: number;
  overdueTasks: number;
  /** آخر اجتماع ← nextDate، أو تاريخ أول اجتماع لو لسه مفيش اجتماعات */
  nextMeeting?: ISODate;
  meetingsCount: number;
}

export async function listSeriesSummaries(today: ISODate, d: AppDB = db): Promise<SeriesSummary[]> {
  const all = await d.series.toArray();
  const result = await Promise.all(
    all.map(async (s): Promise<SeriesSummary> => {
      const tasks = await d.tasks.where('seriesId').equals(s.id).toArray();
      const meetings = await d.meetings.where('seriesId').equals(s.id).sortBy('number');
      const last = meetings[meetings.length - 1];
      return {
        series: s,
        openTasks: tasks.filter(isOpen).length,
        overdueTasks: tasks.filter((t) => isOverdue(t, today)).length,
        nextMeeting: last ? last.nextDate : s.firstMeetingDate,
        meetingsCount: meetings.length,
      };
    }),
  );
  return result.sort((a, b) => Number(a.series.archived) - Number(b.series.archived) || a.series.createdAt - b.series.createdAt);
}

export interface SeriesContents {
  meetings: number;
  tasks: number;
  decisions: number;
  register: number;
}

/** محتوى السلسلة (للعرض قبل الحذف النهائي). */
export async function seriesContents(id: ID, d: AppDB = db): Promise<SeriesContents> {
  const meetingIds = (await d.meetings.where('seriesId').equals(id).primaryKeys()) as ID[];
  const [tasks, register, decisions] = await Promise.all([
    d.tasks.where('seriesId').equals(id).count(),
    d.registerItems.where('seriesId').equals(id).count(),
    meetingIds.length ? d.decisions.where('meetingId').anyOf(meetingIds).count() : Promise.resolve(0),
  ]);
  return { meetings: meetingIds.length, tasks, decisions, register };
}

/**
 * حذف سلسلة نهائياً بكل اللي فيها (اجتماعات، حضور، قرارات، مهام وسجلها، السجل التراكمي).
 * مسموح للسلسلة المؤرشفة بس. الأشخاص في الدليل مبيتمسحوش.
 */
export async function deleteSeriesFully(id: ID, d: AppDB = db): Promise<void> {
  await d.transaction('rw', [d.series, d.meetings, d.attendance, d.decisions, d.tasks, d.taskUpdates, d.registerItems], async () => {
    const s = await d.series.get(id);
    if (!s) return;
    if (!s.archived) throw new Error('Archive the series first');
    const meetingIds = (await d.meetings.where('seriesId').equals(id).primaryKeys()) as ID[];
    const taskIds = (await d.tasks.where('seriesId').equals(id).primaryKeys()) as ID[];
    if (meetingIds.length) {
      await d.attendance.where('meetingId').anyOf(meetingIds).delete();
      await d.decisions.where('meetingId').anyOf(meetingIds).delete();
      await d.taskUpdates.where('meetingId').anyOf(meetingIds).delete();
    }
    if (taskIds.length) await d.taskUpdates.where('taskId').anyOf(taskIds).delete();
    await d.tasks.where('seriesId').equals(id).delete();
    await d.registerItems.where('seriesId').equals(id).delete();
    await d.meetings.where('seriesId').equals(id).delete();
    await d.series.delete(id);
  });
}
