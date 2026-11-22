// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compareBackup, exportBackup } from '../src/db/backup';
import { mergeTopics } from '../src/db/repos/meetings';
import { listTemplates, removeTemplate, saveTemplate } from '../src/db/repos/templates';
import type { Task } from '../src/db/types';
import { dueGroup, groupByDue, ownerMessage, ownerStats } from '../src/domain/followup';
import { matchesQuery, normalizeSearch } from '../src/domain/search';
import { freshDb } from './helpers';

// 2026-11-19 خميس → الأسبوع (سبت→جمعة) بينتهي 2026-11-20
const TODAY = '2026-11-19';
const task = (p: Partial<Task>): Task =>
  ({ id: Math.random().toString(36), seriesId: 's', number: 1, code: 'Q-01', topic: '', description: 'd', ownerId: null, createdDate: TODAY, priority: 'medium', status: 'in_progress', createdAt: 0, updatedAt: 0, ...p }) as Task;

describe('due groups', () => {
  it('classifies by target date and status', () => {
    expect(dueGroup(task({ targetDate: '2026-11-10' }), TODAY)).toBe('overdue');
    expect(dueGroup(task({ targetDate: TODAY }), TODAY)).toBe('today');
    expect(dueGroup(task({ targetDate: '2026-11-20' }), TODAY)).toBe('week');
    expect(dueGroup(task({ targetDate: '2026-11-21' }), TODAY)).toBe('later');
    expect(dueGroup(task({}), TODAY)).toBe('noDate');
    expect(dueGroup(task({ status: 'done', targetDate: '2026-11-01' }), TODAY)).toBe('closed');
  });
  it('keeps order inside groups and drops empty groups', () => {
    const rows = [task({ code: 'A', targetDate: '2026-12-01' }), task({ code: 'B', targetDate: '2026-11-01' }), task({ code: 'C', targetDate: '2026-12-05' })].map((t) => ({ task: t }));
    const g = groupByDue(rows, TODAY);
    expect(g.map((x) => x.group)).toEqual(['overdue', 'later']);
    expect(g[1].rows.map((r) => r.task.code)).toEqual(['A', 'C']);
  });
});

describe('owner message and stats', () => {
  it('lists open tasks, most late first', () => {
    const msg = ownerMessage(
      'م/ شخص',
      [task({ code: 'Q-02', targetDate: '2026-11-30' }), task({ code: 'Q-01', targetDate: '2026-11-09' }), task({ code: 'Q-03', status: 'done' })],
      TODAY,
      { greeting: 'أهلاً {name}،', intro: 'مهامك ({n}):', late: 'متأخرة {n} يوم', due: 'الموعد {date}', noDate: '-', statuses: { not_started: 'لم يبدأ', in_progress: 'جارٍ', blocked: 'معلّق', done: 'تم', cancelled: 'ملغي' }, formatDate: (d) => d },
    );
    expect(msg).toContain('أهلاً م/ شخص،');
    expect(msg).toContain('مهامك (2):');
    expect(msg.indexOf('Q-01')).toBeLessThan(msg.indexOf('Q-02'));
    expect(msg).toContain('متأخرة 10 يوم');
    expect(msg).not.toContain('Q-03');
  });
  it('counts open, overdue, closed and on-time per owner', () => {
    const s = ownerStats(
      [
        task({ ownerId: 'a', targetDate: '2026-11-10' }),
        task({ ownerId: 'a', targetDate: '2026-12-10' }),
        task({ ownerId: 'a', status: 'done', targetDate: '2026-11-10', closedDate: '2026-11-08' }),
        task({ ownerId: 'a', status: 'done', targetDate: '2026-11-10', closedDate: '2026-11-15' }),
        task({ ownerId: null }),
      ],
      TODAY,
    );
    expect(s[0]).toMatchObject({ ownerId: 'a', open: 2, overdue: 1, closed: 2, onTime: 1, avgDelay: 9 });
    expect(s[1]).toMatchObject({ ownerId: null, open: 1, overdue: 0 });
  });
});

describe('search normalization', () => {
  it('ignores hamza, ta marbuta, case and word order', () => {
    expect(normalizeSearch('إضافة PIN')).toBe('اضافه pin');
    expect(matchesQuery('الإعدادات ← «تفعيل القفل»', 'القفل اعدادات')).toBe(true);
    expect(matchesQuery('Settings → Turn on lock', 'excel')).toBe(false);
  });
});

describe('topics and templates', () => {
  it('merges topics without duplicates or blanks', () => {
    expect(mergeTopics(['أ', '', 'ب'], ['ب', 'ج '])).toEqual(['أ', 'ب', 'ج']);
  });
  it('saves, updates by description and removes templates', async () => {
    const d = freshDb();
    const a = await saveTemplate({ description: ' مراجعة ', topic: 'ت', ownerId: null, priority: 'high' }, d);
    await saveTemplate({ description: 'مراجعة', topic: 'ت2', ownerId: null, priority: 'low' }, d);
    let list = await listTemplates(d);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: a.id, topic: 'ت2', priority: 'low' });
    await removeTemplate(a.id, d);
    list = await listTemplates(d);
    expect(list).toHaveLength(0);
  });
});

describe('restore comparison', () => {
  it('shows counts, lost series and changes newer than the backup', async () => {
    const d = freshDb();
    await d.series.add({ id: 's1', name: 'قديمة', updatedAt: 1 } as never);
    const backup = await exportBackup('t', d);
    backup.exportedAt = new Date(1000).toISOString();
    await d.series.add({ id: 's2', name: 'جديدة', updatedAt: Date.now() } as never);
    const diff = await compareBackup(backup, d);
    expect(diff.counts.find((c) => c.kind === 'series')).toEqual({ kind: 'series', current: 2, incoming: 1 });
    expect(diff.seriesLost).toEqual(['جديدة']);
    expect(diff.seriesNew).toEqual([]);
    expect(diff.newerLocal).toBe(1);
  });
});
