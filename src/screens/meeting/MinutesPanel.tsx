// معاينة المحضر + أزرار الاعتماد والتصدير — بتتستخدم في خطوة 7 وفي صفحة المحضر النهائي (الأرشيف).
import { useState } from 'preact/hooks';
import { MinutesView, ScaledPage } from '../../components/MinutesView';
import { useLive } from '../../db/live';
import { buildMinutes, finalizeMeeting, reopenMeeting } from '../../db/repos/meetings';
import { getOrg } from '../../db/repos/org';
import type { Meeting, MinutesModel } from '../../db/types';
import { exportMinutes, type ExportKind } from '../../export/actions';
import { fmt, t } from '../../i18n';
import { useObjectUrl } from '../../lib/image';

export function MinutesPanel({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const model = useLive(() => buildMinutes(meeting.id), [meeting.id, meeting.status, meeting.updatedAt]);
  const org = useLive(() => getOrg(), []);
  const logoUrl = useObjectUrl(org?.logo);
  const [busy, setBusy] = useState<ExportKind | null>(null);
  const isFinal = meeting.status === 'final';

  const run = async (kind: ExportKind, mdl: MinutesModel) => {
    setBusy(kind);
    try {
      await exportMinutes(kind, mdl, org?.logo, logoUrl);
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <section class="card minutes-actions">
        {isFinal ? (
          <p class="final-tag">{m.finalized}</p>
        ) : (
          <button class="btn primary full-width" onClick={() => confirm(m.confirmFinalize) && void finalizeMeeting(meeting.id)}>
            {m.finalize}
          </button>
        )}
        {model && (
          <div class="export-row">
            <button class="btn" disabled={!!busy} onClick={() => void run('word', model)}>
              {busy === 'word' ? m.exporting : m.exportWord}
            </button>
            <button class="btn" disabled={!!busy} onClick={() => void run('pdf', model)}>
              {busy === 'pdf' ? m.exporting : m.exportPdf}
            </button>
            <button class="btn ghost" disabled={!!busy} onClick={() => void run('print', model)}>
              {m.print}
            </button>
          </div>
        )}
        {isFinal && (
          <button class="btn ghost sm" onClick={() => confirm(m.confirmReopen) && void reopenMeeting(meeting.id)}>
            {m.reopen}
          </button>
        )}
      </section>
      {model && (
        <ScaledPage>
          <MinutesView model={model} logoUrl={logoUrl} />
        </ScaledPage>
      )}
    </>
  );
}
