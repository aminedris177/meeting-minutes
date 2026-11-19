import { Packer } from 'docx';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { MinutesModel } from '../src/db/types';
import { sampleModel } from './fixtures';
import { buildMinutesDocx } from '../src/export/docxBuild';
import { minutesFileName, safeFileName } from '../src/export/share';



async function documentXml(model: MinutesModel): Promise<string> {
  // للمراجعة البصرية: DOCX_LOGO = مسار صورة PNG تتحط كلوجو
  const logoPath = process.env.DOCX_LOGO;
  const logo = logoPath ? { data: new Uint8Array(readFileSync(logoPath)), type: 'png' as const, width: 512, height: 512 } : undefined;
  const buf = await Packer.toBuffer(buildMinutesDocx(model, logo));
  if (process.env.DOCX_OUT) writeFileSync(process.env.DOCX_OUT, buf);
  return strFromU8(unzipSync(new Uint8Array(buf))['word/document.xml']);
}

describe('Word export', () => {
  it('builds an A4 RTL document with all sections', async () => {
    const xml = await documentXml(sampleModel);
    expect(xml).toContain('w:w="11906"'); // A4
    expect(xml).toContain('<w:bidi/>'); // فقرات RTL
    expect(xml).toContain('<w:bidiVisual/>'); // جداول RTL
    expect(xml).toContain('<w:rtl/>');
    for (const text of ['محضر اجتماع', 'اجتماع الجودة الأسبوعي', 'جهة تجريبية', '17/11/2026', '24/11/2026', 'الحضور', 'مراجعة البنود', 'القرارات', 'المهام الجديدة', 'المواصفات المعتمدة', 'التوقيعات', 'Q-100', '☑', '☐', 'متأخرة 7 يوم']) {
      expect(xml, text).toContain(text);
    }
    expect(xml).toContain('w:fill="1F3864"'); // اللون الأساسي
    expect(xml).toContain('w:fill="0E7C86"'); // الثانوي
    expect(xml).toContain('w:ascii="Arial"');
    expect(xml).not.toContain('مسودة'); // نهائي
  });

  it('hides sections that are turned off and marks drafts', async () => {
    const xml = await documentXml({
      ...sampleModel,
      status: 'draft',
      sections: { decisions: false, newTasks: false, register: false, signatures: false },
    });
    expect(xml).not.toContain('القرارات');
    expect(xml).not.toContain('المهام الجديدة');
    expect(xml).not.toContain('المواصفات المعتمدة');
    expect(xml).not.toContain('التوقيعات');
    expect(xml).toContain('مسودة');
  });
});

describe('file names', () => {
  it('follows محضر_{series}_{YYYY-MM-DD}', () => {
    expect(minutesFileName('اجتماع الجودة الأسبوعي', '2026-11-17', 'docx')).toBe('محضر_اجتماع_الجودة_الأسبوعي_2026-11-17.docx');
    expect(safeFileName('a/b:c?"d"')).toBe('a-b-c-d');
  });
});
