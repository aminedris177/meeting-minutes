// كاتب xlsx بسيط (من غير مكتبات تقيلة): نصوص، أرقام، وتواريخ حقيقية بتنسيق dd/mm/yyyy،
// صف عناوين ملوّن ومثبّت، واتجاه الشيت (RTL/LTR). بيتجمع بـ fflate.
import { strToU8, zipSync } from 'fflate';
import { parseISODate, type ISODate } from '../lib/dates';

export type XCell = string | number | { date: ISODate } | null | undefined;

export interface XColumn {
  header: string;
  width: number; // بعدد الحروف تقريباً
}

export interface XSheet {
  name: string;
  rtl: boolean;
  /** سطور عنوان فوق الجدول (نص في أول خانة) */
  titleRows?: string[];
  columns: XColumn[];
  rows: XCell[][];
  /** صفوف تتلوّن (مثلاً المتأخر) — بأرقام الصفوف داخل rows */
  highlightRows?: Set<number>;
  headerColor: string; // #RRGGBB
}

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    // حروف تحكم ممنوعة في XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');

function colName(i: number): string {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** رقم Excel للتاريخ (أيام من 1899-12-30) */
export function excelSerial(iso: ISODate): number {
  const d = parseISODate(iso);
  return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 86_400_000);
}

// الأنماط: 0 عادي، 1 عنوان الجدول، 2 خانة جسم، 3 تاريخ، 4 سطر عنوان علوي، 5 خانة مميّزة، 6 تاريخ مميّز
function stylesXml(headerColors: string[]): string {
  // كل شيت ممكن يكون له لون عنوان — بنعمل fill لكل لون
  const fills = headerColors.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${c.replace('#', '').toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
  const base = 2; // أول fill بعد الاتنين الافتراضيين
  const hlFill = base + headerColors.length; // fill للصفوف المميّزة
  const headerXfs = headerColors
    .map((_, i) => `<xf numFmtId="0" fontId="1" fillId="${base + i}" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="3"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font><font><b/><sz val="14"/><name val="Arial"/></font></fonts>
<fills count="${hlFill + 1}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${fills}<fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D7DE"/></left><right style="thin"><color rgb="FFD0D7DE"/></right><top style="thin"><color rgb="FFD0D7DE"/></top><bottom style="thin"><color rgb="FFD0D7DE"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${6 + headerColors.length}">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="${hlFill}" borderId="1" xfId="0" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="${hlFill}" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="top"/></xf>
${headerXfs}
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

const S_BODY = 1;
const S_DATE = 2;
const S_TITLE = 3;
const S_BODY_HL = 4;
const S_DATE_HL = 5;
const S_HEADER0 = 6;

function cellXml(ref: string, v: XCell, style: number, dateStyle: number): string {
  if (v === null || v === undefined || v === '') return `<c r="${ref}" s="${style}"/>`;
  if (typeof v === 'number') return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
  if (typeof v === 'object') return `<c r="${ref}" s="${dateStyle}"><v>${excelSerial(v.date)}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
}

function sheetXml(s: XSheet, headerStyle: number): string {
  const rows: string[] = [];
  let r = 1;
  for (const title of s.titleRows ?? []) {
    rows.push(`<row r="${r}">${cellXml(`A${r}`, title, S_TITLE, S_TITLE)}</row>`);
    r++;
  }
  if (s.titleRows?.length) r++; // سطر فاضي
  const headerRow = r;
  rows.push(`<row r="${r}" ht="30" customHeight="1">${s.columns.map((c, i) => cellXml(`${colName(i)}${r}`, c.header, headerStyle, headerStyle)).join('')}</row>`);
  r++;
  s.rows.forEach((row, i) => {
    const hl = s.highlightRows?.has(i);
    rows.push(`<row r="${r}">${row.map((v, ci) => cellXml(`${colName(ci)}${r}`, v, hl ? S_BODY_HL : S_BODY, hl ? S_DATE_HL : S_DATE)).join('')}</row>`);
    r++;
  });
  const cols = s.columns.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`).join('');
  const lastCol = colName(Math.max(0, s.columns.length - 1));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0"${s.rtl ? ' rightToLeft="1"' : ''}><pane ySplit="${headerRow}" topLeftCell="A${headerRow + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${cols}</cols>
<sheetData>${rows.join('')}</sheetData>
${s.rows.length ? `<autoFilter ref="A${headerRow}:${lastCol}${headerRow + s.rows.length}"/>` : ''}
<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

/** اسم شيت صالح: ≤31 حرف ومن غير الرموز الممنوعة */
const sheetName = (n: string) => n.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';

export function buildXlsx(sheets: XSheet[]): Uint8Array {
  const colors = sheets.map((s) => s.headerColor);
  const files: Record<string, string> = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(sheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': stylesXml(colors),
  };
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s, S_HEADER0 + i)));
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));
}
