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
  introOne: string; // «عندك {n} مهمة مفتوحة في «{series}»:»
  introMany: string; // «عندك {n} مهمة مفتوحة:»
  code: string; // «رقم المهمة: {code}»
  status: string; // «الحالة: {status}»
  late: string; // «⚠️ متأخرة {n} يوم (كان موعدها {date})»
  due: string; // «الموعد: {date}»
  noDate: string;
  next: string; // «الاجتماع القادم: {date}»
  closing: string;
  statuses: Record<TaskStatus, string>;
  formatDate: (d: ISODate) => string;
}

export interface MessageSeries {
  name: string;
  nextDate?: ISODate;
}

// علامات الاتجاه: واتساب بيحدد اتجاه السطر من أول حرف. في العربي بنبدأ كل سطر بـ RLM،
// وبنعزل الأرقام والتواريخ والأكواد الإنجليزي بـ LRM علشان متتقلبش ولا تبدّل مكانها.
const RLM = '\u200F';
const LRM = '\u200E';
const ltr = (s: string, rtl: boolean) => (rtl ? LRM + s + LRM : s);
const fill = (tpl: string, v: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''));

/**
 * رسالة متابعة لمسؤول (واتساب): كل مهمة في كذا سطر، المتأخر الأول، ومجمّعة حسب السلسلة
 * لو المهام من أكتر من سلسلة، ومع تاريخ الاجتماع القادم لكل سلسلة.
 */
export function ownerMessage(
  name: string,
  tasks: Pick<Task, 'code' | 'description' | 'status' | 'targetDate' | 'seriesId'>[],
  series: Record<string, MessageSeries>,
  today: ISODate,
  L: MessageLabels,
  rtl: boolean,
): string {
  const open = tasks
    .filter(isOpen)
    .sort((a, b) => delayDays(b, today) - delayDays(a, today) || (a.targetDate ?? '9').localeCompare(b.targetDate ?? '9'));
  const groups: { id: string; items: typeof open }[] = [];
  for (const t of open) {
    let g = groups.find((x) => x.id === t.seriesId);
    if (!g) groups.push((g = { id: t.seriesId, items: [] }));
    g.items.push(t);
  }
  const date = (d: ISODate) => ltr(L.formatDate(d), rtl);
  const one = groups.length === 1;
  const lines: string[] = [fill(L.greeting, { name })];
  lines.push(one ? fill(L.introOne, { n: open.length, series: series[groups[0].id]?.name ?? '' }) : fill(L.introMany, { n: open.length }));
  let n = 0;
  for (const g of groups) {
    const s = series[g.id];
    if (!one) {
      lines.push('', `*${s?.name ?? ''}*`);
      if (s?.nextDate) lines.push(fill(L.next, { date: date(s.nextDate) }));
    }
    for (const t of g.items) {
      n++;
      const d = delayDays(t, today);
      lines.push('', `${n}- *${t.description.trim()}*`);
      lines.push('   ' + fill(L.code, { code: ltr(t.code, rtl) }));
      lines.push('   ' + fill(L.status, { status: L.statuses[t.status] }));
      if (d > 0 && t.targetDate) lines.push('   ' + fill(L.late, { n: ltr(String(d), rtl), date: date(t.targetDate) }));
      else lines.push('   ' + (t.targetDate ? fill(L.due, { date: date(t.targetDate) }) : L.noDate));
    }
  }
  lines.push('');
  if (one && series[groups[0].id]?.nextDate) lines.push(fill(L.next, { date: date(series[groups[0].id].nextDate!) }));
  lines.push(L.closing);
  // كل سطر في العربي يبدأ بعلامة يمين-لشمال
  return lines.map((x) => (rtl && x ? RLM + x : x)).join('\n');
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
