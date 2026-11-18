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
