// @vitest-environment node
// بيئة Node: Blob حقيقي يتخزن في IndexedDB (زي المتصفح) — jsdom Blob مبيتنسخش صح
import { describe, expect, it } from 'vitest';
import {
  backupSummary,
  exportBackup,
  exportSeriesFile,
  getSafetySnapshot,
  importSeriesFile,
  listSafetySnapshots,
  parseBackup,
  parseSeriesFile,
  restoreBackup,
  safeRestore,
  type BackupFile,
} from '../src/db/backup';
import { createMeeting, finalizeMeeting, saveMeetingUpdate } from '../src/db/repos/meetings';
import { saveOrgLogo, saveOrgName, getOrg } from '../src/db/repos/org';
import { addPerson } from '../src/db/repos/people';
import { createSeries } from '../src/db/repos/series';
import { getSetting, SETTING, setSetting } from '../src/db/repos/settings';
import { createTask, setTaskStatus } from '../src/db/repos/tasks';
import { LATEST_VERSION } from '../src/db/schema';
import { emptySeriesDraft } from '../src/domain/series';
import type { AppDB } from '../src/db/schema';
import { freshDb } from './helpers';

async function seed(d: AppDB) {
  await saveOrgName('جهة', d);
  await saveOrgLogo(new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3, 255])], { type: 'image/png' }), d);
  const p = await addPerson({ name: 'شخص أ', title: 'م/', position: 'قسم', email: 'a@example.test' }, d);
  const s = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة', taskPrefix: 'Q', memberIds: [p.id], defaultTopics: ['محور'], registerName: 'سجل' }, d);
  const t = await createTask({ seriesId: s.id, description: 'مهمة', topic: 'محور', ownerId: p.id, createdDate: '2026-11-01', priority: 'high', targetDate: '2026-11-10' }, d);
  const m = await createMeeting(s.id, '2026-11-17', d);
  await saveMeetingUpdate(m, t.id, 'تحديث', 'مطلوب', d);
  await setTaskStatus(t.id, 'in_progress', m.date, { meetingId: m.id }, d);
  await finalizeMeeting(m.id, d);
  await setSetting('lang', 'ar', d);
  return { p, s, t, m };
}

const roundTrip = (b: BackupFile) => {
  const parsed = parseBackup(JSON.stringify(b));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.backup;
};

describe('backup & restore', () => {
  it('round-trips every table, including the logo, through JSON', async () => {
    const src = freshDb();
    const { s, t, m } = await seed(src);
    const backup = roundTrip(await exportBackup('9.9.9', src));
    expect(backup).toMatchObject({ format: 'meeting-minutes-backup', schemaVersion: LATEST_VERSION, appVersion: '9.9.9' });
    expect(backupSummary(backup)).toEqual({ series: 1, people: 1, meetings: 1, tasks: 1 });

    const dst = freshDb();
    await restoreBackup(backup, dst);
    expect((await dst.series.get(s.id))!).toMatchObject({ name: 'سلسلة', taskPrefix: 'Q', taskCounter: 1, meetingCounter: 1 });
    expect((await dst.tasks.get(t.id))!).toMatchObject({ code: 'Q-01', status: 'in_progress', priority: 'high' });
    expect(await dst.taskUpdates.count()).toBe(2);
    expect((await dst.meetings.get(m.id))!.snapshot?.review[0]).toMatchObject({ code: 'Q-01', update: 'تحديث' });
    expect(await dst.attendance.count()).toBe(1);
    expect(await getSetting('lang', dst)).toBe('ar');

    const org = await getOrg(dst);
    expect(org.name).toBe('جهة');
    expect(org.logo?.type).toBe('image/png');
    expect([...new Uint8Array(await org.logo!.arrayBuffer())]).toEqual([137, 80, 78, 71, 1, 2, 3, 255]);
  });

  it('replaces existing data but keeps device settings (PIN, last backup)', async () => {
    const src = freshDb();
    await seed(src);
    const backup = roundTrip(await exportBackup('1', src));

    const dst = freshDb();
    await addPerson({ name: 'بيانات قديمة', title: '', position: '', email: '' }, dst);
    await setSetting(SETTING.pin, { salt: 'x', hash: 'y', iterations: 1 }, dst);
    await setSetting(SETTING.lastBackupAt, '2026-01-01', dst);
    await restoreBackup(backup, dst);
    expect((await dst.people.toArray()).map((p) => p.name)).toEqual(['شخص أ']);
    expect(await getSetting(SETTING.pin, dst)).toEqual({ salt: 'x', hash: 'y', iterations: 1 });
    expect(await getSetting(SETTING.lastBackupAt, dst)).toBe('2026-01-01');
  });

  it('does not put the PIN into the backup', async () => {
    const d = freshDb();
    await setSetting(SETTING.pin, { salt: 'x', hash: 'y', iterations: 1 }, d);
    const b = await exportBackup('1', d);
    expect(JSON.stringify(b)).not.toContain('"hash":"y"');
  });

  it('rejects invalid, foreign and newer-version files', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'not-json' });
    expect(parseBackup('{"format":"other"}')).toEqual({ ok: false, error: 'wrong-format' });
    expect(parseBackup(JSON.stringify({ format: 'meeting-minutes-backup', schemaVersion: LATEST_VERSION + 1, tables: {} }))).toEqual({ ok: false, error: 'newer-version' });
    expect(parseBackup(JSON.stringify({ format: 'meeting-minutes-backup', schemaVersion: 1, tables: { people: 'x' } }))).toEqual({ ok: false, error: 'corrupt' });
  });

  it('saves a safety snapshot of the current data before restoring', async () => {
    const d = freshDb();
    await addPerson({ name: 'قبل الاسترجاع', title: '', position: '', email: '' }, d);
    const other = freshDb();
    await seed(other);
    await safeRestore(roundTrip(await exportBackup('1', other)), '1', d);
    expect((await d.people.toArray()).map((p) => p.name)).toEqual(['شخص أ']);

    const [latest] = await listSafetySnapshots();
    expect(latest.reason).toBe('before-restore');
    const snap = await getSafetySnapshot(latest.id!);
    expect((snap!.tables.people as { name: string }[]).map((p) => p.name)).toEqual(['قبل الاسترجاع']);
    // التراجع: استرجاع نسخة الأمان
    await restoreBackup(snap!, d);
    expect((await d.people.toArray()).map((p) => p.name)).toEqual(['قبل الاسترجاع']);
  });
});

describe('single series transfer', () => {
  it('exports settings only and imports reusing existing people by name', async () => {
    const src = freshDb();
    const { s } = await seed(src);
    const file = parseSeriesFile(JSON.stringify(await exportSeriesFile(s.id, src)))!;
    expect(file.series).toMatchObject({ name: 'سلسلة', taskPrefix: 'Q', defaultTopics: ['محور'], registerName: 'سجل' });
    expect(file.members).toEqual([{ name: 'شخص أ', title: 'م/', position: 'قسم', email: 'a@example.test' }]);
    expect(JSON.stringify(file)).not.toContain('مهمة');

    const dst = freshDb();
    const existing = await addPerson({ name: 'شخص ا', title: '', position: '', email: '' }, dst); // نفس الاسم من غير همزة
    const { series, addedPeople } = await importSeriesFile(file, dst);
    expect(addedPeople).toBe(0);
    expect(series.memberIds).toEqual([existing.id]);
    expect(series).toMatchObject({ taskCounter: 0, meetingCounter: 0, archived: false });
    expect(parseSeriesFile('{"format":"x"}')).toBeNull();
  });
});
