// تنبيه الرئيسية: لو آخر نسخة احتياطية عدّى عليها أكتر من 7 أيام (أو لسه متعملتش ومعاك بيانات).
import { useState } from 'preact/hooks';
import { useLive } from '../db/live';
import { getSetting, SETTING } from '../db/repos/settings';
import { db } from '../db/schema';
import { fmt, t } from '../i18n';
import { runBackupExport } from '../lib/backupActions';
import { diffDays, todayISO } from '../lib/dates';
import { lastBackupText } from '../screens/settings/BackupCard';

export const REMIND_AFTER_DAYS = 7;

export function BackupReminder() {
  const m = t().backup;
  const state = useLive(async () => {
    const [last, series] = await Promise.all([getSetting<string>(SETTING.lastBackupAt), db.series.count()]);
    return { last, series };
  }, []);
  const [busy, setBusy] = useState(false);
  if (!state || state.series === 0) return null;
  const due = !state.last || diffDays(state.last, todayISO()) > REMIND_AFTER_DAYS;
  if (!due) return null;

  const run = async () => {
    setBusy(true);
    try {
      await runBackupExport();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card notice backup-reminder">
      <h2>{m.reminderTitle}</h2>
      <p>{fmt(m.reminderBody, { when: state.last ? lastBackupText(state.last) : m.reminderNever })}</p>
      <button class="btn primary" onClick={run} disabled={busy}>
        {m.export}
      </button>
    </section>
  );
}
