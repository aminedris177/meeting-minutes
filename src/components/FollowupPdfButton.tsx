// زرار «ملف المتابعة PDF» لسلسلة واحدة.
import { useState } from 'preact/hooks';
import { fmt, t } from '../i18n';

export function FollowupPdfButton({ seriesId, class: cls = 'btn ghost' }: { seriesId: string; class?: string }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const { exportFollowupPdf } = await import('../export/pdf');
      await exportFollowupPdf(seriesId);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };
  return (
    <button class={cls} onClick={run} disabled={busy}>
      {busy ? t().meeting.exporting : t().report.export}
    </button>
  );
}
