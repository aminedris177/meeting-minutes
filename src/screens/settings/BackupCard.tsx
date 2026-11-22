// الإعدادات ← النسخ الاحتياطي: تصدير، استرجاع (مع نسخة أمان تلقائية)، نسخ الأمان، نقل سلسلة، استيراد Excel.
import { useState } from 'preact/hooks';
import {
  compareBackup,
  type BackupDiff,
  type BackupFile,
  getSafetySnapshot,
  importSeriesFile,
  listSafetySnapshots,
  parseBackup,
  parseSeriesFile,
  safeRestore,
} from '../../db/backup';
import { useLive } from '../../db/live';
import { getSetting, SETTING } from '../../db/repos/settings';
import { fmt, t } from '../../i18n';
import { pickFile, runBackupExport } from '../../lib/backupActions';
import { diffDays, formatDate, todayISO } from '../../lib/dates';
import { ExcelImport } from './ExcelImport';
import { Sheet } from '../../components/Sheet';

export function lastBackupText(last: string | undefined): string {
  const m = t().backup;
  if (!last) return m.never;
  const days = diffDays(last, todayISO());
  return days <= 0 ? m.today : fmt(m.daysAgo, { n: days });
}

export function BackupCard() {
  const m = t().backup;
  const last = useLive(() => getSetting<string>(SETTING.lastBackupAt), []);
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof listSafetySnapshots>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [excel, setExcel] = useState(false);
  const [pending, setPending] = useState<{ backup: BackupFile; diff: BackupDiff } | null>(null);

  const guard = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => guard(async () => void (await runBackupExport()));

  const doRestore = () =>
    guard(async () => {
      const file = await pickFile('application/json,.json');
      if (!file) return;
      const parsed = parseBackup(await file.text());
      if (!parsed.ok) {
        alert(m.errors[parsed.error]);
        return;
      }
      setPending({ backup: parsed.backup, diff: await compareBackup(parsed.backup) });
    });

  const confirmRestore = () =>
    guard(async () => {
      if (!pending) return;
      await safeRestore(pending.backup, __APP_VERSION__);
      alert(m.restored);
      location.reload();
    });

  const showSnapshots = () => guard(async () => setSnapshots(await listSafetySnapshots()));

  const restoreSnapshot = (id: number) =>
    guard(async () => {
      if (!confirm(m.confirmSafety)) return;
      const b = await getSafetySnapshot(id);
      if (!b) return;
      await safeRestore(b, __APP_VERSION__);
      alert(m.restored);
      location.reload();
    });

  const doImportSeries = () =>
    guard(async () => {
      const file = await pickFile('application/json,.json');
      if (!file) return;
      const f = parseSeriesFile(await file.text());
      if (!f) {
        alert(m.seriesBadFile);
        return;
      }
      const { series, addedPeople } = await importSeriesFile(f);
      alert(fmt(m.seriesImported, { name: series.name, n: addedPeople }));
      location.hash = `/series/${series.id}`;
    });

  return (
    <section class="card">
      <h2>{m.title}</h2>
      <p class="muted small">{m.hint}</p>
      <p>
        {m.last}: <b class={!last || diffDays(last, todayISO()) > 7 ? 'late' : ''}>{lastBackupText(last)}</b>
      </p>
      <div class="btn-col">
        <button class="btn primary" onClick={doExport} disabled={busy}>
          {m.export}
        </button>
        <button class="btn" onClick={doRestore} disabled={busy}>
          {m.restore}
        </button>
        <button class="btn ghost" onClick={() => setExcel(true)} disabled={busy}>
          {t().excel.button}
        </button>
        <button class="btn ghost" onClick={doImportSeries} disabled={busy}>
          {m.importSeries}
        </button>
      </div>

      <details class="safety" onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void showSnapshots()}>
        <summary>{m.safety}</summary>
        <p class="muted small">{m.safetyHint}</p>
        {snapshots?.length === 0 && <p class="muted small">—</p>}
        {snapshots?.map((s) => (
          <div class="safety-row" key={s.id}>
            <span>
              {m.safetyReasons[s.reason as keyof typeof m.safetyReasons] ?? s.reason}
              <small class="muted" dir="ltr">
                {' '}
                {formatDate(s.createdAt.slice(0, 10))} {s.createdAt.slice(11, 16)}
              </small>
            </span>
            <button class="btn ghost sm" onClick={() => void restoreSnapshot(s.id!)} disabled={busy}>
              {m.safetyRestore}
            </button>
          </div>
        ))}
      </details>

      {excel && <ExcelImport onClose={() => setExcel(false)} />}
      {pending && (
        <Sheet
          title={m.compare.title}
          onClose={() => setPending(null)}
          footer={
            <>
              <button class="btn primary grow" onClick={confirmRestore} disabled={busy}>
                {m.compare.confirm}
              </button>
              <button class="btn ghost" onClick={() => setPending(null)}>
                {t().common.cancel}
              </button>
            </>
          }
        >
          <p class="muted">{fmt(m.compare.fileDate, { date: pending.backup.exportedAt ? formatDate(pending.backup.exportedAt.slice(0, 10)) : '—' })}</p>
          <table class="cmp-table">
            <thead>
              <tr>
                <th />
                <th>{m.compare.current}</th>
                <th>{m.compare.file}</th>
              </tr>
            </thead>
            <tbody>
              {pending.diff.counts.map((c) => (
                <tr key={c.kind} class={c.incoming < c.current ? 'less' : ''}>
                  <th>{m.compare.kinds[c.kind]}</th>
                  <td>{c.current}</td>
                  <td>{c.incoming}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {pending.diff.newerLocal > 0 && <p class="warn">{fmt(m.compare.newer, { n: pending.diff.newerLocal })}</p>}
          {pending.diff.seriesLost.length > 0 && (
            <p class="warn">
              {m.compare.lost} <b>{pending.diff.seriesLost.join('، ')}</b>
            </p>
          )}
          {pending.diff.seriesNew.length > 0 && (
            <p>
              {m.compare.added} <b>{pending.diff.seriesNew.join('، ')}</b>
            </p>
          )}
          <p class="muted small">{m.compare.safe}</p>
        </Sheet>
      )}
    </section>
  );
}
