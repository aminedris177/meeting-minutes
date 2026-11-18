// التواريخ في التطبيق:
// - التخزين: نص ISO بدون وقت "YYYY-MM-DD" (تاريخ محلي، بلا مشاكل المناطق الزمنية).
// - العرض: dd/mm/yyyy بأرقام إنجليزية.
// - الأسبوع يبدأ يوم السبت.

export type ISODate = string; // "YYYY-MM-DD"

/** 0 = الأحد … 6 = السبت (نفس getDay) */
export const WEEK_START = 6;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export function toISODate(d: Date): ISODate {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** يحوّل "YYYY-MM-DD" إلى Date محلي (منتصف الليل). يرمي خطأ لو التاريخ غير صالح. */
export function parseISODate(s: ISODate): Date {
  const m = ISO_RE.exec(s);
  if (!m) throw new Error(`Invalid ISO date: ${s}`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    throw new Error(`Invalid ISO date: ${s}`);
  }
  return date;
}

/** "2026-11-16" → "16/11/2026" */
export function formatDate(s: ISODate | null | undefined): string {
  if (!s) return '';
  const d = parseISODate(s);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "16/11/2026" (أو 16-11-2026 أو 16.11.2026، وأرقام عربية مقبولة) → "2026-11-16". null لو غير صالح. */
export function parseDisplayDate(s: string): ISODate | null {
  const normalized = toLatinDigits(s.trim());
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(normalized);
  if (!m) return null;
  const iso = `${m[3]}-${pad(Number(m[2]))}-${pad(Number(m[1]))}`;
  try {
    parseISODate(iso);
    return iso;
  } catch {
    return null;
  }
}

export function addDays(s: ISODate, days: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** عدد الأيام من a إلى b (b - a)، بأيام تقويمية كاملة (لا يتأثر بالتوقيت الصيفي). */
export function diffDays(a: ISODate, b: ISODate): number {
  const da = parseISODate(a);
  const db = parseISODate(b);
  const ua = Date.UTC(da.getFullYear(), da.getMonth(), da.getDate());
  const ub = Date.UTC(db.getFullYear(), db.getMonth(), db.getDate());
  return Math.round((ub - ua) / 86_400_000);
}

/** أول يوم (السبت) في الأسبوع الذي يحتوي التاريخ. */
export function startOfWeek(s: ISODate): ISODate {
  const day = parseISODate(s).getDay();
  const offset = (day - WEEK_START + 7) % 7;
  return addDays(s, -offset);
}

/** يحوّل الأرقام العربية-الهندية والفارسية إلى أرقام إنجليزية. */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}
