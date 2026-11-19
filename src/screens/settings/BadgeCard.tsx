// الإعدادات ← رقم المتأخر على أيقونة التطبيق. على الآيفون محتاج إذن الإشعارات علشان الرقم يظهر.
import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { badgeSupported, computeAlerts, updateBadge } from '../../lib/alerts';
import { todayISO } from '../../lib/dates';

type Perm = 'granted' | 'denied' | 'default' | 'none';

const perm = (): Perm => (typeof Notification === 'undefined' ? 'none' : Notification.permission);

export function BadgeCard() {
  const m = t().alerts;
  const [state, setState] = useState<Perm>(perm);
  if (!badgeSupported()) return null;

  const enable = async () => {
    if (typeof Notification === 'undefined') return;
    const r = await Notification.requestPermission();
    setState(r);
    if (r === 'granted') await updateBadge((await computeAlerts(todayISO())).overdue);
  };

  return (
    <section class="card">
      <div class="card-title-row">
        <h2>{m.badge}</h2>
        {(state === 'granted' || state === 'none') && <span class="badge final-badge">{m.badgeOn}</span>}
      </div>
      <p class="muted small">{m.badgeHint}</p>
      {state === 'default' && (
        <button class="btn" onClick={() => void enable()}>
          {m.badgeEnable}
        </button>
      )}
      {state === 'denied' && <p class="warn small">{m.badgeBlocked}</p>}
    </section>
  );
}
