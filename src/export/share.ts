// بعد التصدير: مشاركة بـ Web Share API (ملف)، ولو مش مدعومة → تنزيل عادي.
import { t } from '../i18n';
import type { ISODate } from '../lib/dates';

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

export async function shareOrDownload(blob: Blob, fileName: string, title?: string): Promise<'shared' | 'downloaded'> {
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
