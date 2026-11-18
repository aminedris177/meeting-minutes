// حالة المهمة وأيام التأخير — بتتحسب ومش بتتخزن.
import { diffDays, type ISODate } from '../lib/dates';
import type { Task, TaskStatus } from '../db/types';

export const CLOSED_STATUSES: readonly TaskStatus[] = ['done', 'cancelled'];

export function isOpen(t: Pick<Task, 'status'>): boolean {
  return !CLOSED_STATUSES.includes(t.status);
}

/**
 * أيام التأخير = اليوم − الموعد المستهدف، للمهام المفتوحة بس.
 * 0 لو مفيش موعد، أو لسه مجاش، أو المهمة مقفولة.
 */
export function delayDays(t: Pick<Task, 'status' | 'targetDate'>, today: ISODate): number {
  if (!isOpen(t) || !t.targetDate) return 0;
  return Math.max(0, diffDays(t.targetDate, today));
}

export function isOverdue(t: Pick<Task, 'status' | 'targetDate'>, today: ISODate): boolean {
  return delayDays(t, today) > 0;
}
