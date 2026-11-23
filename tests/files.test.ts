// @vitest-environment node
// الملفات المصدّرة: الحفظ والقايمة والمسح ومسح القديم، ومش بتدخل في النسخة الاحتياطية.
import { beforeEach, describe, expect, it } from 'vitest';
import { exportBackup } from '../src/db/backup';
import { clearAllFiles, deleteFiles, deleteFilesOlderThan, getFileBlob, listFiles, saveExportedFile, useFilesDbName } from '../src/db/files';
import { freshDb, freshDbName } from './helpers';

beforeEach(() => useFilesDbName(freshDbName()));

describe('exported files', () => {
  it('saves a copy with its metadata and returns the same bytes', async () => {
    const id = await saveExportedFile(new Blob(['محضر'], { type: 'application/pdf' }), 'محضر_س_2026-11-22.pdf', { kind: 'minutes', seriesName: 'س' });
    const list = await listFiles();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id, name: 'محضر_س_2026-11-22.pdf', kind: 'minutes', seriesName: 'س', type: 'application/pdf' });
    expect(list[0].size).toBeGreaterThan(0);
    expect('data' in list[0]).toBe(false);
    const f = await getFileBlob(id);
    expect(await f!.blob.text()).toBe('محضر');
  });

  it('lists newest first, deletes selected and files older than N days', async () => {
    const a = await saveExportedFile(new Blob(['a']), 'a.pdf', { kind: 'followup' });
    const b = await saveExportedFile(new Blob(['b']), 'b.pdf', { kind: 'backup' });
    expect((await listFiles()).map((x) => x.id)).toEqual([b, a]);
    await deleteFiles([a]);
    expect((await listFiles()).map((x) => x.id)).toEqual([b]);
    // «بعد 100 يوم»: كل الملفات أقدم من 90 يوم
    expect(await deleteFilesOlderThan(90, Date.now() + 100 * 86_400_000)).toBe(1);
    expect(await listFiles()).toHaveLength(0);
  });

  it('keeps recent files when deleting old ones, and clearAll empties the list', async () => {
    await saveExportedFile(new Blob(['x']), 'x.xlsx', { kind: 'followup' });
    expect(await deleteFilesOlderThan(90)).toBe(0);
    await clearAllFiles();
    expect(await listFiles()).toHaveLength(0);
  });

  it('is not part of the backup file', async () => {
    await saveExportedFile(new Blob(['x']), 'x.pdf', { kind: 'minutes' });
    const backup = await exportBackup('t', freshDb());
    expect(Object.keys(backup.tables)).not.toContain('files');
  });
});

describe('splitFileName', () => {
  it('splits base, date and extension', async () => {
    const { splitFileName } = await import('../src/screens/settings/ExportedFiles');
    expect(splitFileName('محضر_اجتماع_الجودة_2026-11-22.pdf')).toEqual({ base: 'محضر اجتماع الجودة', date: '2026-11-22', ext: 'PDF' });
    expect(splitFileName('Backup_MeetingMinutes_2026-11-23.json')).toEqual({ base: 'Backup MeetingMinutes', date: '2026-11-23', ext: 'JSON' });
    expect(splitFileName('file.ics')).toEqual({ base: 'file', date: '', ext: 'ICS' });
  });
});
