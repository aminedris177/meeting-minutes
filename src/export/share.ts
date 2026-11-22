// بعد التصدير: مشاركة بـ Web Share API (ملف)، ولو مش مدعومة → تنزيل عادي.
import { t } from '../i18n';
import type { ISODate } from '../lib/dates';
import { saveExportedFile, type FileKind } from '../db/files';

/** اسم ملف آمن: بيشيل الرموز الممنوعة في أسماء الملفات ويحوّل المسافات لـ _ */
export function safeFileName(s: string): string {
  return s
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
}

/** محضر_{اسم السلسلة}_{YYYY-MM-DD}.ext (البادئة حسب اللغة) */
export function minutesFileName(seriesName: string, date: ISODate, ext: string): string {
  return `${safeFileName(`${t().files.minutes}_${seriesName}_${date}`)}.${ext}`;
}

export interface KeepMeta {
  kind: FileKind;
  seriesName?: string;
}

/**
 * مشاركة/تنزيل الملف. لو keep موجود: نسخة من الملف بتتحفظ في «الملفات المصدّرة».
 * الحفظ بيبدأ في نفس اللحظة مع المشاركة (مش قبلها) علشان الآيفون ميرفضش المشاركة بسبب الانتظار.
 * لو المساحة خلصت: التصدير بيكمّل عادي، وبتظهر رسالة إن النسخة مااتحفظتش.
 */
export async function shareOrDownload(blob: Blob, fileName: string, title?: string, keep?: KeepMeta): Promise<'shared' | 'downloaded'> {
  const saving: Promise<unknown> = keep ? saveExportedFile(blob, fileName, keep).catch((e: unknown) => e ?? new Error('save failed')) : Promise.resolve();
  try {
    return await deliver(blob, fileName, title);
  } finally {
    const err = await saving;
    if (err instanceof Error || (err && typeof err === 'object' && 'name' in err)) {
      const full = (err as Error).name === 'QuotaExceededError' || /quota/i.test(String((err as Error).message ?? err));
      alert(full ? t().files.saveFull : t().files.saveFailed);
    }
  }
}

async function deliver(blob: Blob, fileName: string, title?: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: title ?? fileName });
      return 'shared';
    } catch (e) {
      // المستخدم قفل نافذة المشاركة — مش خطأ
      if ((e as Error).name === 'AbortError') throw e;
      // أي خطأ تاني (مثلاً المشاركة اتمنعت) → ننزّل الملف
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
