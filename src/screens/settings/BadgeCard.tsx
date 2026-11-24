// الإعدادات ← تنبيه المتأخر: الرقم على أيقونة التطبيق (آيفون/ديسكتوب) + إشعار المتأخر (بديل أندرويد).
// الاتنين محتاجين إذن الإشعارات.
import { useEffect, useState } from 'preact/hooks';
import { Toggle } from '../../components/fields';
import { useLive } from '../../db/live';
import { t } from '../../i18n';
import { badgeSupported, computeAlerts, updateBadge } from '../../lib/alerts';
import { todayISO } from '../../lib/dates';
import { backgroundSyncActive, isOverdueNotifyOn, notifySupported, setOverdueNotify, syncOverdueNotification } from '../../lib/overdueNotify';

type Perm = 'granted' | 'denied' | 'default' | 'none';

const perm = (): Perm => (typeof Notification === 'undefined' ? 'none' : Notification.permission);

export function BadgeCard() {
  const m = t().alerts;
  const [state, setState] = useState<Perm>(perm);
  const notifyOn = useLive(() => isOverdueNotifyOn(), []);
  const [bg, setBg] = useState(false);
  const badge = badgeSupported();
  const canNotify = notifySupported();
  const notifying = !!notifyOn && state === 'granted';

  useEffect(() => {
    void backgroundSyncActive().then(setBg);
  }, [notifyOn]);

  const ask = async (): Promise<Perm> => {
    if (typeof Notification === 'undefined') return 'none';
    const r = await Notification.requestPermission();
    setState(r);
    return r;
  };

  const enableBadge = async () => {
    if ((await ask()) === 'granted') await updateBadge((await computeAlerts(todayISO())).overdue);
  };

  const toggleNotify = async (on: boolean) => {
    if (on && state !== 'granted' && (await ask()) !== 'granted') return;
    await setOverdueNotify(on);
    setBg(await backgroundSyncActive());
    if (on) await syncOverdueNotification((await computeAlerts(todayISO())).overdue, true);
  };

  return (
    <section class="card">
      <div class="card-title-row">
        <h2>{m.badge}</h2>
        {badge && (state === 'granted' || state === 'none') && <span class="badge final-badge">{m.badgeOn}</span>}
      </div>
      {badge ? <p class="muted small">{m.badgeHint}</p> : <p class="muted small">{m.badgeUnsupported}</p>}
      <p class="muted small">{m.countHint}</p>
      {badge && state === 'default' && (
        <button class="btn" onClick={() => void enableBadge()}>
          {m.badgeEnable}
        </button>
      )}
      {state === 'denied' && <p class="warn small">{m.badgeBlocked}</p>}
      {canNotify ? (
        <>
          <Toggle label={m.notify} checked={notifying} onChange={(v) => void toggleNotify(v)} hint={m.notifyHint} />
          {notifying && <p class="muted small">{bg ? m.notifyBgOn : m.notifyBgOff}</p>}
        </>
      ) : (
        <p class="muted small">{m.notifyUnsupported}</p>
      )}
    </section>
  );
}
