// قراءة الجداول من ملف Word (.docx) على الموبايل: كل جدول بيتحول لشيت (صفوف × أعمدة نص)،
// علشان يتقري بنفس منطق استيراد Excel (الأعمدة بتتعرف بالاسم).
import { strFromU8, unzipSync } from 'fflate';
import type { Cell, SheetInput } from './excelImport';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

/** العناصر المباشرة بالاسم ده (من غير الجداول المتداخلة). */
const kids = (el: Element, name: string) => Array.from(el.children).filter((c) => c.namespaceURI === W && c.localName === name);

function cellText(tc: Element): string {
  const paras: string[] = [];
  for (const p of Array.from(tc.getElementsByTagNameNS(W, 'p'))) {
    let s = '';
    for (const n of Array.from(p.getElementsByTagNameNS(W, '*'))) {
      if (n.localName === 't') s += n.textContent ?? '';
      else if (n.localName === 'tab' || n.localName === 'br') s += ' ';
    }
    if (s.trim()) paras.push(s.trim());
  }
  return paras.join(' ');
}

const attr = (el: Element | undefined, name: string) => el?.getAttributeNS(W, name) ?? el?.getAttribute(`w:${name}`) ?? null;

/** جدول Word → صفوف. الخلايا المدموجة أفقياً بتاخد أماكن فاضية، والمدموجة رأسياً بتاخد قيمة اللي فوقها. */
function tableRows(tbl: Element): Cell[][] {
  const rows: string[][] = [];
  for (const tr of kids(tbl, 'tr')) {
    const row: string[] = [];
    for (const tc of kids(tr, 'tc')) {
      const pr = kids(tc, 'tcPr')[0];
      const span = Number(attr(pr ? kids(pr, 'gridSpan')[0] : undefined, 'val') ?? 1) || 1;
      const vMerge = pr ? kids(pr, 'vMerge')[0] : undefined;
      const col = row.length;
      // vMerge من غير val (أو continue) = كمّلة للخلية اللي فوق
      const cont = vMerge && attr(vMerge, 'val') !== 'restart';
      const text = cont ? (rows[rows.length - 1]?.[col] ?? '') : cellText(tc);
      row.push(text);
      for (let i = 1; i < span; i++) row.push('');
    }
    rows.push(row);
  }
  return rows;
}

export function readDocxTables(bytes: Uint8Array): SheetInput[] {
  const files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('Not a Word document');
  const doc = new DOMParser().parseFromString(strFromU8(xml), 'application/xml');
  // الجداول اللي جوه جداول تانية بتتقري لوحدها كمان (أحياناً ملف المتابعة بيبقى جدول جوه جدول)
  return Array.from(doc.getElementsByTagNameNS(W, 'tbl')).map((tbl, i) => ({ sheet: `Table ${i + 1}`, data: tableRows(tbl) }));
}
