import { ar, type Messages } from './ar';

export type Lang = 'ar';

const catalogs: Record<Lang, Messages> = { ar };
let current: Lang = 'ar';

export function setLang(lang: Lang): void {
  current = lang;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

/** النصوص الحالية: t().nav.home */
export function t(): Messages {
  return catalogs[current];
}

/** تعويض المتغيرات: fmt('خطوة {n} من {total}', { n: 1, total: 6 }) */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
