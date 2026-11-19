import { describe, expect, it } from 'vitest';
import { importTasks } from '../src/db/repos/importTasks';
import { addPerson } from '../src/db/repos/people';
import { createSeries } from '../src/db/repos/series';
import { listTaskUpdates } from '../src/db/repos/tasks';
import { cellToDate, mapStatus, parseTaskSheets, type SheetInput } from '../src/domain/excelImport';
import { emptySeriesDraft } from '../src/domain/series';
import { hashPin, isValidPin, verifyPin } from '../src/lib/pin';
import { freshDb } from './helpers';

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));

// نفس شكل ملف المتابعة: صفوف ملخص فوق، وبعدين العناوين، وشيت للمغلق
const sheets: SheetInput[] = [
  {
    sheet: 'المتابعة',
    data: [
      ['ملف متابعة', null, null],
      ['لم يبدأ', 2, 'جارٍ', 8, 'معلّق', 0, 'متأخرة', 0, 'تم (مغلقة)', 2],
      [],
      [null],
      ['الرقم', 'المحور', 'المهمة', 'المسؤول', 'تاريخ الإدراج', 'الموعد المستهدف', 'الحالة', 'تأخير (يوم)', 'آخر تحديث', 'المطلوب للاجتماع القادم'],
      ['Y-01', 'محور أ', 'مهمة أولى', 'م/ شخص أ', utc(2026, 1, 5), utc(2026, 2, 1), 'جارٍ', null, 'تحديث ١', 'مطلوب ١'],
      ['Y-03', 'محور ب', 'مهمة تالتة', 'شخص جديد', utc(2026, 1, 6), null, 'لم يبدأ', null, null, null],
      [null, null, null, null, null, null, null, null, null, null],
      ['', 'محور ب', 'مهمة من غير رقم', '', '15/03/2026', '١/٤/٢٠٢٦', 'معلّق على طرف آخر', null, '', ''],
    ],
  },
  {
    sheet: 'المغلق',
    data: [
      [],
      [],
      ['الرقم', 'المحور', 'المهمة', 'المسؤول', 'الحالة', 'تاريخ الإغلاق', 'النتيجة / آخر تحديث'],
      ['Y-02', 'محور أ', 'مهمة مقفولة', 'شخص أ', 'تم', utc(2026, 1, 20), 'اتنفذت'],
    ],
  },
  { sheet: 'طريقة الاستخدام', data: [['شرح'], ['نص']] },
];

describe('Excel parsing', () => {
  it('finds the header row by column names and reads every sheet', () => {
    const rows = parseTaskSheets(sheets);
    expect(rows.map((r) => [r.code, r.description, r.status, r.sheet])).toEqual([
      ['Y-01', 'مهمة أولى', 'in_progress', 'المتابعة'],
      ['Y-03', 'مهمة تالتة', 'not_started', 'المتابعة'],
      [undefined, 'مهمة من غير رقم', 'blocked', 'المتابعة'],
      ['Y-02', 'مهمة مقفولة', 'done', 'المغلق'],
    ]);
    expect(rows[0]).toMatchObject({ createdDate: '2026-01-05', targetDate: '2026-02-01', update: 'تحديث ١', nextAction: 'مطلوب ١', ownerName: 'م/ شخص أ', row: 6 });
    expect(rows[2]).toMatchObject({ createdDate: '2026-03-15', targetDate: '2026-04-01' });
    expect(rows[3]).toMatchObject({ closedDate: '2026-01-20', update: 'اتنفذت' });
  });

  it('maps status text and dates', () => {
    expect(mapStatus('تم (مغلقة)')).toBe('done');
    expect(mapStatus('ملغي')).toBe('cancelled');
    expect(mapStatus('معلق')).toBe('blocked');
    expect(mapStatus('جاري')).toBe('in_progress');
    expect(mapStatus('')).toBe('not_started');
    expect(cellToDate(utc(2026, 12, 31))).toBe('2026-12-31');
    expect(cellToDate('31/12/2026')).toBe('2026-12-31');
    expect(cellToDate('bad')).toBeUndefined();
  });
});

describe('importTasks', () => {
  it('keeps codes, numbers new ones after them, matches owners, logs updates', async () => {
    const d = freshDb();
    const a = await addPerson({ name: 'شخص أ', title: 'م/', position: '', email: '' }, d);
    const s = await createSeries({ ...emptySeriesDraft(), name: 'سلسلة', taskPrefix: 'Y' }, d);
    const res = await importTasks(s.id, parseTaskSheets(sheets), '2026-11-19', { createMissingPeople: true }, d);
    expect(res).toEqual({ added: 4, skipped: [], newPeople: 1 });

    const tasks = (await d.tasks.where('seriesId').equals(s.id).toArray()).sort((x, y) => x.number - y.number);
    expect(tasks.map((t) => t.code)).toEqual(['Y-01', 'Y-02', 'Y-03', 'Y-04']);
    expect(tasks[0].ownerId).toBe(a.id);
    expect(tasks[1]).toMatchObject({ status: 'done', closedDate: '2026-01-20', ownerId: a.id });
    expect(tasks[3]).toMatchObject({ description: 'مهمة من غير رقم', ownerId: null, status: 'blocked' });
    expect((await d.series.get(s.id))!.taskCounter).toBe(4);
    expect((await listTaskUpdates(tasks[0].id, d))[0]).toMatchObject({ text: 'تحديث ١', nextAction: 'مطلوب ١' });

    // استيراد تاني لنفس الملف: الأكواد الموجودة بتتخطّى
    const again = await importTasks(s.id, parseTaskSheets(sheets).filter((r) => r.code), '2026-11-19', { createMissingPeople: false }, d);
    expect(again).toEqual({ added: 0, skipped: ['Y-01', 'Y-02', 'Y-03'], newPeople: 0 });
  });
});

describe('PIN', () => {
  it('validates format', () => {
    expect(isValidPin('1234')).toBe(true);
    expect(isValidPin('12345678')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
  });

  it('stores a salted hash, not the PIN, and verifies it', async () => {
    const stored = await hashPin('2468');
    expect(JSON.stringify(stored)).not.toContain('2468');
    expect(await verifyPin('2468', stored)).toBe(true);
    expect(await verifyPin('2469', stored)).toBe(false);
    // الطول بيتخزن علشان الفتح التلقائي بعد آخر رقم
    expect(stored.length).toBe(4);
    expect((await hashPin('123456')).length).toBe(6);
    const other = await hashPin('2468');
    expect(other.salt).not.toBe(stored.salt);
    expect(other.hash).not.toBe(stored.hash);
  });
});
