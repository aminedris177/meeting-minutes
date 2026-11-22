// استيراد مهام من جدول Word (.docx): الأعمدة بالاسم، والخلايا المدموجة.
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { readDocxTables } from '../src/domain/docxTables';
import { parseTaskSheets } from '../src/domain/excelImport';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
type C = string | { t?: string; span?: number; vmerge?: 'restart' | 'continue' };
const cell = (c: C) => {
  const o = typeof c === 'string' ? { t: c } : c;
  const pr = [o.span ? `<w:gridSpan w:val="${o.span}"/>` : '', o.vmerge === 'restart' ? '<w:vMerge w:val="restart"/>' : o.vmerge ? '<w:vMerge/>' : ''].join('');
  return `<w:tc>${pr ? `<w:tcPr>${pr}</w:tcPr>` : ''}<w:p><w:r><w:t>${esc(o.t ?? '')}</w:t></w:r></w:p></w:tc>`;
};
const table = (rows: C[][]) => `<w:tbl>${rows.map((r) => `<w:tr>${r.map(cell).join('')}</w:tr>`).join('')}</w:tbl>`;
function docx(body: string): Uint8Array {
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>${body}</w:body></w:document>`;
  return zipSync({ '[Content_Types].xml': strToU8('<Types/>'), 'word/document.xml': strToU8(xml) });
}

describe('Word (.docx) task import', () => {
  it('reads the follow-up table by column names, with merged cells and the closed table', () => {
    const bytes = docx(
      `<w:p><w:r><w:t>ملف المتابعة</w:t></w:r></w:p>` +
        table([
          [{ t: 'ملف المتابعة — عنوان مدموج', span: 6 }],
          ['الرقم', 'المحور', 'المهمة', 'المسؤول', 'الموعد المستهدف', 'الحالة'],
          ['Y-01', { t: 'محور أ', vmerge: 'restart' }, 'مهمة أولى', 'أستاذة شخص', '01/12/2026', 'جارٍ'],
          ['Y-02', { vmerge: 'continue' }, 'مهمة تانية', '', '', 'لم يبدأ'],
        ]) +
        `<w:p><w:r><w:t>المغلق</w:t></w:r></w:p>` +
        table([
          ['الرقم', 'المهمة', 'المسؤول', 'الحالة', 'تاريخ الإغلاق'],
          ['Y-03', 'مهمة مقفولة', 'شخص', 'تم', '20/11/2026'],
        ]),
    );
    const sheets = readDocxTables(bytes);
    expect(sheets).toHaveLength(2);
    // الخلية المدموجة أفقياً بتاخد أماكن فاضية علشان الأعمدة متتزحزحش
    expect(sheets[0].data[0]).toHaveLength(6);
    const tasks = parseTaskSheets(sheets);
    expect(tasks.map((x) => x.code)).toEqual(['Y-01', 'Y-02', 'Y-03']);
    expect(tasks[0]).toMatchObject({ topic: 'محور أ', description: 'مهمة أولى', ownerName: 'أستاذة شخص', targetDate: '2026-12-01', status: 'in_progress' });
    // المدموجة رأسياً بتاخد قيمة اللي فوقها
    expect(tasks[1]).toMatchObject({ topic: 'محور أ', status: 'not_started' });
    expect(tasks[2]).toMatchObject({ status: 'done', closedDate: '2026-11-20' });
  });

  it('joins multi-paragraph cells and ignores documents without tables', () => {
    const multi = docx(
      `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>No.</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Task</w:t></w:r></w:p></w:tc></w:tr>` +
        `<w:tr><w:tc><w:p><w:r><w:t>QA-07</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Line one</w:t></w:r></w:p><w:p><w:r><w:t>line two</w:t></w:r></w:p></w:tc></w:tr></w:tbl>`,
    );
    expect(parseTaskSheets(readDocxTables(multi))).toMatchObject([{ code: 'QA-07', description: 'Line one line two' }]);
    expect(readDocxTables(docx('<w:p><w:r><w:t>نص من غير جدول</w:t></w:r></w:p>'))).toEqual([]);
  });

  it('rejects files that are not Word documents', () => {
    expect(() => readDocxTables(zipSync({ 'x.txt': strToU8('x') }))).toThrow();
  });
});
