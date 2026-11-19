// شاشة القفل: لوحة أرقام + «نسيت الـ PIN» (مسح البيانات والاسترجاع من نسخة احتياطية).
import { useState } from 'preact/hooks';
import { wipeAllData } from '../db/backup';
import { fmt, t } from '../i18n';
import { PIN_MAX, PIN_MIN, setPin, setSessionUnlocked, verifyPin, type StoredPin } from '../lib/pin';

const MAX_TRIES = 5;
const LOCKOUT_S = 30;

export function LockScreen({ stored, onUnlock }: { stored: StoredPin; onUnlock: () => void }) {
  const m = t().pin;
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [tries, setTries] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [checking, setChecking] = useState(false);
  const [forgot, setForgot] = useState(false);

  const blocked = Date.now() < waitUntil;

  const check = async (v: string) => {
    if (checking || blocked) return;
    setChecking(true);
    try {
      if (await verifyPin(v, stored)) return onUnlock();
      const n = tries + 1;
      setTries(n);
      setValue('');
      if (n % MAX_TRIES === 0) {
        setWaitUntil(Date.now() + LOCKOUT_S * 1000);
        setError(fmt(m.tooMany, { n: LOCKOUT_S }));
        setTimeout(() => setError(''), LOCKOUT_S * 1000);
      } else setError(m.wrong);
    } finally {
      setChecking(false);
    }
  };

  const press = (d: string) => {
    if (blocked || checking) return;
    setError('');
    const v = (value + d).slice(0, PIN_MAX);
    setValue(v);
    // فتح تلقائي أول ما آخر رقم يتكتب
    if (stored.length) {
      if (v.length === stored.length) void check(v);
    } else if (v.length >= PIN_MIN) {
      // PIN قديم من غير طول متخزن: نجرّب بهدوء من غير ما نعدّ محاولة غلط
      void verifyPin(v, stored).then((ok) => ok && onUnlock());
    }
  };

  if (forgot) return <ForgotPin onBack={() => setForgot(false)} />;

  return (
    <div class="lock" role="dialog" aria-modal="true" aria-label={m.lockTitle}>
      <div class="lock-box">
        <img class="lock-icon" src="favicon.svg" alt="" />
        <h1>{m.lockTitle}</h1>
        <p class="muted">{m.lockPrompt}</p>
        <div class="pin-dots" dir="ltr" aria-live="polite">
          {Array.from({ length: stored.length ?? Math.max(PIN_MIN, value.length) }, (_, i) => (
            <span class={i < value.length ? 'on' : ''} />
          ))}
        </div>
        <p class="error-text" role="alert">
          {error}
        </p>
        <div class="keypad" dir="ltr">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button type="button" onClick={() => press(d)} disabled={blocked}>
              {d}
            </button>
          ))}
          <button type="button" class="key-muted" onClick={() => setValue(value.slice(0, -1))} aria-label="⌫">
            ⌫
          </button>
          <button type="button" onClick={() => press('0')} disabled={blocked}>
            0
          </button>
          <button type="button" class="key-ok" onClick={() => void check(value)} disabled={value.length < PIN_MIN || blocked || checking}>
            {m.unlock}
          </button>
        </div>
        <button type="button" class="link-btn" onClick={() => setForgot(true)}>
          {m.forgot}
        </button>
      </div>
    </div>
  );
}

function ForgotPin({ onBack }: { onBack: () => void }) {
  const m = t().pin;
  const [word, setWord] = useState('');
  const [busy, setBusy] = useState(false);
  const wipe = async () => {
    if (word.trim() !== m.wipeWord) return;
    setBusy(true);
    try {
      await wipeAllData(__APP_VERSION__);
      await setPin(null);
      setSessionUnlocked(false);
      alert(m.wiped);
      location.hash = '/settings';
      location.reload();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div class="lock" role="dialog" aria-modal="true">
      <div class="lock-box forgot">
        <h1>{m.forgotTitle}</h1>
        <p class="pre">{m.forgotBody}</p>
        <div class="field">
          <label for="wipe-word">{m.wipeConfirmLabel}</label>
          <input id="wipe-word" value={word} onInput={(e) => setWord(e.currentTarget.value)} autoComplete="off" />
        </div>
        <button class="btn danger full-width" disabled={word.trim() !== m.wipeWord || busy} onClick={wipe}>
          {m.wipe}
        </button>
        <button class="btn ghost full-width" onClick={onBack}>
          {t().common.back}
        </button>
      </div>
    </div>
  );
}
