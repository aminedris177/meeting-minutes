// شبكة التقويم الشهري: الأسبوع بيبدأ السبت، والأيام اللي برّه الشهر بتكمّل الصفوف.
import { addDays, parseISODate, startOfWeek, toISODate, type ISODate } from '../lib/dates';
import type { Recurrence } from '../db/types';
import { nextMeetingDate } from './recurrence';

export interface MonthRef {
  year: number;
  month: number; // 1–12
}

export function monthOf(date: ISODate): MonthRef {
  const d = parseISODate(date);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function shiftMonth(m: MonthRef, delta: number): MonthRef {
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthStart(m: MonthRef): ISODate {
  return toISODate(new Date(m.year, m.month - 1, 1));
}

export function monthEnd(m: MonthRef): ISODate {
  return toISODate(new Date(m.year, m.month, 0));
}

/** أيام الشبكة: من سبت أول أسبوع لحد جمعة آخر أسبوع (35 أو 42 يوم). */
export function monthGrid(m: MonthRef): ISODate[] {
  const first = startOfWeek(monthStart(m));
  const last = monthEnd(m);
  const days: ISODate[] = [];
  for (let d = first; days.length < 42; d = addDays(d, 1)) {
    if (days.length % 7 === 0 && d > last) break;
    days.push(d);
  }
  return days;
}

/**
 * الاجتماعات المتوقعة لسلسلة جوه فترة: من الاجتماع القادم وبالتكرار،
 * من غير الأيام اللي فيها اجتماع متسجل بالفعل.
 */
export function projectedMeetings(next: ISODate | undefined, r: Recurrence, from: ISODate, to: ISODate, existing: Set<ISODate>): ISODate[] {
  if (!next) return [];
  const out: ISODate[] = [];
  let d = next;
  for (let i = 0; i < 500 && d <= to; i++) {
    if (d >= from && !existing.has(d)) out.push(d);
    d = nextMeetingDate(d, r);
  }
  return out;
}
