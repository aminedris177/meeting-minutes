// قراءة مهام من شيتات Excel بنفس أعمدة ملف المتابعة (الأعمدة بتتعرف بالاسم مش بالترتيب).
import type { TaskStatus } from '../db/types';
import { parseDisplayDate, type ISODate } from '../lib/dates';
import { parseTaskCode } from './numbering';

export type Cell = string | number | boolean | Date | null | undefined;
export interface SheetInput {
  sheet: string;
  data: Cell[][];
}

export interface ParsedTask {
  code?: string;
  number?: number;
  topic: string;
  description: string;
  ownerName: string;
  createdDate?: ISODate;
  targetDate?: ISODate;
  closedDate?: ISODate;
  status: TaskStatus;
  statusRaw: string;
  update: string;
  nextAction: string;
  sheet: string;
  row: number; // رقم الصف في Excel (من 1)
}

type Field = 'code' | 'topic' | 'description' | 'owner' | 'created' | 'target' | 'closed' | 'status' | 'update' | 'next';

// أسماء الأعمدة المقبولة لكل حقل (بعد تنظيف المسافات)
const ALIASES: Record<Field, string[]> = {
  code: ['الرقم', 'رقم', 'رقم المهمة', 'الكود', 'م'],
  topic: ['المحور', 'محور'],
  description: ['المهمة', 'الوصف', 'البند', 'وصف المهمة', 'المهمه'],
  owner: ['المسؤول', 'المسئول', 'مسؤول التنفيذ'],
  created: ['تاريخ الإدراج', 'تاريخ الادراج', 'الإدراج', 'تاريخ الإضافة'],
  target: ['الموعد المستهدف', 'التاريخ المستهدف', 'الموعد', 'تاريخ الاستحقاق'],
  closed: ['تاريخ الإغلاق', 'تاريخ الاغلاق'],
  status: ['الحالة', 'حالة'],
  update: ['آخر تحديث', 'اخر تحديث', 'التحديث', 'النتيجة / آخر تحديث', 'النتيجة'],
  next: ['المطلوب للاجتماع القادم', 'المطلوب', 'الخطوة القادمة'],
};

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const STATUS_MAP: [RegExp, TaskStatus][] = [
  [/ملغ/, 'cancelled'],
  [/^تم|مغلق|منته|مكتمل/, 'done'],
  [/معل[ّ]?ق|متوقف|انتظار/, 'blocked'],
  // «لم يبدأ» قبل «جارٍ» — علشان كلمة «بدأ» جواها متتقريش كبداية تنفيذ
  [/لم يبدأ|لم يتم البدء|جديد/, 'not_started'],
  [/جار|قيد التنفيذ|بدأ/, 'in_progress'],
];

export function mapStatus(raw: string): TaskStatus {
  const s = clean(raw);
  for (const [re, st] of STATUS_MAP) if (re.test(s)) return st;
  return 'not_started';
}

/** Date من Excel بيوصل UTC — بناخد مكونات UTC علشان اليوم ميتزحزحش بسبب المنطقة الزمنية. */
export function cellToDate(c: Cell): ISODate | undefined {
  if (c instanceof Date && !Number.isNaN(c.getTime())) {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${c.getUTCFullYear()}-${p(c.getUTCMonth() + 1)}-${p(c.getUTCDate())}`;
  }
  if (typeof c === 'string' && c.trim()) {
    const s = c.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    return parseDisplayDate(s) ?? undefined;
  }
  return undefined;
}

function findHeader(data: Cell[][]): { row: number; cols: Partial<Record<Field, number>> } | null {
  for (let r = 0; r < Math.min(data.length, 30); r++) {
    const cells = data[r].map(clean);
    const cols: Partial<Record<Field, number>> = {};
    for (const [field, names] of Object.entries(ALIASES) as [Field, string[]][]) {
      const i = cells.findIndex((c) => names.includes(c));
      if (i >= 0) cols[field] = i;
    }
    if (cols.description !== undefined && (cols.code !== undefined || cols.owner !== undefined)) return { row: r, cols };
  }
  return null;
}

export function parseTaskSheets(sheets: SheetInput[]): ParsedTask[] {
  const out: ParsedTask[] = [];
  for (const { sheet, data } of sheets) {
    const h = findHeader(data);
    if (!h) continue;
    const get = (row: Cell[], f: Field) => (h.cols[f] === undefined ? undefined : row[h.cols[f]!]);
    for (let r = h.row + 1; r < data.length; r++) {
      const row = data[r];
      const description = clean(get(row, 'description'));
      if (!description) continue;
      const codeRaw = clean(get(row, 'code'));
      const parsedCode = parseTaskCode(codeRaw);
      const statusRaw = clean(get(row, 'status'));
      const closedDate = cellToDate(get(row, 'closed'));
      let status = mapStatus(statusRaw);
      if (!statusRaw && closedDate) status = 'done';
      out.push({
        code: parsedCode ? `${parsedCode.prefix}-${String(parsedCode.n).padStart(2, '0')}` : undefined,
        number: parsedCode?.n,
        topic: clean(get(row, 'topic')),
        description,
        ownerName: clean(get(row, 'owner')),
        createdDate: cellToDate(get(row, 'created')),
        targetDate: cellToDate(get(row, 'target')),
        closedDate,
        status,
        statusRaw,
        update: clean(get(row, 'update')),
        nextAction: clean(get(row, 'next')),
        sheet,
        row: r + 1,
      });
    }
  }
  return out;
}
