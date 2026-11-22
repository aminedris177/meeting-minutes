// تنبيه في الرئيسية لو مساحة التطبيق عدّت 80%.
import { useLive } from '../db/live';
import { listFiles, STORAGE_WARN_RATIO, storageRatio } from '../db/files';
import { fmt, t } from '../i18n';

export function StorageWarning() {
  const m = t().exported;
  // بيتحسب تاني لما عدد الملفات يتغير
  const n = useLive(async () => (await listFiles()).length, []);
  const ratio = useLive(() => storageRatio(), [n]);
  if (ratio === undefined || ratio < STORAGE_WARN_RATIO) return null;
  return (
    <section class="card notice">
      <p class="warn">{fmt(m.storageWarn, { pct: Math.round(ratio * 100) })}</p>
      <a class="btn sm" href="#/settings/files">
        {m.open}
      </a>
    </section>
  );
}
