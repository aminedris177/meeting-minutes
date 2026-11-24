// إشعار المتأخر في الـ Service Worker (public/sw-overdue.js): نفس حساب التطبيق، وبيحدّث/يقفل نفس الإشعار.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppDB } from '../src/db/schema';
import { computeAlerts } from '../src/lib/alerts';

interface Shown {
  title: string;
  opts: { tag: string; body: string; silent: boolean };
  closed: boolean;
}
interface SwApi {
  countOverdue(series: unknown[], tasks: unknown[], today: string): number;
  check(today?: string): Promise<number>;
}

function loadSw() {
  const shown: Shown[] = [];
  const listeners: Record<string, unknown> = {};
  const self: Record<string, unknown> = {
    addEventListener: (type: string, fn: unknown) => (listeners[type] = fn),
    registration: {
      scope: 'https://x.test/meeting-minutes/',
      getNotifications: async ({ tag }: { tag: string }) =>
        shown.filter((n) => n.opts.tag === tag && !n.closed).map((n) => ({ close: () => (n.closed = true) })),
      showNotification: async (title: string, opts: Shown['opts']) => {
        shown.filter((n) => n.opts.tag === opts.tag).forEach((n) => (n.closed = true));
        shown.push({ title, opts, closed: false });
      },
    },
  };
  new Function('self', readFileSync('public/sw-overdue.js', 'utf8'))(self);
  return { api: self.__overdue as SwApi, shown, listeners };
}

const TODAY = '2026-11-24';
const task = (id: string, seriesId: string, status: string, targetDate?: string) => ({ id, seriesId, status, targetDate });

let db: AppDB;
beforeEach(async () => {
  db = new AppDB('meeting-minutes');
  await db.open();
  await Promise.all(db.tables.map((tb) => tb.clear()));
  await db.series.bulkAdd([{ id: 's1' }, { id: 's2', archived: true }] as never);
  await db.tasks.bulkAdd([
    task('a', 's1', 'not_started', '2026-11-20'), // متأخر
    task('b', 's1', 'in_progress', '2026-11-23'), // متأخر
    task('c', 's1', 'done', '2026-11-01'), // مقفولة
    task('d', 's1', 'not_started', TODAY), // النهارده — مش متأخر
    task('e', 's1', 'not_started'), // من غير موعد
    task('f', 's2', 'not_started', '2026-11-01'), // سلسلة مؤرشفة
  ] as never);
});

describe('service worker overdue notification', () => {
  it('counts overdue exactly like the app', async () => {
    const { api } = loadSw();
    const series = await db.series.toArray();
    const tasks = await db.tasks.toArray();
    expect(api.countOverdue(series, tasks, TODAY)).toBe(2);
    expect((await computeAlerts(TODAY, db)).overdue).toBe(2);
  });

  it('does nothing while the alert is off', async () => {
    const { api, shown } = loadSw();
    expect(await api.check(TODAY)).toBe(-1);
    expect(shown).toHaveLength(0);
  });

  it('shows one notification, replaces it, and closes it when nothing is overdue', async () => {
    await db.settings.put({ key: 'overdueNotify', value: { on: true, title: 'مهام متأخرة', body: 'عندك {n} مهمة متأخرة.', url: '/meeting-minutes/#/followup/overdue' } });
    const { api, shown, listeners } = loadSw();
    expect(typeof listeners.periodicsync).toBe('function');
    expect(typeof listeners.notificationclick).toBe('function');
    expect(await api.check(TODAY)).toBe(2);
    expect(shown).toHaveLength(1);
    expect(shown[0].opts).toMatchObject({ tag: 'overdue', body: 'عندك 2 مهمة متأخرة.', silent: false });
    // تاني مرة: نفس الـ tag، من غير صوت، والقديم بيتقفل
    expect(await api.check(TODAY)).toBe(2);
    expect(shown.filter((n) => !n.closed)).toHaveLength(1);
    expect(shown[1].opts.silent).toBe(true);
    // خلّص المتأخر → الإشعار يتقفل
    await db.tasks.where('id').anyOf(['a', 'b']).modify({ status: 'done' });
    expect(await api.check(TODAY)).toBe(0);
    expect(shown.filter((n) => !n.closed)).toHaveLength(0);
  });
});
