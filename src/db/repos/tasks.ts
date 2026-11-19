// المهام: الإنشاء بترقيم ثابت داخل كل سلسلة، تغيير الحالة، وسجل التحديثات (إضافة فقط).
import { compareTaskCodes, formatTaskCode } from '../../domain/numbering';
import { delayDays, isOpen } from '../../domain/delay';
import type { ISODate } from '../../lib/dates';
import { db, newId, type AppDB } from '../schema';
import type { ID, Person, Series, Task, TaskPriority, TaskStatus, TaskUpdate } from '../types';

export const TASK_STATUSES: readonly TaskStatus[] = ['not_started', 'in_progress', 'blocked', 'done', 'cancelled'];
export const TASK_PRIORITIES: readonly TaskPriority[] = ['high', 'medium', 'low'];

export interface TaskInput {
  seriesId: ID;
  description: string;
  topic: string;
  ownerId: ID | null;
  createdDate: ISODate;
  targetDate?: ISODate;
  priority: TaskPriority;
  meetingId?: ID;
}

export type TaskPatch = Partial<Pick<Task, 'description' | 'topic' | 'ownerId' | 'createdDate' | 'targetDate' | 'priority'>>;

// وقت بيزيد دايماً — علشان ترتيب السجل يفضل ثابت حتى لو تحديثين اتسجلوا في نفس الملّي ثانية
let lastStamp = 0;
function stamp(): number {
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  return lastStamp;
}

/**
 * إنشاء مهمة: الرقم = عدّاد السلسلة + 1، جوه transaction واحدة
 * علشان مفيش رقمين يتكرروا حتى لو اتعملت مهمتين في نفس اللحظة.
 * الكود (Y-07) بيتخزن وقت الإنشاء ومبيتغيرش بعد كده حتى لو البادئة اتغيرت.
 */
export async function createTask(input: TaskInput, d: AppDB = db): Promise<Task> {
  const description = input.description.trim();
  if (!description) throw new Error('Task description is required');
  return d.transaction('rw', d.series, d.tasks, async () => {
    const series = await d.series.get(input.seriesId);
    if (!series) throw new Error('Series not found');
    const number = series.taskCounter + 1;
    const now = Date.now();
    const task: Task = {
      id: newId(),
      seriesId: series.id,
      number,
      code: formatTaskCode(series.taskPrefix, number),
      topic: input.topic.trim(),
      description,
      ownerId: input.ownerId,
      createdDate: input.createdDate,
      targetDate: input.targetDate,
      priority: input.priority,
      status: 'not_started',
      meetingId: input.meetingId,
      createdAt: now,
      updatedAt: now,
    };
    await d.tasks.add(task);
    await d.series.update(series.id, { taskCounter: number, updatedAt: now });
    return task;
  });
}

export async function updateTask(id: ID, patch: TaskPatch, d: AppDB = db): Promise<void> {
  const clean: TaskPatch = { ...patch };
  if (clean.description !== undefined) {
    clean.description = clean.description.trim();
    if (!clean.description) throw new Error('Task description is required');
  }
  if (clean.topic !== undefined) clean.topic = clean.topic.trim();
  await d.tasks.update(id, { ...clean, updatedAt: Date.now() });
}

/**
 * تغيير الحالة:
 * - تم / ملغي → تاريخ الإغلاق = اليوم.
 * - رجوع لحالة مفتوحة → تاريخ الإغلاق يتمسح.
 * - التغيير بيتسجل في سجل التحديثات.
 */
export async function setTaskStatus(
  id: ID,
  status: TaskStatus,
  today: ISODate,
  opts: { meetingId?: ID; note?: string } = {},
  d: AppDB = db,
): Promise<void> {
  await d.transaction('rw', d.tasks, d.taskUpdates, async () => {
    const task = await d.tasks.get(id);
    if (!task) throw new Error('Task not found');
    if (task.status === status) return;
    const closing = !isOpen({ status });
    await d.tasks.update(id, {
      status,
      closedDate: closing ? (isOpen(task) ? today : (task.closedDate ?? today)) : undefined,
      updatedAt: Date.now(),
    });
    await d.taskUpdates.add({
      id: newId(),
      taskId: id,
      meetingId: opts.meetingId,
      text: opts.note?.trim() ?? '',
      nextAction: '',
      date: today,
      status,
      prevStatus: task.status,
      createdAt: stamp(),
    });
  });
}

export interface UpdateInput {
  text: string;
  nextAction: string;
  date: ISODate;
  meetingId?: ID;
}

/** إضافة تحديث للسجل. التحديثات القديمة مبتتعدلش ولا بتتمسح. */
export async function addTaskUpdate(taskId: ID, input: UpdateInput, d: AppDB = db): Promise<TaskUpdate> {
  const text = input.text.trim();
  const nextAction = input.nextAction.trim();
  if (!text && !nextAction) throw new Error('Update text is required');
  const u: TaskUpdate = {
    id: newId(),
    taskId,
    meetingId: input.meetingId,
    text,
    nextAction,
    date: input.date,
    createdAt: stamp(),
  };
  await d.transaction('rw', d.tasks, d.taskUpdates, async () => {
    if (!(await d.tasks.get(taskId))) throw new Error('Task not found');
    await d.taskUpdates.add(u);
    await d.tasks.update(taskId, { updatedAt: Date.now() });
  });
  return u;
}

/** السجل: الأحدث الأول. */
export async function listTaskUpdates(taskId: ID, d: AppDB = db): Promise<TaskUpdate[]> {
  const all = await d.taskUpdates.where('taskId').equals(taskId).toArray();
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

/** آخر تحديث نصّي (مش مجرد تغيير حالة). */
export function latestTextUpdate(updates: TaskUpdate[]): TaskUpdate | undefined {
  return updates.find((u) => u.text || u.nextAction);
}

/**
 * حذف مهمة اتعملت بالغلط. الرقم مبيرجعش للعدّاد (الأرقام مبتتكررش).
 * لو المهمة اتراجعت في اجتماع، الأفضل «ملغي» بدل الحذف.
 */
export async function deleteTask(id: ID, d: AppDB = db): Promise<void> {
  await d.transaction('rw', d.tasks, d.taskUpdates, d.decisions, async () => {
    await d.taskUpdates.where('taskId').equals(id).delete();
    await d.decisions.where('taskId').equals(id).modify({ taskId: undefined });
    await d.tasks.delete(id);
  });
}

// ===== الاستعلام للمتابعة =====

export type StatusFilter = 'open' | 'overdue' | 'all' | TaskStatus;
/** 'all' | 'none' (يُحدَّد) | personId */
export type OwnerFilter = string;

export interface TaskFilter {
  seriesId: ID | 'all';
  ownerId: OwnerFilter;
  status: StatusFilter;
  query?: string;
}

export interface TaskRow {
  task: Task;
  series?: Series;
  owner?: Person;
  delay: number;
}

export function matchesFilter(t: Task, f: TaskFilter, today: ISODate): boolean {
  if (f.seriesId !== 'all' && t.seriesId !== f.seriesId) return false;
  if (f.ownerId === 'none' && t.ownerId !== null) return false;
  if (f.ownerId !== 'all' && f.ownerId !== 'none' && t.ownerId !== f.ownerId) return false;
  switch (f.status) {
    case 'all':
      break;
    case 'open':
      if (!isOpen(t)) return false;
      break;
    case 'overdue':
      if (delayDays(t, today) === 0) return false;
      break;
    default:
      if (t.status !== f.status) return false;
  }
  const q = f.query?.trim();
  if (q && !t.description.includes(q) && !t.topic.includes(q) && !t.code.toLowerCase().includes(q.toLowerCase())) return false;
  return true;
}

/**
 * الترتيب: المتأخر الأول (الأكثر تأخيراً فوق)، بعدين المفتوح حسب الموعد الأقرب
 * (اللي من غير موعد في الآخر)، بعدين المقفول (الأحدث إغلاقاً فوق).
 */
export function compareTaskRows(a: TaskRow, b: TaskRow): number {
  const ao = isOpen(a.task);
  const bo = isOpen(b.task);
  if (ao !== bo) return ao ? -1 : 1;
  if (ao) {
    if (a.delay !== b.delay) return b.delay - a.delay;
    const at = a.task.targetDate ?? '9999-12-31';
    const bt = b.task.targetDate ?? '9999-12-31';
    if (at !== bt) return at < bt ? -1 : 1;
  } else {
    const ac = a.task.closedDate ?? '';
    const bc = b.task.closedDate ?? '';
    if (ac !== bc) return ac > bc ? -1 : 1;
  }
  return compareTaskCodes(a.task.code, b.task.code);
}

export async function queryTasks(f: TaskFilter, today: ISODate, d: AppDB = db): Promise<TaskRow[]> {
  const [tasks, series, people] = await Promise.all([
    f.seriesId === 'all' ? d.tasks.toArray() : d.tasks.where('seriesId').equals(f.seriesId).toArray(),
    d.series.toArray(),
    d.people.toArray(),
  ]);
  const sMap = new Map(series.map((s) => [s.id, s]));
  const pMap = new Map(people.map((p) => [p.id, p]));
  return tasks
    .filter((t) => matchesFilter(t, f, today))
    .map((t) => ({
      task: t,
      series: sMap.get(t.seriesId),
      owner: t.ownerId ? pMap.get(t.ownerId) : undefined,
      delay: delayDays(t, today),
    }))
    .sort(compareTaskRows);
}

/** عدد المهام لكل حالة (للفلاتر) — بنفس فلتر السلسلة والمسؤول. */
export async function countByStatus(
  f: Omit<TaskFilter, 'status'>,
  today: ISODate,
  d: AppDB = db,
): Promise<Record<StatusFilter, number>> {
  const tasks = await d.tasks.toArray();
  const base = tasks.filter((t) => matchesFilter(t, { ...f, status: 'all' }, today));
  const counts = { open: 0, overdue: 0, all: base.length } as Record<StatusFilter, number>;
  for (const s of TASK_STATUSES) counts[s] = 0;
  for (const t of base) {
    counts[t.status]++;
    if (isOpen(t)) counts.open++;
    if (delayDays(t, today) > 0) counts.overdue++;
  }
  return counts;
}
