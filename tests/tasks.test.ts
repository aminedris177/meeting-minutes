import { describe, expect, it } from 'vitest';
import { createSeries, updateSeries } from '../src/db/repos/series';
import { addPerson } from '../src/db/repos/people';
import {
  addTaskUpdate,
  countByStatus,
  createTask,
  deleteTask,
  listTaskUpdates,
  queryTasks,
  setTaskStatus,
  updateTask,
  type TaskInput,
} from '../src/db/repos/tasks';
import { emptySeriesDraft } from '../src/domain/series';
import type { AppDB } from '../src/db/schema';
import { freshDb } from './helpers';

const today = '2026-11-18';

async function setup(d: AppDB) {
  const y = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة ص', taskPrefix: 'Y' }, d);
  const q = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة ق', taskPrefix: 'Q' }, d);
  return { y, q };
}

const input = (seriesId: string, over: Partial<TaskInput> = {}): TaskInput => ({
  seriesId,
  description: 'مهمة',
  topic: '',
  ownerId: null,
  createdDate: '2026-11-01',
  priority: 'medium',
  ...over,
});

describe('per-series task numbering', () => {
  it('numbers each series independently', async () => {
    const d = freshDb();
    const { y, q } = await setup(d);
    const a = await createTask(input(y.id), d);
    const b = await createTask(input(q.id), d);
    const c = await createTask(input(y.id), d);
    expect([a.code, b.code, c.code]).toEqual(['Y-01', 'Q-01', 'Y-02']);
    expect((await d.series.get(y.id))!.taskCounter).toBe(2);
    expect((await d.series.get(q.id))!.taskCounter).toBe(1);
  });

  it('never reuses numbers in concurrent creation', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const tasks = await Promise.all(Array.from({ length: 12 }, () => createTask(input(y.id), d)));
    const numbers = tasks.map((t) => t.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(new Set(tasks.map((t) => t.code)).size).toBe(12);
  });

  it('goes past 99 (Y-100)', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    await d.series.update(y.id, { taskCounter: 98 });
    const t99 = await createTask(input(y.id), d);
    const t100 = await createTask(input(y.id), d);
    expect([t99.code, t100.code]).toEqual(['Y-99', 'Y-100']);
  });

  it('keeps existing codes when the prefix changes; new tasks use the new prefix', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const old = await createTask(input(y.id), d);
    await updateSeries(y.id, { ...emptySeriesDraft(), name: 'سلسلة ص', taskPrefix: 'YD' }, d);
    const fresh = await createTask(input(y.id), d);
    expect((await d.tasks.get(old.id))!.code).toBe('Y-01');
    expect(fresh.code).toBe('YD-02');
  });

  it('does not reuse a number after deleting a task', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const a = await createTask(input(y.id), d);
    await deleteTask(a.id, d);
    expect((await createTask(input(y.id), d)).code).toBe('Y-02');
  });

  it('rejects empty descriptions and unknown series', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    await expect(createTask(input(y.id, { description: '  ' }), d)).rejects.toThrow();
    await expect(createTask(input('missing'), d)).rejects.toThrow();
    expect((await d.series.get(y.id))!.taskCounter).toBe(0);
  });
});

describe('status changes', () => {
  it('sets closedDate when closing and clears it when reopening, and logs each change', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const t = await createTask(input(y.id), d);

    await setTaskStatus(t.id, 'in_progress', '2026-11-05', {}, d);
    expect((await d.tasks.get(t.id))!.closedDate).toBeUndefined();

    await setTaskStatus(t.id, 'done', '2026-11-10', {}, d);
    expect(await d.tasks.get(t.id)).toMatchObject({ status: 'done', closedDate: '2026-11-10' });

    // من «تم» لـ «ملغي»: يفضل مقفول بنفس تاريخ الإغلاق
    await setTaskStatus(t.id, 'cancelled', '2026-11-12', {}, d);
    expect(await d.tasks.get(t.id)).toMatchObject({ status: 'cancelled', closedDate: '2026-11-10' });

    await setTaskStatus(t.id, 'blocked', '2026-11-15', {}, d);
    const reopened = await d.tasks.get(t.id);
    expect(reopened!.status).toBe('blocked');
    expect(reopened!.closedDate).toBeUndefined();

    const log = await listTaskUpdates(t.id, d);
    expect(log.map((u) => [u.prevStatus, u.status])).toEqual([
      ['cancelled', 'blocked'],
      ['done', 'cancelled'],
      ['in_progress', 'done'],
      ['not_started', 'in_progress'],
    ]);
  });

  it('ignores setting the same status', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const t = await createTask(input(y.id), d);
    await setTaskStatus(t.id, 'not_started', today, {}, d);
    expect(await listTaskUpdates(t.id, d)).toHaveLength(0);
  });
});

describe('task updates log', () => {
  it('is append-only and newest first', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const t = await createTask(input(y.id), d);
    await addTaskUpdate(t.id, { text: 'أول تحديث', nextAction: 'مطلوب ١', date: '2026-11-02' }, d);
    await addTaskUpdate(t.id, { text: 'تاني تحديث', nextAction: '', date: '2026-11-09' }, d);
    const log = await listTaskUpdates(t.id, d);
    expect(log.map((u) => u.text)).toEqual(['تاني تحديث', 'أول تحديث']);
    expect(log[1].nextAction).toBe('مطلوب ١');
  });

  it('rejects empty updates', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const t = await createTask(input(y.id), d);
    await expect(addTaskUpdate(t.id, { text: ' ', nextAction: '', date: today }, d)).rejects.toThrow();
  });

  it('updateTask edits fields but not the code', async () => {
    const d = freshDb();
    const { y } = await setup(d);
    const t = await createTask(input(y.id), d);
    await updateTask(t.id, { description: ' وصف جديد ', targetDate: '2026-12-01' }, d);
    expect(await d.tasks.get(t.id)).toMatchObject({ description: 'وصف جديد', targetDate: '2026-12-01', code: 'Y-01' });
  });
});

describe('follow-up query', () => {
  it('filters by series, owner, status and sorts overdue first', async () => {
    const d = freshDb();
    const { y, q } = await setup(d);
    const p = await addPerson({ name: 'شخص أ', title: '', position: '', email: '' }, d);

    const late5 = await createTask(input(y.id, { targetDate: '2026-11-13', ownerId: p.id }), d); // متأخرة 5
    const late10 = await createTask(input(q.id, { targetDate: '2026-11-08' }), d); // متأخرة 10
    const soon = await createTask(input(y.id, { targetDate: '2026-11-20' }), d);
    const noDate = await createTask(input(y.id, { ownerId: p.id }), d);
    const done = await createTask(input(y.id, { targetDate: '2026-11-01' }), d);
    await setTaskStatus(done.id, 'done', '2026-11-17', {}, d);

    const all = await queryTasks({ seriesId: 'all', ownerId: 'all', status: 'all' }, today, d);
    expect(all.map((r) => r.task.id)).toEqual([late10.id, late5.id, soon.id, noDate.id, done.id]);
    expect(all.map((r) => r.delay)).toEqual([10, 5, 0, 0, 0]);

    const open = await queryTasks({ seriesId: 'all', ownerId: 'all', status: 'open' }, today, d);
    expect(open).toHaveLength(4);

    const overdue = await queryTasks({ seriesId: 'all', ownerId: 'all', status: 'overdue' }, today, d);
    expect(overdue.map((r) => r.task.code)).toEqual(['Q-01', 'Y-01']);

    const mine = await queryTasks({ seriesId: y.id, ownerId: p.id, status: 'open' }, today, d);
    expect(mine.map((r) => r.task.id)).toEqual([late5.id, noDate.id]);
    expect(mine[0].owner?.name).toBe('شخص أ');
    expect(mine[0].series?.name).toBe('سلسلة ص');

    const unassigned = await queryTasks({ seriesId: 'all', ownerId: 'none', status: 'open' }, today, d);
    expect(unassigned.map((r) => r.task.id)).toEqual([late10.id, soon.id]);

    const byCode = await queryTasks({ seriesId: 'all', ownerId: 'all', status: 'all', query: 'q-01' }, today, d);
    expect(byCode.map((r) => r.task.id)).toEqual([late10.id]);

    const counts = await countByStatus({ seriesId: 'all', ownerId: 'all' }, today, d);
    expect(counts).toMatchObject({ all: 5, open: 4, overdue: 2, done: 1, not_started: 4 });
  });
});
