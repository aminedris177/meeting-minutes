// ملحوظة صغيرة بتظهر لحد ما المستخدم يدوس «فهمت» (بتتفتكر على الجهاز).
import { useState } from 'preact/hooks';
import { t } from '../i18n';

const key = (id: string) => `hint-${id}`;

function seen(id: string): boolean {
  try {
    return localStorage.getItem(key(id)) === '1';
  } catch {
    return false;
  }
}

export function Hint({ id, text }: { id: string; text: string }) {
  const [hidden, setHidden] = useState(() => seen(id));
  if (hidden) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(key(id), '1');
    } catch {
      /* وضع خاص: تختفي للجلسة دي بس */
    }
    setHidden(true);
  };
  return (
    <div class="hint" role="note">
      <span class="hint-icon" aria-hidden="true">ℹ️</span>
      <p>{text}</p>
      <button class="btn ghost sm" onClick={dismiss}>
        {t().common.gotIt}
      </button>
    </div>
  );
}
