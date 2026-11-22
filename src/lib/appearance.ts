// المظهر (فاتح/داكن/حسب الموبايل) وحجم الخط — إعدادات خاصة بالجهاز (localStorage).
import { useEffect, useState } from 'preact/hooks';

export type Theme = 'system' | 'light' | 'dark';
export type TextSize = 'normal' | 'large' | 'xlarge';
export const THEMES: Theme[] = ['system', 'light', 'dark'];
export const TEXT_SIZES: TextSize[] = ['normal', 'large', 'xlarge'];
const SCALE: Record<TextSize, number> = { normal: 1, large: 1.12, xlarge: 1.25 };
const K_THEME = 'theme';
const K_SIZE = 'textSize';
const EVENT = 'app-appearance';

function read<T extends string>(key: string, allowed: T[], def: T): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : def;
  } catch {
    return def;
  }
}
export const getTheme = () => read<Theme>(K_THEME, THEMES, 'system');
export const getTextSize = () => read<TextSize>(K_SIZE, TEXT_SIZES, 'normal');

const media = () => (typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null);

/** المظهر الفعلي بعد حساب «حسب الموبايل». */
export function effectiveTheme(): 'light' | 'dark' {
  const t = getTheme();
  if (t !== 'system') return t;
  return media()?.matches ? 'dark' : 'light';
}

export function applyAppearance(): void {
  const root = document.documentElement;
  const dark = effectiveTheme() === 'dark';
  root.dataset.theme = dark ? 'dark' : 'light';
  root.style.fontSize = `${16 * SCALE[getTextSize()]}px`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f141b' : '#1F3864');
}

export function initAppearance(): void {
  applyAppearance();
  media()?.addEventListener?.('change', () => getTheme() === 'system' && applyAppearance());
}

function save(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {
    /* وضع خاص: يتطبّق للجلسة دي بس */
  }
  applyAppearance();
  window.dispatchEvent(new CustomEvent(EVENT));
}
export const setTheme = (t: Theme) => save(K_THEME, t);
export const setTextSize = (s: TextSize) => save(K_SIZE, s);

export function useAppearance(): { theme: Theme; size: TextSize } {
  const [v, set] = useState({ theme: getTheme(), size: getTextSize() });
  useEffect(() => {
    const on = () => set({ theme: getTheme(), size: getTextSize() });
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return v;
}
