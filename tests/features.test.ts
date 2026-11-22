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
  const L = {
    greeting: 'أهلاً {name}،',
    introOne: 'عندك {n} مهمة مفتوحة في «{series}»:',
    introMany: 'عندك {n} مهمة مفتوحة:',
    code: 'رقم المهمة: {code}',
    status: 'الحالة: {status}',
    late: '⚠️ متأخرة {n} يوم (كان موعدها {date})',
    due: 'الموعد: {date}',
    noDate: 'الموعد: لسه متحددش',
    next: 'الاجتماع القادم: {date}',
    closing: 'برجاء إرسال آخر تحديث قبل الاجتماع القادم.',
    statuses: { not_started: 'لم يبدأ', in_progress: 'جارٍ', blocked: 'معلّق', done: 'تم', cancelled: 'ملغي' } as const,
    formatDate: (d: string) => d.split('-').reverse().join('/'),
  };
  const strip = (x: string) => x.replace(/[\u200E\u200F]/g, '');

  it('one series: lines per task, most late first, next meeting and closing line', () => {
    const msg = ownerMessage(
      'م/ شخص',
      [task({ code: 'Q-02', description: 'تانية', targetDate: '2026-11-30' }), task({ code: 'Q-01', description: 'أولى', targetDate: '2026-11-09' }), task({ code: 'Q-03', status: 'done' })],
      { s: { name: 'اجتماع الجودة', nextDate: '2026-11-26' } },
      TODAY,
      L,
      true,
    );
    const plain = strip(msg);
    expect(plain).toContain('أهلاً م/ شخص،');
    expect(plain).toContain('عندك 2 مهمة مفتوحة في «اجتماع الجودة»:');
    expect(plain).toContain('1- *أولى*');
    expect(plain).toContain('رقم المهمة: Q-01');
    expect(plain).toContain('⚠️ متأخرة 10 يوم (كان موعدها 09/11/2026)');
    expect(plain).toContain('الموعد: 30/11/2026');
    expect(plain.indexOf('Q-01')).toBeLessThan(plain.indexOf('Q-02'));
    expect(plain).not.toContain('Q-03');
    expect(plain).toContain('الاجتماع القادم: 26/11/2026');
    expect(plain.trim().endsWith('برجاء إرسال آخر تحديث قبل الاجتماع القادم.')).toBe(true);
    // كل سطر مش فاضي بيبدأ بعلامة يمين-لشمال، والكود معزول بعلامة شمال-ليمين
    expect(msg.split('\n').filter(Boolean).every((x) => x.startsWith('\u200F'))).toBe(true);
    expect(msg).toContain('\u200EQ-01\u200E');
  });

  it('several series: grouped with each series name and next meeting; English has no direction marks', () => {
    const msg = ownerMessage(
      'Eng. Person',
      [task({ code: 'A-01', seriesId: 'a', targetDate: '2026-11-25' }), task({ code: 'B-01', seriesId: 'b' })],
      { a: { name: 'Series A', nextDate: '2026-11-24' }, b: { name: 'Series B' } },
      TODAY,
      { ...L, introMany: 'You have {n} open tasks:', next: 'Next meeting: {date}' },
      false,
    );
    expect(msg).not.toMatch(/[\u200E\u200F]/);
    expect(msg).toContain('You have 2 open tasks:');
    expect(msg).toContain('*Series A*\nNext meeting: 24/11/2026');
    expect(msg).toContain('*Series B*');
    expect(msg.indexOf('Series A')).toBeLessThan(msg.indexOf('Series B'));
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
