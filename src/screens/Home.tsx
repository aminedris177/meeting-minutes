import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../components/Screen';
import { PlusIcon } from '../components/icons';
import { useLive } from '../db/live';
import { getOrg } from '../db/repos/org';
import { listSeriesSummaries, type SeriesSummary } from '../db/repos/series';
import { t } from '../i18n';
import { formatDate, todayISO } from '../lib/dates';

export function HomeScreen() {
  const m = t().home;
  const today = todayISO();
  const summaries = useLive(() => listSeriesSummaries(today), [today]);
  const org = useLive(() => getOrg(), []);
  const [showArchived, setShowArchived] = useState(false);

  const active = summaries?.filter((s) => !s.series.archived) ?? [];
  const archived = summaries?.filter((s) => s.series.archived) ?? [];

  return (
    <Screen title={m.title}>
      {org && !org.name && (
        <section class="card notice">
          <p>{m.setupOrg}</p>
          <a class="btn sm" href="#/settings">{m.setupOrgAction}</a>
        </section>
      )}

      {summaries !== undefined && active.length === 0 && archived.length === 0 && (
        <EmptyState text={m.empty} hint={m.emptyHint}>
          <a class="btn primary" href="#/series/new">
            <PlusIcon width={18} height={18} /> {m.newSeries}
          </a>
        </EmptyState>
      )}

      {active.map((s) => (
        <SeriesCard key={s.series.id} summary={s} today={today} />
      ))}

      {archived.length > 0 && (
        <button class="btn ghost" onClick={() => setShowArchived(!showArchived)}>
          {showArchived ? m.hideArchived : `${m.showArchived} (${archived.length})`}
        </button>
      )}
      {showArchived && archived.map((s) => <SeriesCard key={s.series.id} summary={s} today={today} />)}

      {summaries !== undefined && (active.length > 0 || archived.length > 0) && (
        <a class="fab" href="#/series/new">
          <PlusIcon /> <span>{m.newSeries}</span>
        </a>
      )}
    </Screen>
  );
}

function SeriesCard({ summary, today }: { summary: SeriesSummary; today: string }) {
  const m = t().home;
  const { series: s, openTasks, overdueTasks, nextMeeting, meetingsCount } = summary;
  const rec = s.recurrence.kind === 'custom' ? `${t().series.kinds.custom} · ${s.recurrence.everyDays} ${t().series.everyDaysUnit}` : t().series.kinds[s.recurrence.kind];
  const nextPast = nextMeeting !== undefined && nextMeeting < today;

  return (
    <a class={`card series-card ${s.archived ? 'archived' : ''}`} href={`#/series/${s.id}`} style={{ '--series': s.colors.primary }}>
      <div class="series-head">
        <h2>{s.name}</h2>
        <span class="badge" dir="ltr">{s.taskPrefix}</span>
      </div>
      <p class="muted small">
        {rec} · {meetingsCount} {m.meetingsCount}
        {s.archived && ` · ${m.archived}`}
      </p>
      <div class="stats">
        <div class="stat">
          <span class="stat-num">{openTasks}</span>
          <span class="stat-label">{m.openTasks}</span>
        </div>
        <div class={`stat ${overdueTasks > 0 ? 'danger' : ''}`}>
          <span class="stat-num">{overdueTasks}</span>
          <span class="stat-label">{m.overdueTasks}</span>
        </div>
        <div class={`stat wide ${nextPast ? 'danger' : ''}`}>
          <span class="stat-num date" dir="ltr">{nextMeeting ? formatDate(nextMeeting) : '—'}</span>
          <span class="stat-label">{m.nextMeeting}</span>
        </div>
      </div>
    </a>
  );
}
