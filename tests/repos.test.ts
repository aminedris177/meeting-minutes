import { describe, expect, it } from 'vitest';
import { addPerson, isPersonInUse, listPeople, removePerson, updatePerson } from '../src/db/repos/people';
import {
  canDeleteSeries,
  createSeries,
  deleteSeries,
  listSeriesSummaries,
  seriesUsesPrefix,
  updateSeries,
  validateSeries,
} from '../src/db/repos/series';
import { getOrg, saveOrgLogo, saveOrgName } from '../src/db/repos/org';
import { emptySeriesDraft, isValidPrefix } from '../src/domain/series';
import { freshDb } from './helpers';

const person = { name: 'شخص أ', title: 'م.', position: 'الإنتاج', email: '' };
const draft = (over = {}) => ({ ...emptySeriesDraft(), name: 'سلسلة', taskPrefix: 'y', ...over });

describe('org', () => {
  it('starts empty and saves name and logo', async () => {
    const d = freshDb();
    expect((await getOrg(d)).name).toBe('');
    await saveOrgName('  جهة  ', d);
    await saveOrgLogo(new Blob(['x'], { type: 'image/png' }), d);
    const org = await getOrg(d);
    expect(org.name).toBe('جهة');
    expect(org.logo).toBeDefined();
    await saveOrgLogo(undefined, d);
    expect((await getOrg(d)).logo).toBeUndefined();
    expect((await getOrg(d)).name).toBe('جهة');
  });
});

describe('people', () => {
  it('adds, trims, sorts and updates', async () => {
    const d = freshDb();
    await addPerson({ ...person, name: ' شخص ب ' }, d);
    const a = await addPerson(person, d);
    expect((await listPeople(d)).map((p) => p.name)).toEqual(['شخص أ', 'شخص ب']);
    await updatePerson(a.id, { ...person, position: 'الجودة', active: false }, d);
    expect(await d.people.get(a.id)).toMatchObject({ position: 'الجودة', active: false });
  });

  it('rejects empty names', async () => {
    await expect(addPerson({ ...person, name: '  ' }, freshDb())).rejects.toThrow();
  });

  it('deletes unused people but only deactivates people used in a series', async () => {
    const d = freshDb();
    const unused = await addPerson(person, d);
    const used = await addPerson({ ...person, name: 'شخص ج' }, d);
    await createSeries(draft({ memberIds: [used.id] }), d);

    expect(await isPersonInUse(used.id, d)).toBe(true);
    expect(await removePerson(unused.id, d)).toBe('deleted');
    expect(await removePerson(used.id, d)).toBe('deactivated');
    expect(await d.people.get(unused.id)).toBeUndefined();
    expect(await d.people.get(used.id)).toMatchObject({ active: false });
  });
});

describe('series', () => {
  it('validates prefix', () => {
    expect(isValidPrefix('Y')).toBe(true);
    expect(isValidPrefix('QA2')).toBe(true);
    expect(isValidPrefix('')).toBe(false);
    expect(isValidPrefix('Y-')).toBe(false);
    expect(isValidPrefix('2Y')).toBe(false);
    expect(isValidPrefix('ABCDEFG')).toBe(false);
    expect(validateSeries(draft({ name: '', taskPrefix: '' }))).toEqual(['name', 'prefix']);
    expect(validateSeries(draft({ recurrence: { kind: 'custom', everyDays: 0 } }))).toEqual(['recurrence']);
  });

  it('creates with uppercase prefix, zero counters, cleaned topics', async () => {
    const d = freshDb();
    const s = await createSeries(draft({ defaultTopics: [' أ ', '', 'ب'], recurrence: { kind: 'weekly', everyDays: 5 } }), d);
    expect(s).toMatchObject({ taskPrefix: 'Y', taskCounter: 0, meetingCounter: 0, defaultTopics: ['أ', 'ب'], archived: false });
    expect(s.recurrence).toEqual({ kind: 'weekly' });
  });

  it('update keeps counters', async () => {
    const d = freshDb();
    const s = await createSeries(draft(), d);
    await d.series.update(s.id, { taskCounter: 42, meetingCounter: 7 });
    await updateSeries(s.id, draft({ name: 'اسم جديد', taskPrefix: 'Q' }), d);
    expect(await d.series.get(s.id)).toMatchObject({ name: 'اسم جديد', taskPrefix: 'Q', taskCounter: 42, meetingCounter: 7 });
  });

  it('detects duplicate prefixes', async () => {
    const d = freshDb();
    const s = await createSeries(draft(), d);
    expect(await seriesUsesPrefix('y', undefined, d)).toBe(true);
    expect(await seriesUsesPrefix('Y', s.id, d)).toBe(false);
    expect(await seriesUsesPrefix('Q', undefined, d)).toBe(false);
  });

  it('only deletes series without meetings or tasks', async () => {
    const d = freshDb();
    const s = await createSeries(draft(), d);
    await d.meetings.add({
      id: 'm1', seriesId: s.id, number: 1, date: '2026-11-16', topics: [], status: 'draft', notes: '', createdAt: 0, updatedAt: 0,
    });
    expect(await canDeleteSeries(s.id, d)).toBe(false);
    await expect(deleteSeries(s.id, d)).rejects.toThrow();

    const empty = await createSeries(draft({ taskPrefix: 'Q' }), d);
    await deleteSeries(empty.id, d);
    expect(await d.series.get(empty.id)).toBeUndefined();
  });

  it('summarizes open/overdue tasks and next meeting', async () => {
    const d = freshDb();
    const s = await createSeries(draft({ firstMeetingDate: '2026-11-20' }), d);
    let [sum] = await listSeriesSummaries('2026-11-18', d);
    expect(sum).toMatchObject({ openTasks: 0, overdueTasks: 0, nextMeeting: '2026-11-20', meetingsCount: 0 });

    const base = { seriesId: s.id, topic: '', description: '', ownerId: null, createdDate: '2026-11-01', priority: 'medium' as const, createdAt: 0, updatedAt: 0 };
    await d.tasks.bulkAdd([
      { ...base, id: 't1', number: 1, code: 'Y-01', status: 'in_progress', targetDate: '2026-11-10' },
      { ...base, id: 't2', number: 2, code: 'Y-02', status: 'not_started', targetDate: '2026-12-10' },
      { ...base, id: 't3', number: 3, code: 'Y-03', status: 'done', targetDate: '2026-11-01' },
    ]);
    await d.meetings.add({
      id: 'm1', seriesId: s.id, number: 1, date: '2026-11-16', nextDate: '2026-11-23', topics: [], status: 'final', notes: '', createdAt: 0, updatedAt: 0,
    });
    [sum] = await listSeriesSummaries('2026-11-18', d);
    expect(sum).toMatchObject({ openTasks: 2, overdueTasks: 1, nextMeeting: '2026-11-23', meetingsCount: 1 });
  });
});

describe('people bulk add', () => {
  it('adds new people, normalizes titles, skips existing and duplicate names', async () => {
    const { addPeopleBulk } = await import('../src/db/repos/people');
    const d = freshDb();
    await addPerson({ name: 'شخص أ', title: 'م.', position: '', email: '' }, d);
    expect((await listPeople(d))[0].title).toBe('م/');

    const res = await addPeopleBulk(
      [
        { name: 'شخص  ب', title: 'د/', position: 'قسم', email: '' },
        { name: 'شخص ا', title: '', position: '', email: '' }, // نفس «شخص أ» بعد توحيد الهمزة
        { name: 'شخص ب', title: '', position: '', email: '' }, // مكرر في نفس القائمة
        { name: '   ', title: '', position: '', email: '' },
      ],
      d,
    );
    expect(res.added.map((p) => [p.title, p.name])).toEqual([['د/', 'شخص ب']]);
    expect(res.skipped).toEqual(['شخص ا', 'شخص ب']);
    expect(await d.people.count()).toBe(2);
  });
});
