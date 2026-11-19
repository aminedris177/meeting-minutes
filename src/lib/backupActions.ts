// أوامر النسخ الاحتياطي من الواجهة (مشاركة/تنزيل + تسجيل تاريخ آخر نسخة).
import { backupFileName, exportBackup, exportSeriesFile } from '../db/backup';
import { SETTING, setSetting } from '../db/repos/settings';
import { safeFileName, shareOrDownload } from '../export/share';
import { todayISO } from './dates';
import { t } from '../i18n';

export async function runBackupExport(): Promise<boolean> {
  const backup = await exportBackup(__APP_VERSION__);
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  try {
    await shareOrDownload(blob, backupFileName(), backupFileName());
  } catch (e) {
    if ((e as Error).name === 'AbortError') return false; // المستخدم قفل نافذة المشاركة
    throw e;
  }
  await setSetting(SETTING.lastBackupAt, todayISO());
  return true;
}

export async function runSeriesExport(seriesId: string): Promise<void> {
  const file = await exportSeriesFile(seriesId);
  const blob = new Blob([JSON.stringify(file, null, 1)], { type: 'application/json' });
  try {
    await shareOrDownload(blob, `${safeFileName(`${t().files.series}_${file.series.name}`)}.json`, file.series.name);
  } catch (e) {
    if ((e as Error).name !== 'AbortError') throw e;
  }
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    // iOS: لازم العنصر يبقى في الصفحة علشان onchange يشتغل
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 60_000);
  });
}
