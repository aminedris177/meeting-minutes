// الاجتماعات: الإنشاء بترقيم تلقائي، الحضور والضيوف، المراجعة، القرارات، السجل التراكمي، والإنهاء.
import { delayDays, isOpen } from '../../domain/delay';
import { nextMeetingDate } from '../../domain/recurrence';
import type { ISODate } from '../../lib/dates';
import { db, newId, type AppDB } from '../schema';
import type {
  Attendance,
  Decision,
  ID,
  Meeting,
  MinutesModel,
  RegisterItem,
  RegisterStatus,
  Series,
  Task,
  TaskUpdate,
} from '../types';
import { compareTaskRows, type TaskRow } from './tasks';
import { displayName } from './people';

let lastStamp = 0;
const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));

/** الاجتماع القادم للسلسلة: nextDate لآخر اجتماع، أو تاريخ أول اجتماع لو لسه مفيش. */
export async function seriesNextDate(series: Series, d: AppDB = db): Promise<ISODate | undefined> {
  const meetings = await d.meetings.where('seriesId').equals(series.id).sortBy('number');
  const last = meetings[meetings.length - 1];
  return last ? last.nextDate : series.firstMeetingDate;
}

export async function getDraft(seriesId: ID, d: AppDB = db): Promise<Meeting | undefined> {
  const all = await d.meetings.where('seriesId').equals(seriesId).toArray();
  return all.filter((m) => m.status === 'draft').sort((a, b) => b.number - a.number)[0];
}

/**
 * اجتماع جديد:
 * - الرقم = عدّاد السلسلة + 1 (في transaction).
 * - التاريخ = الاجتماع القادم المتوقع للسلسلة، أو النهارده.
 * - الاجتماع القادم بيتحسب من التكرار.
 * - المحاور = المحاور الافتراضية، والحضور = الحضور الثابت (كلهم حاضرين مبدئياً — اللمسة بتعلّم الغياب).
 */
export async function createMeeting(seriesId: ID, today: ISODate, d: AppDB = db): Promise<Meeting> {
  return d.transaction('rw', [d.series, d.meetings, d.attendance, d.people], async () => {
    const series = await d.series.get(seriesId);
    if (!series) throw new Error('Series not found');
    const date = (await seriesNextDate(series, d)) ?? today;
    const number = series.meetingCounter + 1;
    const now = Date.now();
    const m: Meeting = {
      id: newId(),
      seriesId,
      number,
      date,
      nextDate: nextMeetingDate(date, series.recurrence),
      nextDateManual: false,
      topics: [...series.defaultTopics],
      status: 'draft',
      notes: '',
      createdAt: now,
      updatedAt: now,
    };
    await d.meetings.add(m);
    await d.series.update(seriesId, { meetingCounter: number, updatedAt: now });
    const people = await d.people.bulkGet(series.memberIds);
    const rows: Attendance[] = series.memberIds
      .filter((_, i) => people[i]?.active !== false)
      .map((personId, order) => ({ id: newId(), meetingId: m.id, personId, present: true, order }));
    await d.attendance.bulkAdd(rows);
    return m;
  });
}

export type MeetingPatch = Partial<Pick<Meeting, 'date' | 'topics' | 'notes'>>;

/** تعديل البيانات. تغيير التاريخ بيعيد حساب الاجتماع القادم، إلا لو اتعدّل يدوي. */
export async function updateMeeting(id: ID, patch: MeetingPatch, d: AppDB = db): Promise<void> {
  await d.transaction('rw', d.meetings, d.series, async () => {
    const m = await d.meetings.get(id);
    if (!m) throw new Error('Meeting not found');
    const next: Partial<Meeting> = { ...patch, updatedAt: Date.now() };
    if (patch.date && patch.date !== m.date && !m.nextDateManual) {
      const series = await d.series.get(m.seriesId);
      if (series) next.nextDate = nextMeetingDate(patch.date, series.recurrence);
    }
    await d.meetings.update(id, next);
  });
}

/** الاجتماع القادم يدوي. undefined = ارجع للحساب التلقائي من التكرار. */
export async function setNextDate(id: ID, date: ISODate | undefined, d: AppDB = db): Promise<void> {
  await d.transaction('rw', d.meetings, d.series, async () => {
    const m = await d.meetings.get(id);
    if (!m) throw new Error('Meeting not found');
    if (date) {
      await d.meetings.update(id, { nextDate: date, nextDateManual: true, updatedAt: Date.now() });
    } else {
      const series = await d.series.get(m.seriesId);
      await d.meetings.update(id, {
        nextDate: series ? nextMeetingDate(m.date, series.recurrence) : undefined,
        nextDateManual: false,
        updatedAt: Date.now(),
      });
    }
  });
}

// ===== الحضور =====

export async function listAttendance(meetingId: ID, d: AppDB = db): Promise<Attendance[]> {
  return (await d.attendance.where('meetingId').equals(meetingId).toArray()).sort((a, b) => a.order - b.order);
}

export async function setPresent(attendanceId: ID, present: boolean, d: AppDB = db): Promise<void> {
  await d.attendance.update(attendanceId, { present });
}

export async function setAllPresent(meetingId: ID, present: boolean, d: AppDB = db): Promise<void> {
  await d.attendance.where('meetingId').equals(meetingId).modify({ present });
}

export async function addGuest(meetingId: ID, name: string, title: string, d: AppDB = db): Promise<Attendance> {
  const guestName = name.trim();
  if (!guestName) throw new Error('Guest name is required');
  const existing = await listAttendance(meetingId, d);
  const row: Attendance = {
    id: newId(),
    meetingId,
    guestName,
    guestTitle: title.trim(),
    present: true,
    order: existing.length ? Math.max(...existing.map((a) => a.order)) + 1 : 0,
  };
  await d.attendance.add(row);
  return row;
}

/** إضافة شخص من الدليل لاجتماع واحد بس (مش للحضور الثابت). */
export async function addPersonToMeeting(meetingId: ID, personId: ID, d: AppDB = db): Promise<void> {
  const existing = await listAttendance(meetingId, d);
  if (existing.some((a) => a.personId === personId)) return;
  await d.attendance.add({
    id: newId(),
    meetingId,
    personId,
    present: true,
    order: existing.length ? Math.max(...existing.map((a) => a.order)) + 1 : 0,
  });
}

export async function removeAttendance(attendanceId: ID, d: AppDB = db): Promise<void> {
  await d.attendance.delete(attendanceId);
}

// ===== مراجعة المهام =====

export interface ReviewItem extends TaskRow {
  /** تحديث الاجتماع ده (لو اتكتب) */
  update?: TaskUpdate;
}

/**
 * المهام اللي بتتراجع في الاجتماع: المفتوحة في السلسلة + أي مهمة ليها تحديث في الاجتماع ده
 * (علشان اللي اتقفلت أثناء الاجتماع متختفيش). المهام اللي اتفتحت في نفس الاجتماع بتظهر في «المهام الجديدة».
 * الترتيب: المتأخر الأول.
 */
export async function reviewItems(meeting: Meeting, d: AppDB = db): Promise<ReviewItem[]> {
  const [tasks, updates, people, series] = await Promise.all([
    d.tasks.where('seriesId').equals(meeting.seriesId).toArray(),
    d.taskUpdates.where('meetingId').equals(meeting.id).toArray(),
    d.people.toArray(),
    d.series.get(meeting.seriesId),
  ]);
  const touched = new Set(updates.map((u) => u.taskId));
  const pMap = new Map(people.map((p) => [p.id, p]));
  const textUpdate = new Map<ID, TaskUpdate>();
  for (const u of updates) if (!u.status) textUpdate.set(u.taskId, u);
  return tasks
    .filter((t) => t.meetingId !== meeting.id && (isOpen(t) || touched.has(t.id)))
    .map((t) => ({
      task: t,
      series,
      owner: t.ownerId ? pMap.get(t.ownerId) : undefined,
      delay: delayDays(t, meeting.date),
      update: textUpdate.get(t.id),
    }))
    .sort(compareTaskRows);
}

/**
 * تحديث المهمة في الاجتماع ده: تحديث واحد لكل مهمة لكل اجتماع.
 * أثناء الاجتماع (مسودة) بيتعدّل في نفس السجل؛ تحديثات الاجتماعات القديمة مبتتلمسش.
 * لو النص والمطلوب فاضيين → التحديث بيتشال.
 */
export async function saveMeetingUpdate(
  meeting: Pick<Meeting, 'id' | 'date'>,
  taskId: ID,
  text: string,
  nextAction: string,
  d: AppDB = db,
): Promise<void> {
  await d.transaction('rw', d.taskUpdates, d.tasks, async () => {
    const existing = (await d.taskUpdates.where('meetingId').equals(meeting.id).toArray()).find(
      (u) => u.taskId === taskId && !u.status,
    );
    const tx = text.trim();
    const na = nextAction.trim();
    if (!tx && !na) {
      if (existing) await d.taskUpdates.delete(existing.id);
      return;
    }
    if (existing) {
      await d.taskUpdates.update(existing.id, { text: tx, nextAction: na, date: meeting.date });
    } else {
      await d.taskUpdates.add({
        id: newId(),
        taskId,
        meetingId: meeting.id,
        text: tx,
        nextAction: na,
        date: meeting.date,
        createdAt: stamp(),
      });
    }
    await d.tasks.update(taskId, { updatedAt: Date.now() });
  });
}

// ===== القرارات =====

export async function listDecisions(meetingId: ID, d: AppDB = db): Promise<Decision[]> {
  return (await d.decisions.where('meetingId').equals(meetingId).toArray()).sort((a, b) => a.order - b.order);
}

export async function addDecision(meetingId: ID, text = '', d: AppDB = db): Promise<Decision> {
  const all = await listDecisions(meetingId, d);
  const dec: Decision = { id: newId(), meetingId, text, order: all.length ? all[all.length - 1].order + 1 : 0 };
  await d.decisions.add(dec);
  return dec;
}

export async function updateDecision(id: ID, patch: Partial<Pick<Decision, 'text' | 'taskId'>>, d: AppDB = db): Promise<void> {
  await d.decisions.update(id, patch);
}

export async function removeDecision(id: ID, d: AppDB = db): Promise<void> {
  await d.decisions.delete(id);
}

export async function reorderDecisions(ids: ID[], d: AppDB = db): Promise<void> {
  await d.transaction('rw', d.decisions, async () => {
    for (const [order, id] of ids.entries()) await d.decisions.update(id, { order });
  });
}

// ===== السجل التراكمي =====

export const REGISTER_STATUSES: readonly RegisterStatus[] = ['approved', 'amended', 'cancelled'];

export async function listRegister(seriesId: ID, d: AppDB = db): Promise<RegisterItem[]> {
  return (await d.registerItems.where('seriesId').equals(seriesId).toArray()).sort((a, b) => a.createdAt - b.createdAt);
}

export async function addRegisterItem(
  seriesId: ID,
  meetingId: ID,
  input: Pick<RegisterItem, 'item' | 'text' | 'status'>,
  d: AppDB = db,
): Promise<RegisterItem> {
  if (!input.item.trim() && !input.text.trim()) throw new Error('Register item is empty');
  const r: RegisterItem = {
    id: newId(),
    seriesId,
    meetingId,
    item: input.item.trim(),
    text: input.text.trim(),
    status: input.status,
    createdAt: stamp(),
  };
  await d.registerItems.add(r);
  return r;
}

/** تعديل بند: بيتسجّل على الاجتماع الحالي (اتعدّل فيه). */
export async function updateRegisterItem(
  id: ID,
  meetingId: ID,
  patch: Partial<Pick<RegisterItem, 'item' | 'text' | 'status'>>,
  d: AppDB = db,
): Promise<void> {
  await d.registerItems.update(id, { ...patch, meetingId });
}

export async function removeRegisterItem(id: ID, d: AppDB = db): Promise<void> {
  await d.registerItems.delete(id);
}

// ===== نموذج المحضر =====

export async function buildMinutes(meetingId: ID, d: AppDB = db): Promise<MinutesModel> {
  const meeting = await d.meetings.get(meetingId);
  if (!meeting) throw new Error('Meeting not found');
  if (meeting.status === 'final' && meeting.snapshot) return meeting.snapshot;

  const [series, org, attendance, people, decisions, register, review, newTasks] = await Promise.all([
    d.series.get(meeting.seriesId),
    d.org.get('org'),
    listAttendance(meetingId, d),
    d.people.toArray(),
    listDecisions(meetingId, d),
    listRegister(meeting.seriesId, d),
    reviewItems(meeting, d),
    d.tasks.where('meetingId').equals(meetingId).toArray(),
  ]);
  if (!series) throw new Error('Series not found');
  const pMap = new Map(people.map((p) => [p.id, p]));
  const ownerName = (t: Task) => {
    const p = t.ownerId ? pMap.get(t.ownerId) : undefined;
    return p ? displayName(p) : '';
  };
  const allTasks = await d.tasks.where('seriesId').equals(meeting.seriesId).toArray();
  const codeById = new Map(allTasks.map((t) => [t.id, t.code]));

  return {
    orgName: org?.name ?? '',
    seriesName: series.name,
    colors: series.colors,
    sections: series.sections,
    registerName: series.registerName,
    number: meeting.number,
    date: meeting.date,
    nextDate: meeting.nextDate,
    topics: meeting.topics.filter((x) => x.trim()),
    notes: meeting.notes,
    attendees: attendance.map((a) => {
      const p = a.personId ? pMap.get(a.personId) : undefined;
      return {
        name: p ? displayName(p) : (a.guestTitle ? `${a.guestTitle} ${a.guestName ?? ''}` : (a.guestName ?? '')).trim(),
        position: p?.position ?? '',
        present: a.present,
        guest: !a.personId,
      };
    }),
    review: review.map((r) => ({
      code: r.task.code,
      topic: r.task.topic,
      owner: ownerName(r.task),
      update: r.update?.text ?? '',
      nextAction: r.update?.nextAction ?? '',
      status: r.task.status,
      targetDate: r.task.targetDate,
      delay: r.delay,
    })),
    decisions: decisions
      .filter((x) => x.text.trim())
      .map((x) => ({ text: x.text.trim(), taskCode: x.taskId ? codeById.get(x.taskId) : undefined })),
    newTasks: newTasks
      .sort((a, b) => a.number - b.number)
      .map((t) => ({
        code: t.code,
        topic: t.topic,
        description: t.description,
        owner: ownerName(t),
        targetDate: t.targetDate,
        priority: t.priority,
      })),
    register: register
      .filter((r) => r.status !== 'cancelled' || r.meetingId === meetingId)
      .map((r) => ({ item: r.item, text: r.text, status: r.status, isNew: r.meetingId === meetingId })),
    status: meeting.status,
  };
}

/** إنهاء المحضر: بيتحفظ نسخة ثابتة منه للأرشيف. */
export async function finalizeMeeting(id: ID, d: AppDB = db): Promise<void> {
  const draftModel = await buildMinutes(id, d);
  const snapshot: MinutesModel = { ...draftModel, status: 'final' };
  await d.meetings.update(id, { status: 'final', snapshot, finalizedAt: Date.now(), updatedAt: Date.now() });
}

/** رجوع المحضر لمسودة للتعديل — اللقطة بتتمسح وبتتعمل تاني عند الإنهاء. */
export async function reopenMeeting(id: ID, d: AppDB = db): Promise<void> {
  await d.meetings.update(id, { status: 'draft', snapshot: undefined, finalizedAt: undefined, updatedAt: Date.now() });
}

/**
 * حذف مسودة اجتماع. مسموح بس لو متعملش فيها مهام جديدة.
 * لو كانت آخر رقم، العدّاد بيرجع علشان ترقيم الاجتماعات ميبقاش فيه فراغ.
 */
export async function deleteDraftMeeting(id: ID, d: AppDB = db): Promise<void> {
  await d.transaction('rw', [d.meetings, d.series, d.attendance, d.decisions, d.taskUpdates, d.tasks, d.registerItems], async () => {
    const m = await d.meetings.get(id);
    if (!m) return;
    if (m.status !== 'draft') throw new Error('Only drafts can be deleted');
    if ((await d.tasks.where('meetingId').equals(id).count()) > 0) throw new Error('Meeting has new tasks');
    await d.attendance.where('meetingId').equals(id).delete();
    await d.decisions.where('meetingId').equals(id).delete();
    // نصوص التحديث المكتوبة في المسودة بتتمسح، وتغييرات الحالة بتفضل في سجل المهمة من غير ربط بالاجتماع
    for (const u of await d.taskUpdates.where('meetingId').equals(id).toArray()) {
      if (u.status) await d.taskUpdates.update(u.id, { meetingId: undefined });
      else await d.taskUpdates.delete(u.id);
    }
    await d.registerItems.where('meetingId').equals(id).modify((r) => {
      delete r.meetingId;
    });
    await d.meetings.delete(id);
    const series = await d.series.get(m.seriesId);
    if (series && series.meetingCounter === m.number) {
      await d.series.update(series.id, { meetingCounter: m.number - 1 });
    }
  });
}

export async function listMeetings(seriesId: ID, d: AppDB = db): Promise<Meeting[]> {
  return (await d.meetings.where('seriesId').equals(seriesId).toArray()).sort((a, b) => b.number - a.number);
}
