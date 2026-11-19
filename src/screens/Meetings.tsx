// تبويب الاجتماعات: لكل سلسلة نشطة — بدء/استكمال اجتماع، والاجتماع القادم، وآخر اجتماع.
import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../components/Screen';
import { PlusIcon } from '../components/icons';
import { useLive } from '../db/live';
import { createMeeting, getDraft, listMeetings, seriesNextDate } from '../db/repos/meetings';
import { db } from '../db/schema';
import type { Meeting, Series } from '../db/types';
import { fmt, t } from '../i18n';
import { formatDate, todayISO } from '../lib/dates';
import { navigate } from '../lib/router';

interface Row {
  series: Series;
  draft?: Meeting;
  last?: Meeting;
  next?: string;
}

export function MeetingsScreen() {
  const m = t().meetings;
  const today = todayISO();
  const rows = useLive(async (): Promise<Row[]> => {
    const all = (await db.series.toArray()).filter((s) => !s.archived).sort((a, b) => a.createdAt - b.createdAt);
    return Promise.all(
      all.map(async (series) => {
        const meetings = await listMeetings(series.id);
        return {
          series,
          draft: await getDraft(series.id),
          last: meetings.find((x) => x.status === 'final'),
          next: await seriesNextDate(series),
        };
      }),
    );
  }, []);
  const [busy, setBusy] = useState<string | null>(null);

  const start = async (r: Row) => {
    if (busy) return;
    setBusy(r.series.id);
    try {
      const mt = r.draft ?? (await createMeeting(r.series.id, today));
      navigate(`/meeting/${mt.id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={m.title}>
      {rows && rows.length === 0 && (
        <EmptyState text={m.empty} hint={m.noSeries}>
          <a class="btn primary" href="#/series/new">
            <PlusIcon width={18} height={18} /> {t().home.newSeries}
          </a>
        </EmptyState>
      )}
      {rows?.map((r) => (
        <section class="card meeting-series" style={{ '--series': r.series.colors.primary }} key={r.series.id}>
          <a class="ms-head" href={`#/series/${r.series.id}`}>
            <h2>{r.series.name}</h2>
          </a>
          <div class="ms-dates">
            <span>
              <span class="muted">{m.next}: </span>
              <b dir="ltr" class={r.next && r.next < today ? 'late' : ''}>
                {r.next ? formatDate(r.next) : t().home.noNextMeeting}
              </b>
            </span>
            {r.last && (
              <a href={`#/meeting/${r.last.id}`}>
                <span class="muted">{m.lastMeeting}: </span>
                {fmt(m.meetingN, { n: r.last.number })} · <span dir="ltr">{formatDate(r.last.date)}</span>
              </a>
            )}
          </div>
          <button class={`btn ${r.draft ? '' : 'primary'} full-width`} disabled={busy === r.series.id} onClick={() => void start(r)}>
            {r.draft ? `${m.resume} · ${fmt(m.meetingN, { n: r.draft.number })}` : m.start}
          </button>
        </section>
      ))}
    </Screen>
  );
}
