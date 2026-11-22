// تجميع المتابعة حسب الموعد، ونص رسالة المتابعة (واتساب) لمسؤول واحد، وإحصائيات المسؤولين.
import type { Task, TaskStatus } from '../db/types';
import { addDays, diffDays, startOfWeek, type ISODate } from '../lib/dates';
import { delayDays, isOpen } from './delay';

export type DueGroup = 'overdue' | 'today' | 'week' | 'later' | 'noDate' | 'closed';
export const DUE_GROUPS: DueGroup[] = ['overdue', 'today', 'week', 'later', 'noDate', 'closed'];

/** مجموعة المهمة: متأخرة / النهارده / باقي الأسبوع ده (لحد الجمعة) / بعد كده / من غير موعد / مقفولة. */
export function dueGroup(t: Pick<Task, 'status' | 'targetDate'>, today: ISODate): DueGroup {
  if (!isOpen(t)) return 'closed';
  if (!t.targetDate) return 'noDate';
  if (t.targetDate < today) return 'overdue';
  if (t.targetDate === today) return 'today';
  const weekEnd = addDays(startOfWeek(today), 6);
  return t.targetDate <= weekEnd ? 'week' : 'later';
}

/** يقسم القايمة لمجموعات بنفس الترتيب الأصلي جوه كل مجموعة (المجموعات الفاضية بتتشال). */
export function groupByDue<T extends { task: Pick<Task, 'status' | 'targetDate'> }>(rows: T[], today: ISODate): { group: DueGroup; rows: T[] }[] {
  const map = new Map<DueGroup, T[]>();
  for (const r of rows) {
    const g = dueGroup(r.task, today);
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(r);
  }
  return DUE_GROUPS.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }));
}

export interface MessageLabels {
  greeting: string; // «أهلاً {name}،»
  intro: string;
  late: string; // «متأخرة {n} يوم»
  due: string; // «الموعد {date}»
  noDate: string;
  statuses: Record<TaskStatus, string>;
  formatDate: (d: ISODate) => string;
}

/** رسالة متابعة لمسؤول: كل مهامه المفتوحة، المتأخر الأول. */
export function ownerMessage(
  name: string,
  tasks: Pick<Task, 'code' | 'description' | 'status' | 'targetDate'>[],
  today: ISODate,
  L: MessageLabels,
): string {
  const open = tasks
    .filter(isOpen)
    .sort((a, b) => delayDays(b, today) - delayDays(a, today) || (a.targetDate ?? '9').localeCompare(b.targetDate ?? '9'));
  const lines = open.map((t) => {
    const d = delayDays(t, today);
    const when = d > 0 ? L.late.replace('{n}', String(d)) : t.targetDate ? L.due.replace('{date}', L.formatDate(t.targetDate)) : L.noDate;
    return `• ${t.code} — ${t.description} (${L.statuses[t.status]} · ${when})`;
  });
  return [L.greeting.replace('{name}', name), L.intro.replace('{n}', String(open.length)), '', ...lines].join('\n');
}

export interface OwnerStats {
  ownerId: string | null;
  open: number;
  overdue: number;
  closed: number;
  onTime: number; // اتقفلت في معادها أو قبله (من اللي ليها موعد)
  avgDelay: number; // متوسط أيام التأخير للمتأخر المفتوح
}

export function ownerStats(tasks: Pick<Task, 'ownerId' | 'status' | 'targetDate' | 'closedDate'>[], today: ISODate): OwnerStats[] {
  const map = new Map<string | null, OwnerStats & { delaySum: number }>();
  for (const t of tasks) {
    const k = t.ownerId ?? null;
    if (!map.has(k)) map.set(k, { ownerId: k, open: 0, overdue: 0, closed: 0, onTime: 0, avgDelay: 0, delaySum: 0 });
    const s = map.get(k)!;
    if (isOpen(t)) {
      s.open++;
      const d = delayDays(t, today);
      if (d > 0) {
        s.overdue++;
        s.delaySum += d;
      }
    } else if (t.status === 'done') {
      s.closed++;
      if (t.targetDate && t.closedDate && diffDays(t.closedDate, t.targetDate) >= 0) s.onTime++;
    }
  }
  return [...map.values()]
    .map(({ delaySum, ...s }) => ({ ...s, avgDelay: s.overdue ? Math.round(delaySum / s.overdue) : 0 }))
    .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
}
