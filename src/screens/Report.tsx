// تقرير المسؤولين: لكل مسؤول شريط (متأخر / مفتوح في معاده / اتقفل) + الأرقام، ونسبة الإغلاق في المعاد.
import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../components/Screen';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { useLive } from '../db/live';
import { displayName } from '../db/repos/people';
import { db } from '../db/schema';
import { ownerStats } from '../domain/followup';
import { fmt, t } from '../i18n';
import { todayISO } from '../lib/dates';

const FILTER_KEY = 'followup-filter';

// الضغط على اسم المسؤول بيفتح المتابعة متفلترة عليه
function openOwner(ownerId: string | null, seriesId: string) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify({ seriesId, ownerId: ownerId ?? 'none', status: 'open' }));
  } catch {
    /* ignore */
  }
  window.location.hash = '/followup';
}

export function ReportScreen() {
  const m = t().followup;
  const mt = t().task;
  const today = todayISO();
  const [seriesId, setSeriesId] = useState('all');
  const seriesList = useLive(() => db.series.toArray(), []);
  const data = useLive(async () => {
    const [tasks, people] = await Promise.all([db.tasks.toArray(), db.people.toArray()]);
    const scoped = tasks.filter((x) => seriesId === 'all' || x.seriesId === seriesId);
    return { stats: ownerStats(scoped, today), people: new Map(people.map((p) => [p.id, p])) };
  }, [seriesId, today]);

  const max = Math.max(1, ...(data?.stats ?? []).map((s) => s.open + s.closed));
  const name = (id: string | null) => {
    const p = id ? data?.people.get(id) : undefined;
    return p ? displayName(p) : mt.unassigned;
  };

  return (
    <Screen title={m.report} back="#/followup">
      <p class="muted small">{m.reportHint}</p>
      <select class={seriesId !== 'all' ? 'active' : ''} value={seriesId} aria-label={mt.series} onChange={(e) => setSeriesId(e.currentTarget.value)}>
        <option value="all">{m.allSeries}</option>
        {(seriesList ?? []).map((s) => (
          <option value={s.id}>{s.name}</option>
        ))}
      </select>

      <div class="rep-legend" aria-hidden="true">
        <span><i class="seg-overdue" />{m.reportCols.overdue}</span>
        <span><i class="seg-open" />{m.reportCols.open}</span>
        <span><i class="seg-closed" />{m.reportCols.closed}</span>
      </div>

      {data && data.stats.length === 0 && <EmptyState text={m.reportEmpty} />}
      {data?.stats.map((s) => {
        const onTimeOpen = s.open - s.overdue;
        const rate = s.closed ? Math.round((s.onTime / s.closed) * 100) : null;
        const label = `${name(s.ownerId)}: ${m.reportCols.overdue} ${s.overdue}، ${m.reportCols.open} ${s.open}، ${m.reportCols.closed} ${s.closed}`;
        return (
          <section class="card rep-row" key={s.ownerId ?? 'none'}>
            <button class="rep-name" onClick={() => openOwner(s.ownerId, seriesId)}>
              {name(s.ownerId)}
            </button>
            <div class="rep-bar" role="img" aria-label={label}>
              {s.overdue > 0 && <span class="seg-overdue" style={{ width: `${(s.overdue / max) * 100}%` }} title={`${m.reportCols.overdue}: ${s.overdue}`} />}
              {onTimeOpen > 0 && <span class="seg-open" style={{ width: `${(onTimeOpen / max) * 100}%` }} title={`${m.reportCols.open}: ${onTimeOpen}`} />}
              {s.closed > 0 && <span class="seg-closed" style={{ width: `${(s.closed / max) * 100}%` }} title={`${m.reportCols.closed}: ${s.closed}`} />}
            </div>
            <dl class="rep-nums">
              <div>
                <dt>{m.reportCols.open}</dt>
                <dd>{s.open}</dd>
              </div>
              <div class={s.overdue ? 'danger' : ''}>
                <dt>{m.reportCols.overdue}</dt>
                <dd>{s.overdue}</dd>
              </div>
              <div>
                <dt>{m.reportCols.closed}</dt>
                <dd>{s.closed}</dd>
              </div>
              <div>
                <dt>{m.reportCols.onTime}</dt>
                <dd>{rate === null ? '—' : `${rate}%`}</dd>
              </div>
              <div>
                <dt>{m.reportCols.avgDelay}</dt>
                <dd>{s.avgDelay ? fmt(m.daysShort, { n: s.avgDelay }) : '—'}</dd>
              </div>
            </dl>
            {s.ownerId && s.open > 0 && <WhatsAppButton ownerId={s.ownerId} seriesId={seriesId} small />}
          </section>
        );
      })}
    </Screen>
  );
}
