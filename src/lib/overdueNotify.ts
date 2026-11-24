// إشعار المتأخر (بديل الرقم على الأيقونة في أندرويد): إشعار واحد بنفس الـ tag بيتحدّث بدل ما يتكرر.
// التطبيق بيحدّثه لما يتفتح، والـ Service Worker (public/sw-overdue.js) بيحدّثه في الخلفية لو Periodic Background Sync مدعوم.
import { getSetting, setSetting, SETTING } from '../db/repos/settings';
import { fmt, t } from '../i18n';

export const OVERDUE_TAG = 'overdue';
export const PERIODIC_TAG = 'overdue-check';
const PERIOD_MS = 12 * 60 * 60 * 1000;
const LAST_KEY = 'overdue-notified';

/** متخزن في IndexedDB علشان الـ Service Worker يقراه (ومعاه النصوص باللغة الحالية). */
export interface OverdueNotifySetting {
  on: boolean;
  title: string;
  body: string;
  url: string;
}

interface PeriodicSyncManager {
  register(tag: string, o: { minInterval: number }): Promise<void>;
  unregister(tag: string): Promise<void>;
  getTags(): Promise<string[]>;
}
type PeriodicReg = ServiceWorkerRegistration & { periodicSync?: PeriodicSyncManager };

export function notifySupported(): boolean {
  return typeof Notification !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

const overdueUrl = () => `${import.meta.env.BASE_URL}#/followup/overdue`;

function settingFor(on: boolean): OverdueNotifySetting {
  const m = t().alerts;
  return { on, title: m.notifyTitle, body: m.notifyBody, url: overdueUrl() };
}

async function registration(): Promise<PeriodicReg | undefined> {
  if (!notifySupported()) return undefined;
  try {
    return (await navigator.serviceWorker.getRegistration()) as PeriodicReg | undefined;
  } catch {
    return undefined;
  }
}

export async function isOverdueNotifyOn(): Promise<boolean> {
  return (await getSetting<OverdueNotifySetting>(SETTING.overdueNotify))?.on === true;
}

/** تشغيل/إيقاف التنبيه، وتسجيل التحديث في الخلفية (كل 12 ساعة تقريباً) لو مدعوم. */
export async function setOverdueNotify(on: boolean): Promise<void> {
  await setSetting(SETTING.overdueNotify, settingFor(on));
  const reg = await registration();
  if (!reg) return;
  try {
    if (on) await reg.periodicSync?.register(PERIODIC_TAG, { minInterval: PERIOD_MS });
    else await reg.periodicSync?.unregister(PERIODIC_TAG);
  } catch {
    /* Chrome بيرفض لو التطبيق مش متثبت أو الإذن مش متاح — الإشعار هيتحدّث لما التطبيق يتفتح بس */
  }
  if (!on) {
    await closeOverdue(reg);
    try {
      localStorage.removeItem(LAST_KEY);
    } catch {
      /* ignore */
    }
  }
}

/** هل التحديث في الخلفية متسجّل فعلاً على الجهاز ده؟ */
export async function backgroundSyncActive(): Promise<boolean> {
  const reg = await registration();
  try {
    return !!reg?.periodicSync && (await reg.periodicSync.getTags()).includes(PERIODIC_TAG);
  } catch {
    return false;
  }
}

async function closeOverdue(reg: ServiceWorkerRegistration): Promise<void> {
  try {
    for (const n of await reg.getNotifications({ tag: OVERDUE_TAG })) n.close();
  } catch {
    /* ignore */
  }
}

/**
 * لما التطبيق يتفتح: يعرض/يحدّث إشعار المتأخر، أو يقفله لو مفيش متأخر.
 * علشان ميزعجش كل مرة تفتح فيها التطبيق: بيظهر لو العدد اتغير، أو لو فيه إشعار ظاهر بالفعل (يتحدّث من غير صوت)، أو force.
 */
export async function syncOverdueNotification(count: number, force = false): Promise<void> {
  if (!notifySupported() || Notification.permission !== 'granted') return;
  const saved = await getSetting<OverdueNotifySetting>(SETTING.overdueNotify);
  if (!saved?.on) return;
  const reg = await registration();
  if (!reg) return;
  // النصوص باللغة الحالية (لو اللغة اتغيرت)
  const s = settingFor(true);
  if (s.title !== saved.title || s.body !== saved.body || s.url !== saved.url) await setSetting(SETTING.overdueNotify, s);
  if (count <= 0) {
    await closeOverdue(reg);
    setLast(0);
    return;
  }
  let shown: Notification[] = [];
  try {
    shown = await reg.getNotifications({ tag: OVERDUE_TAG });
  } catch {
    /* ignore */
  }
  if (!force && !shown.length && getLast() === count) return;
  try {
    await reg.showNotification(s.title, {
      tag: OVERDUE_TAG,
      body: fmt(s.body, { n: count }),
      icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
      data: { url: s.url },
      silent: shown.length > 0,
    });
    setLast(count);
  } catch {
    /* الإذن اتشال من إعدادات الموبايل */
  }
}

function getLast(): number | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}
function setLast(n: number): void {
  try {
    localStorage.setItem(LAST_KEY, String(n));
  } catch {
    /* ignore */
  }
}
