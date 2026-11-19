// أزرار تصدير ملف المتابعة لسلسلة واحدة: PDF وExcel.
import { useState } from 'preact/hooks';
import { fmt, t } from '../i18n';

type Kind = 'pdf' | 'xlsx';

export function FollowupExportButtons({ seriesId }: { seriesId: string }) {
  const [busy, setBusy] = useState<Kind | null>(null);
  const run = async (kind: Kind) => {
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        const { exportFollowupPdf } = await import('../export/pdf');
        await exportFollowupPdf(seriesId);
      } else {
        const { exportFollowupXlsx } = await import('../export/followupXlsx');
        await exportFollowupXlsx(seriesId);
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div class="btn-row tight">
      <button class="btn ghost grow" onClick={() => void run('pdf')} disabled={!!busy}>
        {busy === 'pdf' ? t().meeting.exporting : t().report.export}
      </button>
      <button class="btn ghost grow" onClick={() => void run('xlsx')} disabled={!!busy}>
        {busy === 'xlsx' ? t().meeting.exporting : t().xlsx.button}
      </button>
    </div>
  );
}
