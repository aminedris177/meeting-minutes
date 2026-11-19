// @vitest-environment node
import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import readXlsxFile from 'read-excel-file/node';
import { afterEach, describe, expect, it } from 'vitest';
import { addPerson, displayName } from '../src/db/repos/people';
import { importTasks } from '../src/db/repos/importTasks';
import { createSeries } from '../src/db/repos/series';
import { addTaskUpdate, createTask, setTaskStatus } from '../src/db/repos/tasks';
import { mapStatus, parseTaskSheets, type SheetInput } from '../src/domain/excelImport';
import { emptySeriesDraft } from '../src/domain/series';
import { buildMinutesDocx } from '../src/export/docxBuild';
import { buildFollowupData } from '../src/export/followupData';
import { buildFollowupXlsx } from '../src/export/followupXlsx';
import { excelSerial } from '../src/export/xlsxWrite';
import { minutesFileName } from '../src/export/share';
import { ar } from '../src/i18n/ar';
import { en } from '../src/i18n/en';
import { setLang } from '../src/i18n';
import { freshDb } from './helpers';
import { sampleModel } from './fixtures';

afterEach(() => setLang('ar'));

// كل النصوص كقائمة مسار → قيمة
function flatten(o: unknown, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[p] = v;
    else Object.assign(out, flatten(v, p));
  }
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  const A = flatten(ar);
  const E = flatten(en);
  it('have exactly the same keys', () => {
    expect(Object.keys(E).sort()).toEqual(Object.keys(A).sort());
  });
  it('keep the same {placeholders} in every string', () => {
    for (const k of Object.keys(A)) expect(placeholders(E[k]), k).toEqual(placeholders(A[k]));
  });
  it('have no empty English strings', () => {
    for (const [k, v] of Object.entries(E)) expect(v.trim(), k).not.toBe('');
  });
  it('show titles per language', () => {
    expect(displayName({ title: 'م/', name: 'X' })).toBe('م/ X');
    setLang('en');
    expect(displayName({ title: 'م/', name: 'X' })).toBe('Eng. X');
    expect(displayName({ title: 'ك.', name: 'X' })).toBe('ك. X');
  });
  it('localizes file names', () => {
    expect(minutesFileName('S', '2026-11-17', 'pdf')).toBe('محضر_S_2026-11-17.pdf');
    setLang('en');
    expect(minutesFileName('S', '2026-11-17', 'pdf')).toBe('Minutes_S_2026-11-17.pdf');
  });
});

describe('Word export in English', () => {
  it('is left-to-right with English labels', async () => {
    setLang('en');
    const buf = await Packer.toBuffer(buildMinutesDocx({ ...sampleModel, seriesName: 'Weekly QA' }));
    const xml = strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']);
    expect(xml).not.toContain('<w:bidi/>');
    expect(xml).not.toContain('<w:bidiVisual/>');
    expect(xml).toContain('Minutes of Meeting');
    expect(xml).toContain('Review of open items');
  });
});

describe('follow-up Excel export', () => {
  async function seed() {
    const d = freshDb();
    const p = await addPerson({ name: 'شخص أ', title: 'م/', position: '', email: '' }, d);
    const s = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة', taskPrefix: 'Q' }, d);
    const base = { seriesId: s.id, topic: 'محور', ownerId: p.id, createdDate: '2026-11-01', priority: 'medium' as const };
    const late = await createTask({ ...base, description: 'متأخرة', targetDate: '2026-11-10' }, d);
    await addTaskUpdate(late.id, { text: 'تحديث', nextAction: 'مطلوب', date: '2026-11-15' }, d);
    await createTask({ ...base, description: 'من غير موعد', ownerId: null }, d);
    const done = await createTask({ ...base, description: 'خلصت' }, d);
    await setTaskStatus(done.id, 'done', '2026-11-12', {}, d);
    await addTaskUpdate(done.id, { text: 'اتنفذت', nextAction: '', date: '2026-11-12' }, d);
    return { d, s };
  }

  it('writes two RTL sheets with real dates and the follow-up columns', async () => {
    const { d, s } = await seed();
    const bytes = buildFollowupXlsx(await buildFollowupData(s.id, '2026-11-18', d));
    if (process.env.XLSX_OUT) (await import('node:fs')).writeFileSync(process.env.XLSX_OUT, bytes);
    const files = unzipSync(bytes);
    const sheet1 = strFromU8(files['xl/worksheets/sheet1.xml']);
    expect(sheet1).toContain('rightToLeft="1"');
    expect(sheet1).toContain(`<v>${excelSerial('2026-11-10')}</v>`);
    expect(strFromU8(files['xl/workbook.xml'])).toContain('name="المغلق"');
    expect(excelSerial('2026-11-10')).toBe(46336);
  });

  it('round-trips: export, read back with the importer, same tasks', async () => {
    const { d, s } = await seed();
    const bytes = buildFollowupXlsx(await buildFollowupData(s.id, '2026-11-18', d));
    const sheets = (await readXlsxFile(Buffer.from(bytes))) as unknown as SheetInput[];
    const rows = parseTaskSheets(sheets);
    expect(rows.map((r) => [r.code, r.description, r.status])).toEqual([
      ['Q-01', 'متأخرة', 'not_started'],
      ['Q-02', 'من غير موعد', 'not_started'],
      ['Q-03', 'خلصت', 'done'],
    ]);
    expect(rows[0]).toMatchObject({ createdDate: '2026-11-01', targetDate: '2026-11-10', ownerName: 'م/ شخص أ', update: 'تحديث', nextAction: 'مطلوب' });
    expect(rows[2]).toMatchObject({ closedDate: '2026-11-12', update: 'اتنفذت' });

    // استيراد في سلسلة جديدة على «جهاز تاني»
    const d2 = freshDb();
    await addPerson({ name: 'شخص أ', title: '', position: '', email: '' }, d2);
    const s2 = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة', taskPrefix: 'Q' }, d2);
    const res = await importTasks(s2.id, rows, '2026-11-18', { createMissingPeople: false }, d2);
    expect(res).toEqual({ added: 3, skipped: [], newPeople: 0 });
  });

  it('round-trips in English too', async () => {
    const { d, s } = await seed();
    setLang('en');
    const bytes = buildFollowupXlsx(await buildFollowupData(s.id, '2026-11-18', d));
    expect(strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml'])).not.toContain('rightToLeft');
    const rows = parseTaskSheets((await readXlsxFile(Buffer.from(bytes))) as unknown as SheetInput[]);
    expect(rows.map((r) => [r.code, r.status])).toEqual([
      ['Q-01', 'not_started'],
      ['Q-02', 'not_started'],
      ['Q-03', 'done'],
    ]);
    expect(mapStatus('In progress')).toBe('in_progress');
    expect(mapStatus('Waiting on others')).toBe('blocked');
    expect(mapStatus('Cancelled')).toBe('cancelled');
  });
});
