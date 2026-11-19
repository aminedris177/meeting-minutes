// صفحة السلسلة: الاجتماع القادم، بدء/استكمال اجتماع، قائمة الاجتماعات، والمهام.
import { useState } from 'preact/hooks';
import { FollowupPdfButton } from '../../components/FollowupPdfButton';
import { EmptyState, Screen } from '../../components/Screen';
import { ChevronIcon, PlusIcon, SettingsIcon } from '../../components/icons';
import { useLive } from '../../db/live';
import { createMeeting, getDraft, listMeetings, seriesNextDate } from '../../db/repos/meetings';
import { listSeriesSummaries } from '../../db/repos/series';
import { db } from '../../db/schema';
import { fmt, t } from '../../i18n';
import { formatDate, todayISO } from '../../lib/dates';
import { navigate } from '../../lib/router';
import { runSeriesExport } from '../../lib/backupActions';

export function SeriesPage({ id }: { id: string }) {
  const series = useLive(async () => (await db.series.get(id)) ?? null, [id]);
  if (series === undefined) return <main class="screen" />;
  if (series === null) {
    return (
      <Screen title={t().series.notFound} back="#/">
        <a class="btn" href="#/">{t().common.back}</a>
      </Screen>
    );
  }
  return <SeriesBody id={id} />;
}

function SeriesBody({ id }: { id: string }) {
  const ms = t().meetings;
  const sp = t().seriesPage;
  const today = todayISO();
  const series = useLive(() => db.series.get(id), [id]);
  const meetings = useLive(() => listMeetings(id), [id]);
  const draft = useLive(() => getDraft(id), [id]);
  const next = useLive(async () => (series ? seriesNextDate(series) : undefined), [series?.updatedAt, meetings?.length]);
  const summary = useLive(async () => (await listSeriesSummaries(today)).find((x) => x.series.id === id), [id, today]);
  const [busy, setBusy] = useState(false);
  if (!series) return <main class="screen" />;

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const m = draft ?? (await createMeeting(id, today));
      navigate(`/meeting/${m.id}`);
    } finally {
      setBusy(false);
    }
  };

  const openFollowup = () => {
    try {
      localStorage.setItem('followup-filter', JSON.stringify({ seriesId: id, ownerId: 'all', status: 'open' }));
    } catch {
      /* ignore */
    }
    navigate('/followup');
  };

  return (
    <Screen
      title={series.name}
      back="#/"
      actions={
        <a class="icon-btn" href={`#/series/${id}/edit`} aria-label={sp.edit}>
          <SettingsIcon />
        </a>
      }
    >
      <section class="card series-hero" style={{ '--series': series.colors.primary }}>
        <div class="hero-row">
          <span class="muted">{ms.next}</span>
          <b dir="ltr" class={next && next < today ? 'late' : ''}>
            {next ? formatDate(next) : t().home.noNextMeeting}
          </b>
        </div>
        {series.archived ? (
          <p class="warn small">{sp.archived}</p>
        ) : (
          <button class="btn primary full-width big" onClick={start} disabled={busy}>
            {draft ? (
              <>
                {ms.resume} · {fmt(ms.meetingN, { n: draft.number })}
              </>
            ) : (
              <>
                <PlusIcon width={18} height={18} /> {ms.start}
              </>
            )}
          </button>
        )}
      </section>

      {summary && (
        <button class="card nav-card" onClick={openFollowup}>
          <span class="list-main">
            <span class="list-title">{sp.tasks}</span>
            <span class="list-sub">
              {fmt(sp.openTasks, { n: summary.openTasks })}
              {summary.overdueTasks > 0 && <b class="late"> · {fmt(sp.overdue, { n: summary.overdueTasks })}</b>}
            </span>
          </span>
          <ChevronIcon />
        </button>
      )}
      <div class="btn-row tight">
        <FollowupPdfButton seriesId={id} class="btn ghost grow" />
        <button class="btn ghost grow" onClick={() => void runSeriesExport(id).catch((e) => alert(String(e)))}>
          {t().backup.exportSeries}
        </button>
      </div>

      <h2 class="section-title">{sp.meetings}</h2>
      {meetings && meetings.length === 0 && <EmptyState text={ms.none} />}
      {meetings && meetings.length > 0 && (
        <ul class="list card flush">
          {meetings.map((mt) => (
            <li key={mt.id}>
              <a class="list-row" href={`#/meeting/${mt.id}`}>
                <span class="avatar num">{mt.number}</span>
                <span class="list-main">
                  <span class="list-title" dir="ltr" style={{ textAlign: 'right' }}>
                    {formatDate(mt.date)}
                  </span>
                  <span class="list-sub">{fmt(ms.meetingN, { n: mt.number })}</span>
                </span>
                <span class={`badge ${mt.status === 'draft' ? 'draft-badge' : 'final-badge'}`}>{mt.status === 'draft' ? ms.draft : ms.final}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}
