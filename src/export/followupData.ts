// بيانات ملف المتابعة لسلسلة واحدة — مشتركة بين PDF وExcel.
import type { FollowupData } from '../components/FollowupReport';
import { latestTextUpdate, listTaskUpdates, queryTasks } from '../db/repos/tasks';
import { db, type AppDB } from '../db/schema';
import { isOpen } from '../domain/delay';
import { todayISO, type ISODate } from '../lib/dates';

export async function buildFollowupData(seriesId: string, today: ISODate = todayISO(), d: AppDB = db): Promise<FollowupData> {
  const [series, org] = await Promise.all([d.series.get(seriesId), d.org.get('org')]);
  if (!series) throw new Error('Series not found');
  const rows = await queryTasks({ seriesId, ownerId: 'all', status: 'all' }, today, d);
  const withUpdates = await Promise.all(
    rows.map(async (r) => ({ task: r.task, owner: r.owner, delay: r.delay, latest: latestTextUpdate(await listTaskUpdates(r.task.id, d)) })),
  );
  return {
    orgName: org?.name ?? '',
    series,
    today,
    rows: withUpdates,
    counts: {
      open: rows.filter((r) => isOpen(r.task)).length,
      overdue: rows.filter((r) => r.delay > 0).length,
      done: rows.filter((r) => r.task.status === 'done').length,
      total: rows.length,
    },
  };
}
