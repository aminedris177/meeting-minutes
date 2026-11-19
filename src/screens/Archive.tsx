// الأرشيف: الاجتماعات النهائية لكل سلسلة (إعادة تصدير)، والمهام المغلقة، والسلاسل المؤرشفة.
import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../components/Screen';
import { Segmented } from '../components/fields';
import { useLive } from '../db/live';
import { displayName } from '../db/repos/people';
import { db } from '../db/schema';
import type { Meeting, Series } from '../db/types';
import { isOpen } from '../domain/delay';
import { fmt, t } from '../i18n';
import { formatDate } from '../lib/dates';

type Tab = 'meetings' | 'tasks' | 'series';
const PREVIEW_N = 5;

export function ArchiveScreen() {
  const a = t().archive;
  const [tab, setTab] = useState<Tab>('meetings');
  const data = useLive(async () => {
    const [series, meetings, tasks, people] = await Promise.all([db.series.toArray(), db.meetings.toArray(), db.tasks.toArray(), db.people.toArray()]);
    return { series: series.sort((x, y) => x.createdAt - y.createdAt), meetings, tasks, people };
  }, []);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  if (!data) return <Screen title={a.title} />;

  const finals = (s: Series): Meeting[] =>
    data.meetings.filter((m) => m.seriesId === s.id && m.status === 'final').sort((x, y) => y.number - x.number);
  const pMap = new Map(data.people.map((p) => [p.id, p]));
  const sMap = new Map(data.series.map((s) => [s.id, s]));
  const closed = data.tasks.filter((x) => !isOpen(x)).sort((x, y) => (y.closedDate ?? '').localeCompare(x.closedDate ?? ''));
  const archivedSeries = data.series.filter((s) => s.archived);

  return (
    <Screen title={a.title}>
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'meetings', label: a.meetings },
          { value: 'tasks', label: a.closedTasks },
          { value: 'series', label: a.archivedSeries },
        ]}
      />

      {tab === 'meetings' &&
        (data.series.every((s) => finals(s).length === 0) ? (
          <EmptyState text={a.empty} />
        ) : (
          data.series
            .filter((s) => finals(s).length > 0)
            .map((s) => {
              const list = finals(s);
              const open = expanded.has(s.id);
              const shown = open ? list : list.slice(0, PREVIEW_N);
              return (
                <section class="card flush" key={s.id}>
                  <h2 class="flush-title">{s.name}</h2>
                  <ul class="list">
                    {shown.map((m) => (
                      <li key={m.id}>
                        <a class="list-row" href={`#/meeting/${m.id}`}>
                          <span class="avatar num">{m.number}</span>
                          <span class="list-main">
                            <span class="list-title" dir="ltr" style={{ textAlign: 'right' }}>
                              {formatDate(m.date)}
                            </span>
                            <span class="list-sub">{a.view}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                  {list.length > PREVIEW_N && !open && (
                    <button class="btn ghost full-width flat" onClick={() => setExpanded(new Set([...expanded, s.id]))}>
                      {fmt(a.showAll, { n: list.length })}
                    </button>
                  )}
                </section>
              );
            })
        ))}

      {tab === 'tasks' &&
        (closed.length === 0 ? (
          <EmptyState text={a.noClosed} />
        ) : (
          <ul class="list card flush">
            {closed.map((x) => {
              const owner = x.ownerId ? pMap.get(x.ownerId) : undefined;
              return (
                <li key={x.id}>
                  <a class="list-row" href={`#/task/${x.id}`}>
                    <span class="code" dir="ltr">
                      {x.code}
                    </span>
                    <span class="list-main">
                      <span class="list-title">{x.description}</span>
                      <span class="list-sub">
                        {sMap.get(x.seriesId)?.name} · {owner ? displayName(owner) : t().task.unassigned}
                        {x.closedDate && (
                          <>
                            {' · '}
                            <span dir="ltr">{formatDate(x.closedDate)}</span>
                          </>
                        )}
                      </span>
                    </span>
                    <span class={`status s-${x.status}`}>{t().task.statusesShort[x.status]}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        ))}

      {tab === 'series' &&
        (archivedSeries.length === 0 ? (
          <EmptyState text={t().home.empty} />
        ) : (
          <ul class="list card flush">
            {archivedSeries.map((s) => (
              <li key={s.id}>
                <a class="list-row" href={`#/series/${s.id}`}>
                  <span class="list-main">
                    <span class="list-title">{s.name}</span>
                    <span class="list-sub">{s.meetingCounter} {t().home.meetingsCount}</span>
                  </span>
                  <span class="badge" dir="ltr">
                    {s.taskPrefix}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ))}
    </Screen>
  );
}
