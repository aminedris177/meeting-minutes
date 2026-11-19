// بناء ملف Word للمحضر (من غير DOM — بيتختبر في Node).
// RTL: كل فقرة bidirectional، وكل جدول visuallyRightToLeft، وكل نص rightToLeft. الخط Arial.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ParagraphChild,
} from 'docx';
import type { MinutesModel, TaskStatus } from '../db/types';
import { CREAM_COLOR, LIGHT_COLOR } from '../domain/series';
import { fmt, t } from '../i18n';
import { formatDate } from '../lib/dates';

export interface DocxLogo {
  data: Uint8Array;
  type: 'png' | 'jpg';
  width: number;
  height: number;
}

const FONT = 'Arial';
/** عرض الصفحة المتاح: A4 (11906) − هوامش 720 من كل ناحية — بالـ twips */
const CONTENT_W = 11906 - 720 * 2;
const hex = (c: string) => c.replace('#', '').toUpperCase();

// ألوان خانة الحالة (نفس ألوان القالب المرجعي)
const STATUS_FILL: Record<TaskStatus, string> = {
  not_started: 'FFFFFF',
  in_progress: 'DDEBF7',
  blocked: 'FFF8E8',
  done: 'C6EFCE',
  cancelled: 'E7E6E6',
};

interface RunOpts {
  bold?: boolean;
  size?: number; // بالنقط
  color?: string;
  font?: string;
}

function run(text: string, o: RunOpts = {}): TextRun {
  return new TextRun({
    text,
    bold: o.bold,
    size: o.size ? o.size * 2 : undefined,
    color: o.color ? hex(o.color) : undefined,
    font: { ascii: o.font ?? FONT, hAnsi: o.font ?? FONT, cs: o.font ?? FONT, eastAsia: o.font ?? FONT },
    rightToLeft: true,
  });
}

/** رقم/تاريخ/كود — اتجاه LTR جوه السطر العربي */
function ltr(text: string, o: RunOpts = {}): TextRun {
  return new TextRun({
    text,
    bold: o.bold,
    size: o.size ? o.size * 2 : undefined,
    color: o.color ? hex(o.color) : undefined,
    font: { ascii: FONT, hAnsi: FONT, cs: FONT },
  });
}

interface ParaOpts {
  align?: 'right' | 'center' | 'left';
  after?: number; // twips
  before?: number;
  border?: string; // لون خط تحت الفقرة
  keepNext?: boolean;
}

function para(children: ParagraphChild[] | string, o: ParaOpts = {}): Paragraph {
  const align = o.align === 'center' ? AlignmentType.CENTER : o.align === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT;
  return new Paragraph({
    children: typeof children === 'string' ? [run(children)] : children,
    bidirectional: true,
    alignment: align,
    spacing: { after: o.after ?? 0, before: o.before ?? 0, line: 276 },
    keepNext: o.keepNext,
    border: o.border ? { bottom: { style: BorderStyle.SINGLE, size: 12, color: hex(o.border), space: 2 } } : undefined,
  });
}

interface CellOpts {
  fill?: string;
  align?: 'right' | 'center' | 'left';
  width: number; // twips
  span?: number;
}

function cell(content: Paragraph[] | Paragraph, o: CellOpts): TableCell {
  return new TableCell({
    children: Array.isArray(content) ? content : [content],
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.span,
    verticalAlign: VerticalAlign.CENTER,
    shading: o.fill ? { fill: hex(o.fill), color: 'auto', type: 'clear' } : undefined,
    margins: { top: 50, bottom: 50, left: 80, right: 80 },
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'D0D7DE' };
const borders = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER, insideHorizontal: BORDER, insideVertical: BORDER };

function table(rows: TableRow[], widths: number[], o: { borders?: boolean } = {}): Table {
  return new Table({
    rows,
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    visuallyRightToLeft: true,
    borders: o.borders === false ? undefined : borders,
  });
}

/** نسب → twips على عرض الصفحة */
const cols = (...ratios: number[]) => {
  const sum = ratios.reduce((a, b) => a + b, 0);
  const ws = ratios.map((r) => Math.floor((r / sum) * CONTENT_W));
  ws[0] += CONTENT_W - ws.reduce((a, b) => a + b, 0);
  return ws;
};

export function buildMinutesDocx(model: MinutesModel, logo?: DocxLogo): Document {
  const m = t().minutes;
  const st = t().task.statuses;
  const pr = t().task.priorities;
  const rs = t().meeting.registerStatuses;
  const { colors, sections } = model;
  const primary = colors.primary;
  const secondary = colors.secondary;
  const zebra = (i: number) => (i % 2 ? CREAM_COLOR : 'FFFFFF');

  const headerRow = (labels: string[], widths: number[]) =>
    new TableRow({
      tableHeader: true,
      cantSplit: true,
      children: labels.map((l, i) => cell(para([run(l, { bold: true, color: '#FFFFFF', size: 10 })], { align: 'center' }), { width: widths[i], fill: secondary })),
    });

  const heading = (text: string) => para([run(text, { bold: true, size: 13, color: primary })], { before: 220, after: 80, border: secondary, keepNext: true });

  const body: (Paragraph | Table)[] = [];

  // 1) اللوجو واسم الجهة
  if (logo || model.orgName) {
    const kids: ParagraphChild[] = [];
    if (logo) {
      const h = 48;
      const w = Math.round((logo.width / logo.height) * h);
      kids.push(new ImageRun({ type: logo.type, data: logo.data, transformation: { width: Math.min(w, 160), height: h } }));
    }
    if (model.orgName) kids.push(run(`${logo ? '   ' : ''}${model.orgName}`, { bold: true, size: 12 }));
    body.push(para(kids, { after: 120 }));
  }

  // 2) شريط العنوان
  body.push(
    table(
      [
        new TableRow({
          children: [
            cell(
              [
                para([run(m.title, { bold: true, size: 18, color: '#FFFFFF' })], { align: 'center' }),
                para([run(model.seriesName, { size: 12, color: '#FFFFFF' })], { align: 'center' }),
              ],
              { width: CONTENT_W, fill: primary },
            ),
          ],
        }),
      ],
      [CONTENT_W],
      { borders: false },
    ),
  );

  // 3) بيانات الاجتماع
  const infoW = cols(1, 1, 1);
  body.push(
    table(
      [
        new TableRow({
          children: [
            cell(para([run(`${m.number}: `), ltr(String(model.number), { bold: true })]), { width: infoW[0], fill: LIGHT_COLOR }),
            cell(para([run(`${m.date}: `), ltr(formatDate(model.date), { bold: true })]), { width: infoW[1], fill: LIGHT_COLOR }),
            cell(para([run(`${m.nextDate}: `), ltr(model.nextDate ? formatDate(model.nextDate) : m.none, { bold: true })]), { width: infoW[2], fill: LIGHT_COLOR }),
          ],
        }),
      ],
      infoW,
    ),
  );
  if (model.status === 'draft') {
    body.push(para([run(t().meeting.draftBanner, { bold: true, color: '#B26A00' })], { align: 'center', before: 120 }));
  }

  // 4) الحضور — عمودين بمربعات ☑ / ☐
  if (model.attendees.length) {
    body.push(heading(m.attendance));
    const w = cols(0.5, 3.2, 0.7, 0.5, 3.2, 0.7);
    const half = Math.ceil(model.attendees.length / 2);
    const rows = [headerRow([m.idx, m.name, m.present, m.idx, m.name, m.present], w)];
    for (let i = 0; i < half; i++) {
      const a = model.attendees[i];
      const b = model.attendees[half + i];
      const person = (x: typeof a | undefined, n: number, off: number) =>
        x
          ? [
              cell(para([ltr(String(n))], { align: 'center' }), { width: w[off], fill: zebra(i) }),
              cell(para([run(x.name), ...(x.guest ? [run(` (${m.guest})`, { size: 8, color: '#5D6B7A' })] : [])]), { width: w[off + 1], fill: zebra(i) }),
              cell(para([run(x.present ? '☑' : '☐', { font: 'MS Gothic', size: 12 })], { align: 'center' }), { width: w[off + 2], fill: zebra(i) }),
            ]
          : [cell(para(''), { width: w[off] }), cell(para(''), { width: w[off + 1] }), cell(para(''), { width: w[off + 2] })];
      rows.push(new TableRow({ cantSplit: true, children: [...person(a, i + 1, 0), ...person(b, half + i + 1, 3)] }));
    }
    body.push(table(rows, w));
  }

  // 5) المحاور — في سطر واحد بفواصل (زي القالب)
  if (model.topics.length) {
    body.push(heading(m.topics));
    body.push(
      table(
        [new TableRow({ children: [cell(para(model.topics.map((x, i) => run(i ? `  |  ${x}` : x))), { width: CONTENT_W, fill: LIGHT_COLOR })] })],
        [CONTENT_W],
      ),
    );
  }
  if (model.notes.trim()) {
    body.push(heading(m.notes));
    for (const line of model.notes.split(/\r?\n/)) body.push(para(line));
  }

  // 6) مراجعة البنود
  if (model.review.length) {
    body.push(heading(m.review));
    const w = cols(0.9, 1.4, 1.5, 4.2, 1.2);
    const rows = [headerRow([m.code, m.topic, m.owner, m.update, m.status], w)];
    model.review.forEach((r, i) => {
      const updateParas = [para(r.update || '')];
      if (r.nextAction) updateParas.push(para([run(`${m.next}: `, { bold: true, size: 9 }), run(r.nextAction, { size: 9 })]));
      const statusParas = [para([run(st[r.status], { bold: true })], { align: 'center' })];
      if (r.delay > 0) statusParas.push(para([run(fmt(m.late, { n: r.delay }), { size: 8, color: '#C62828' })], { align: 'center' }));
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(para([ltr(r.code, { bold: true, color: primary })], { align: 'center' }), { width: w[0], fill: zebra(i) }),
            cell(para(r.topic || m.none), { width: w[1], fill: zebra(i) }),
            cell(para(r.owner || m.unassigned), { width: w[2], fill: zebra(i) }),
            cell(updateParas, { width: w[3], fill: zebra(i) }),
            cell(statusParas, { width: w[4], fill: STATUS_FILL[r.status] }),
          ],
        }),
      );
    });
    body.push(table(rows, w));
  }

  // 7) القرارات
  if (sections.decisions && model.decisions.length) {
    body.push(heading(m.decisions));
    const w = cols(0.5, 9.5);
    const rows = [headerRow([m.idx, m.decision], w)];
    model.decisions.forEach((x, i) =>
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(para([ltr(String(i + 1))], { align: 'center' }), { width: w[0], fill: zebra(i) }),
            cell(para([run(x.text), ...(x.taskCode ? [run(' ('), ltr(x.taskCode, { bold: true, color: primary }), run(')')] : [])]), {
              width: w[1],
              fill: zebra(i),
            }),
          ],
        }),
      ),
    );
    body.push(table(rows, w));
  }

  // 8) المهام الجديدة
  if (sections.newTasks && model.newTasks.length) {
    body.push(heading(m.newTasks));
    const w = cols(0.9, 4.4, 1.6, 1.3, 1.1);
    const rows = [headerRow([m.code, m.description, m.owner, m.target, m.priority], w)];
    model.newTasks.forEach((x, i) =>
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(para([ltr(x.code, { bold: true, color: primary })], { align: 'center' }), { width: w[0], fill: zebra(i) }),
            cell([para(x.description), ...(x.topic ? [para([run(x.topic, { size: 8, color: '#5D6B7A' })])] : [])], { width: w[1], fill: zebra(i) }),
            cell(para(x.owner || m.unassigned), { width: w[2], fill: zebra(i) }),
            cell(para([ltr(x.targetDate ? formatDate(x.targetDate) : m.none)], { align: 'center' }), { width: w[3], fill: zebra(i) }),
            cell(para(pr[x.priority], { align: 'center' }), { width: w[4], fill: zebra(i) }),
          ],
        }),
      ),
    );
    body.push(table(rows, w));
  }

  // 9) السجل التراكمي
  if (sections.register && model.register.length) {
    body.push(heading(model.registerName || m.register));
    const w = cols(0.5, 2.5, 5.6, 1.4);
    const rows = [headerRow([m.idx, m.item, m.text, m.status], w)];
    model.register.forEach((x, i) =>
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [
            cell(para([ltr(String(i + 1))], { align: 'center' }), { width: w[0], fill: x.isNew ? LIGHT_COLOR : zebra(i) }),
            cell(para([run(x.item, { bold: x.isNew })]), { width: w[1], fill: zebra(i) }),
            cell(para(x.text), { width: w[2], fill: zebra(i) }),
            cell(para(rs[x.status], { align: 'center' }), { width: w[3], fill: zebra(i) }),
          ],
        }),
      ),
    );
    body.push(table(rows, w));
  }

  // 10) التوقيعات
  const present = model.attendees.filter((a) => a.present);
  if (sections.signatures && present.length) {
    body.push(heading(m.signatures));
    const w = cols(0.5, 4, 5.5);
    const rows = [headerRow([m.idx, m.name, m.signature], w)];
    present.forEach((a, i) =>
      rows.push(
        new TableRow({
          cantSplit: true,
          height: { value: 520, rule: 'atLeast' },
          children: [
            cell(para([ltr(String(i + 1))], { align: 'center' }), { width: w[0] }),
            cell(para(a.name), { width: w[1] }),
            cell(para(''), { width: w[2] }),
          ],
        }),
      ),
    );
    body.push(table(rows, w));
  }

  const footer = new Footer({
    children: [
      para(
        [
          run(`${model.seriesName} — ${m.title} `, { size: 8, color: '#9AA5B1' }),
          ltr(String(model.number), { size: 8, color: '#9AA5B1' }),
          run('   ·   ', { size: 8, color: '#9AA5B1' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '9AA5B1', font: FONT }),
          run(' / ', { size: 8, color: '#9AA5B1' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '9AA5B1', font: FONT }),
        ],
        { align: 'center' },
      ),
    ],
  });

  return new Document({
    creator: '',
    title: `${m.title} — ${model.seriesName}`,
    styles: {
      default: {
        document: {
          run: { font: { ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT }, size: 20, sizeComplexScript: 20 },
          paragraph: { spacing: { after: 0, line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 720, right: 720, bottom: 720, left: 720, header: 400, footer: 400 },
          },
        },
        footers: { default: footer },
        children: body,
      },
    ],
  });
}
