// الرئيسية: تنبيهات المتأخر واللي معاده قرّب واجتماع النهارده/بكرة — كل سطر بيفتح المكان المناسب.
import { useLive } from '../db/live';
import { fmt, t } from '../i18n';
import { computeAlerts } from '../lib/alerts';
import { todayISO } from '../lib/dates';
import { navigate } from '../lib/router';

function openFollowup(status: 'overdue' | 'open') {
  try {
    localStorage.setItem('followup-filter', JSON.stringify({ seriesId: 'all', ownerId: 'all', status }));
  } catch {
    /* ignore */
  }
  navigate('/followup');
}

export function AlertsBanner() {
  const m = t().alerts;
  const today = todayISO();
  const a = useLive(() => computeAlerts(today), [today]);
  if (!a || (a.overdue === 0 && a.soon === 0 && a.meetings.length === 0)) return null;

  return (
    <section class="card alerts" aria-label={m.title}>
      <h2>{m.title}</h2>
      <ul class="alert-list">
        {a.meetings.map((x) => (
          <li>
            <a class="alert-row meeting" href={`#/series/${x.series.id}`} style={{ '--c': x.series.colors.primary }}>
              <i class="alert-dot" />
              <span>{fmt(x.when === 'today' ? m.meetingToday : m.meetingTomorrow, { name: x.series.name })}</span>
            </a>
          </li>
        ))}
        {a.overdue > 0 && (
          <li>
            <button class="alert-row late" onClick={() => openFollowup('overdue')}>
              <i class="alert-dot" />
              <span>{fmt(m.overdue, { n: a.overdue })}</span>
            </button>
          </li>
        )}
        {a.soon > 0 && (
          <li>
            <button class="alert-row soon" onClick={() => openFollowup('open')}>
              <i class="alert-dot" />
              <span>{fmt(m.soon, { n: a.soon })}</span>
            </button>
          </li>
        )}
      </ul>
    </section>
  );
}
