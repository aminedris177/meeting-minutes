// تنبيهات جوه التطبيق: المتأخر، اللي معاده خلال 3 أيام، واجتماع النهارده/بكرة.
// + رقم المتأخر على أيقونة التطبيق (Badging API) — بيتحدّث لما التطبيق يتفتح.
import { useEffect } from 'preact/hooks';
import { useLive } from '../db/live';
import { seriesNextDate } from '../db/repos/meetings';
import { db, type AppDB } from '../db/schema';
import type { Series } from '../db/types';
import { delayDays, isOpen } from '../domain/delay';
import { addDays, diffDays, todayISO, type ISODate } from './dates';

export const SOON_DAYS = 3;

export interface AlertsSummary {
  overdue: number;
  soon: number;
  meetings: { series: Series; date: ISODate; when: 'today' | 'tomorrow' }[];
}

export async function computeAlerts(today: ISODate, d: AppDB = db): Promise<AlertsSummary> {
  const [series, tasks] = await Promise.all([d.series.toArray(), d.tasks.toArray()]);
  const active = new Set(series.filter((s) => !s.archived).map((s) => s.id));
  let overdue = 0;
  let soon = 0;
  for (const t of tasks) {
    if (!active.has(t.seriesId) || !isOpen(t) || !t.targetDate) continue;
    if (delayDays(t, today) > 0) overdue++;
    else {
      const left = diffDays(today, t.targetDate);
      if (left >= 0 && left <= SOON_DAYS) soon++;
    }
  }
  const tomorrow = addDays(today, 1);
  const meetings: AlertsSummary['meetings'] = [];
  for (const s of series.filter((x) => !x.archived)) {
    const next = await seriesNextDate(s, d);
    if (next === today) meetings.push({ series: s, date: next, when: 'today' });
    else if (next === tomorrow) meetings.push({ series: s, date: next, when: 'tomorrow' });
  }
  return { overdue, soon, meetings };
}

type BadgeNavigator = Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

export function badgeSupported(): boolean {
  return typeof navigator !== 'undefined' && 'setAppBadge' in navigator;
}

export async function updateBadge(count: number): Promise<void> {
  const nav = navigator as BadgeNavigator;
  try {
    if (!nav.setAppBadge) return;
    if (count > 0) await nav.setAppBadge(count);
    else await nav.clearAppBadge?.();
  } catch {
    /* من غير إذن (آيفون) أو غير مدعوم — مفيش مشكلة */
  }
}

/** بيحدّث رقم الأيقونة كل ما عدد المتأخر يتغير والتطبيق مفتوح. */
export function useBadgeSync(): void {
  const today = todayISO();
  const alerts = useLive(() => computeAlerts(today), [today]);
  useEffect(() => {
    if (alerts) void updateBadge(alerts.overdue);
  }, [alerts?.overdue]);
}
