// الإعدادات ← قفل بـ PIN: تفعيل/تغيير/إلغاء.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { useLive } from '../../db/live';
import { fmt, t } from '../../i18n';
import { getPin, isValidPin, PIN_MAX, PIN_MIN, setPin, verifyPin } from '../../lib/pin';

type Mode = 'set' | 'change' | 'remove';

export function PinCard() {
  const m = t().pin;
  const pin = useLive(() => getPin(), []);
  const [mode, setMode] = useState<Mode | null>(null);
  const on = !!pin;

  return (
    <section class="card">
      <div class="card-title-row">
        <h2>{m.title}</h2>
        <span class={`badge ${on ? 'final-badge' : ''}`}>{on ? m.on : m.off}</span>
      </div>
      <p class="muted small">{m.hint}</p>
      <div class="btn-row">
        {on ? (
          <>
            <button class="btn grow" onClick={() => setMode('change')}>
              {m.change}
            </button>
            <button class="btn ghost" onClick={() => setMode('remove')}>
              {m.remove}
            </button>
          </>
        ) : (
          <button class="btn grow" onClick={() => setMode('set')}>
            {m.set}
          </button>
        )}
      </div>
      <p class="pin-note small">{m.forgotNote}</p>
      {mode && <PinSheet mode={mode} onClose={() => setMode(null)} />}
    </section>
  );
}

function PinSheet({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  const m = t().pin;
  const [current, setCurrent] = useState('');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const range = { min: PIN_MIN, max: PIN_MAX };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      if (mode !== 'set') {
        const stored = await getPin();
        if (!stored || !(await verifyPin(current, stored))) return setError(m.wrong);
      }
      if (mode === 'remove') {
        await setPin(null);
        alert(m.removed);
        return onClose();
      }
      if (!isValidPin(a)) return setError(fmt(m.invalid, range));
      if (a !== b) return setError(m.mismatch);
      await setPin(a);
      alert(m.saved);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const pinInput = (label: string, value: string, set: (v: string) => void, autoFocus = false) => (
    <div class="field">
      <label>{label}</label>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={PIN_MAX}
        dir="ltr"
        class="pin-input"
        value={value}
        autoFocus={autoFocus}
        onInput={(e) => set(e.currentTarget.value.replace(/\D/g, ''))}
      />
    </div>
  );

  return (
    <Sheet
      title={mode === 'set' ? m.set : mode === 'change' ? m.change : m.remove}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={save} disabled={busy}>
            {t().common.save}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        {mode !== 'set' && pinInput(m.current, current, setCurrent, true)}
        {mode !== 'remove' && (
          <>
            {pinInput(fmt(m.enterNew, range), a, setA, mode === 'set')}
            {pinInput(m.confirm, b, setB)}
          </>
        )}
        {error && <p class="error-text">{error}</p>}
        <button type="submit" hidden />
      </form>
      {mode === 'set' && <p class="pin-note small">{m.forgotNote}</p>}
    </Sheet>
  );
}
