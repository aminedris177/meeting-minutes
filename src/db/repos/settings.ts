import { db, type AppDB } from '../schema';

/** مفاتيح الإعدادات */
export const SETTING = {
  pin: 'pin',
  lastBackupAt: 'lastBackupAt',
  lang: 'lang',
  /** إشعار المتأخر (خاص بالجهاز) — بيقراه الـ Service Worker */
  overdueNotify: 'overdueNotify',
} as const;

export async function getSetting<T>(key: string, d: AppDB = db): Promise<T | undefined> {
  return (await d.settings.get(key))?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown, d: AppDB = db): Promise<void> {
  if (value === undefined) await d.settings.delete(key);
  else await d.settings.put({ key, value });
}
