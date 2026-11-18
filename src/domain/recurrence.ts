// حساب تاريخ الاجتماع القادم من التكرار.
import { addDays, parseISODate, toISODate, type ISODate } from '../lib/dates';
import type { Recurrence } from '../db/types';

export const MIN_CUSTOM_DAYS = 1;
export const MAX_CUSTOM_DAYS = 365;

/**
 * الاجتماع القادم بعد اجتماع بتاريخ `from`.
 * - أسبوعي: +7، كل أسبوعين: +14، مخصص: +N يوم.
 * - شهري: نفس اليوم في الشهر اللي بعده، ولو اليوم مش موجود (31) → آخر يوم في الشهر.
 */
export function nextMeetingDate(from: ISODate, r: Recurrence): ISODate {
  switch (r.kind) {
    case 'weekly':
      return addDays(from, 7);
    case 'biweekly':
      return addDays(from, 14);
    case 'monthly':
      return addMonthsClamped(from, 1);
    case 'custom': {
      const n = r.everyDays ?? 0;
      if (!Number.isInteger(n) || n < MIN_CUSTOM_DAYS || n > MAX_CUSTOM_DAYS) {
        throw new Error(`Invalid custom recurrence: ${n} days`);
      }
      return addDays(from, n);
    }
  }
}

export function addMonthsClamped(from: ISODate, months: number): ISODate {
  const d = parseISODate(from);
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return toISODate(target);
}

export function isValidRecurrence(r: Recurrence): boolean {
  if (r.kind !== 'custom') return true;
  const n = r.everyDays;
  return n !== undefined && Number.isInteger(n) && n >= MIN_CUSTOM_DAYS && n <= MAX_CUSTOM_DAYS;
}
