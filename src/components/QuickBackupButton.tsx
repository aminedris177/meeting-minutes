// زرار نسخة احتياطية بلمسة واحدة في رأس الرئيسية: بيفتح المشاركة على طول.
import { useState } from 'preact/hooks';
import { fmt, t } from '../i18n';
import { runBackupExport } from '../lib/backupActions';
import { BackupIcon, CheckIcon } from './icons';

export function QuickBackupButton() {
  const m = t().backup;
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const run = async () => {
    setState('busy');
    try {
      const ok = await runBackupExport();
      setState(ok ? 'done' : 'idle');
      if (ok) setTimeout(() => setState('idle'), 2500);
    } catch (e) {
      setState('idle');
      alert(fmt(t().common.error, { msg: String(e) }));
    }
  };
  return (
    <button class="icon-btn" onClick={() => void run()} disabled={state === 'busy'} aria-label={state === 'done' ? m.quickDone : m.quick} title={m.quick}>
      {state === 'done' ? <CheckIcon /> : <BackupIcon />}
    </button>
  );
}
