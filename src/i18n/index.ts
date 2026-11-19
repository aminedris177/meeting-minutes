import { ar, type Messages } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';
export const LANGS: readonly Lang[] = ['ar', 'en'];

const catalogs: Record<Lang, Messages> = { ar, en };
const STORAGE_KEY = 'lang';
let current: Lang = 'ar';

export function isLang(v: unknown): v is Lang {
  return v === 'ar' || v === 'en';
}

/** اللغة المحفوظة على الجهاز (للفتح السريع من غير ما نستنى قاعدة البيانات). */
export function initialLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : 'ar';
  } catch {
    return 'ar';
  }
}

export function setLang(lang: Lang): void {
  current = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function getLang(): Lang {
  return current;
}

export function isRtl(): boolean {
  return current === 'ar';
}

export function dir(): 'rtl' | 'ltr' {
  return isRtl() ? 'rtl' : 'ltr';
}

/** النصوص الحالية: t().nav.home */
export function t(): Messages {
  return catalogs[current];
}

/** تعويض المتغيرات: fmt('خطوة {n} من {total}', { n: 1, total: 6 }) */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
