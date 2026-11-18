// اختبارات الترقية: البيانات القديمة لازم تفضل سليمة بعد أي نسخة جديدة.
// مع كل نسخة schema جديدة: ضيف اختبار «افتح على النسخة القديمة ← ضيف بيانات ← افتح على الجديدة ← اتأكد».
import { describe, expect, it } from 'vitest';
import { AppDB, LATEST_VERSION, SCHEMA_VERSIONS } from '../src/db/schema';
import { emptySeriesDraft } from '../src/domain/series';
import { createSeries } from '../src/db/repos/series';
import { addPerson } from '../src/db/repos/people';
import { freshDbName } from './helpers';

describe('schema versions', () => {
  it('are strictly increasing and never removed', () => {
    const versions = SCHEMA_VERSIONS.map((v) => v.version);
    expect(versions[0]).toBe(1);
    versions.forEach((v, i) => i > 0 && expect(v).toBeGreaterThan(versions[i - 1]));
    expect(LATEST_VERSION).toBe(versions[versions.length - 1]);
  });

  it('every version declares all tables known so far (no table dropped)', () => {
    const seen = new Set<string>();
    for (const v of SCHEMA_VERSIONS) {
      for (const [table, def] of Object.entries(v.stores)) {
        expect(def, `table ${table} dropped in v${v.version}`).not.toBeNull();
        seen.add(table);
      }
    }
    expect([...seen]).toEqual(
      expect.arrayContaining(['org', 'people', 'series', 'meetings', 'attendance', 'tasks', 'taskUpdates', 'decisions', 'registerItems', 'settings']),
    );
  });
});

describe('upgrade from every older version to latest preserves data', () => {
  for (const { version } of SCHEMA_VERSIONS) {
    it(`v${version} → v${LATEST_VERSION}`, async () => {
      const name = freshDbName();

      const old = new AppDB(name, version);
      const person = await addPerson({ name: 'شخص تجريبي', title: 'م.', position: 'قسم', email: '' }, old);
      const series = await createSeries(
        { ...emptySeriesDraft(), name: 'سلسلة تجريبية', taskPrefix: 'T', memberIds: [person.id], defaultTopics: ['محور'] },
        old,
      );
      await old.settings.put({ key: 'lastBackupAt', value: 123 });
      old.close();

      const upgraded = new AppDB(name);
      await upgraded.open();
      expect(upgraded.verno).toBe(LATEST_VERSION);
      expect(await upgraded.people.get(person.id)).toMatchObject({ name: 'شخص تجريبي', title: 'م/' });
      expect(await upgraded.series.get(series.id)).toMatchObject({
        name: 'سلسلة تجريبية',
        taskPrefix: 'T',
        memberIds: [person.id],
        defaultTopics: ['محور'],
      });
      expect(await upgraded.settings.get('lastBackupAt')).toEqual({ key: 'lastBackupAt', value: 123 });
      upgraded.close();
    });
  }
});
