// المتابعة: كروت المهام مع فلتر بالسلسلة والمسؤول والحالة. المتأخر بالأحمر، وتغيير الحالة بلمسة.
import { useEffect, useState } from 'preact/hooks';
import { EmptyState, Screen } from '../components/Screen';
import { PlusIcon } from '../components/icons';
import { StatusPicker } from '../components/task/Status';
import { TaskCard } from '../components/task/TaskCard';
import { TaskForm } from '../components/task/TaskForm';
import { FollowupExportButtons } from '../components/FollowupExportButtons';
import { useLive } from '../db/live';
import { displayName, listPeople } from '../db/repos/people';
import {
  countByStatus,
  queryTasks,
  setTaskStatus,
  TASK_STATUSES,
  type StatusFilter,
  type TaskFilter,
  type TaskRow,
} from '../db/repos/tasks';
import { db } from '../db/schema';
import { fmt, t } from '../i18n';
import { todayISO } from '../lib/dates';
import { groupByDue } from '../domain/followup';
import { WhatsAppButton } from '../components/WhatsAppButton';

const FILTER_KEY = 'followup-filter';
const DEFAULT_FILTER: TaskFilter = { seriesId: 'all', ownerId: 'all', status: 'open' };

// الفلتر بيتفتكر على الجهاز (راحة بس — لو التخزين مش متاح بيرجع للافتراضي)
function loadFilter(): TaskFilter {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    return raw ? { ...DEFAULT_FILTER, ...(JSON.parse(raw) as Partial<TaskFilter>), query: '' } : DEFAULT_FILTER;
  } catch {
    return DEFAULT_FILTER;
  }
}
function saveFilter(f: TaskFilter): void {
  try {
    const { query: _q, ...rest } = f;
    localStorage.setItem(FILTER_KEY, JSON.stringify(rest));
  } catch {
    /* ignore */
  }
}

const STATUS_CHIPS: StatusFilter[] = ['open', 'overdue', ...TASK_STATUSES, 'all'];

export function FollowupScreen() {
  const m = t().followup;
  const mt = t().task;
  const today = todayISO();
  const [filter, setFilterState] = useState<TaskFilter>(loadFilter);
  const [statusFor, setStatusFor] = useState<TaskRow | null>(null);
  const [adding, setAdding] = useState(false);

  const setFilter = (patch: Partial<TaskFilter>) =>
    setFilterState((f) => {
      const next = { ...f, ...patch };
      saveFilter(next);
      return next;
    });

  const rows = useLive(() => queryTasks(filter, today), [filter.seriesId, filter.ownerId, filter.status, filter.query, today]);
  const counts = useLive(() => countByStatus({ seriesId: filter.seriesId, ownerId: filter.ownerId }, today), [filter.seriesId, filter.ownerId, today]);
  const seriesList = useLive(() => db.series.toArray(), []);
  const people = useLive(() => listPeople(), []);
  const ownerIds = useLive(async () => new Set((await db.tasks.toArray()).map((x) => x.ownerId)), []);

  // لو السلسلة المحفوظة في الفلتر اتمسحت
  useEffect(() => {
    if (seriesList && filter.seriesId !== 'all' && !seriesList.some((s) => s.id === filter.seriesId)) setFilter({ seriesId: 'all' });
  }, [seriesList, filter.seriesId]);

  const owners = (people ?? []).filter((p) => ownerIds?.has(p.id));
  const totalTasks = counts?.all ?? 0;
  const hasAnyTask = useLive(() => db.tasks.count(), []);

  const chipLabel = (s: StatusFilter) =>
    s === 'open' || s === 'overdue' || s === 'all' ? m.filters[s] : mt.statusesShort[s];

  return (
    <Screen title={m.title}>
      {seriesList !== undefined && seriesList.length === 0 ? (
        <EmptyState text={m.empty} hint={m.noSeries}>
          <a class="btn primary" href="#/series/new">
            <PlusIcon width={18} height={18} /> {t().home.newSeries}
          </a>
        </EmptyState>
      ) : (
        <>
          {hasAnyTask !== undefined && hasAnyTask > 0 && (
            <>
              <div class="filter-row">
                <select
                  aria-label={mt.series}
                  value={filter.seriesId}
                  onChange={(e) => setFilter({ seriesId: e.currentTarget.value })}
                  class={filter.seriesId !== 'all' ? 'active' : ''}
                >
                  <option value="all">{m.allSeries}</option>
                  {(seriesList ?? []).map((s) => (
                    <option value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  aria-label={mt.owner}
                  value={filter.ownerId}
                  onChange={(e) => setFilter({ ownerId: e.currentTarget.value })}
                  class={filter.ownerId !== 'all' ? 'active' : ''}
                >
                  <option value="all">{m.allOwners}</option>
                  <option value="none">{mt.unassigned}</option>
                  {owners.map((p) => (
                    <option value={p.id}>{displayName(p)}</option>
                  ))}
                </select>
              </div>

              <div class="chips" role="tablist">
                {STATUS_CHIPS.map((s) => {
                  const n = counts?.[s] ?? 0;
                  if (n === 0 && s !== 'open' && s !== 'all' && s !== filter.status) return null;
                  return (
                    <button
                      key={s}
                      role="tab"
                      aria-selected={filter.status === s}
                      class={`chip ${filter.status === s ? 'on' : ''} ${s === 'overdue' && n > 0 ? 'danger' : ''}`}
                      onClick={() => setFilter({ status: s })}
                    >
                      {chipLabel(s)} <span class="chip-n">{n}</span>
                    </button>
                  );
                })}
              </div>

              <input
                class="search"
                type="search"
                placeholder={m.search}
                value={filter.query ?? ''}
                onInput={(e) => setFilter({ query: e.currentTarget.value })}
              />
              <div class="followup-tools">
                {filter.ownerId !== 'all' && filter.ownerId !== 'none' && <WhatsAppButton ownerId={filter.ownerId} seriesId={filter.seriesId} />}
                <a class="btn ghost sm" href="#/report">
                  {m.report}
                </a>
              </div>
              {filter.seriesId !== 'all' && <FollowupExportButtons seriesId={filter.seriesId} />}
            </>
          )}

          {rows !== undefined && hasAnyTask === 0 && <EmptyState text={m.empty} hint={m.emptyHint} />}
          {rows !== undefined && hasAnyTask !== 0 && rows.length === 0 && totalTasks >= 0 && <EmptyState text={m.noMatch} />}

          {rows &&
            groupByDue(rows, today).map(({ group, rows: gr }) => (
              <section key={group} class="due-group">
                <h3 class={'group-title g-' + group}>
                  {m.groups[group]} <span class="chip-n">{gr.length}</span>
                </h3>
                {gr.map((r) => (
                  <TaskCard key={r.task.id} row={r} today={today} showSeries={filter.seriesId === 'all'} onStatus={() => setStatusFor(r)} />
                ))}
              </section>
            ))}

          {rows && rows.length > 0 && <p class="muted small center">{fmt(m.count, { n: rows.length })}</p>}

          {seriesList && seriesList.some((s) => !s.archived) && (
            <button class="fab" onClick={() => setAdding(true)}>
              <PlusIcon /> <span>{mt.new}</span>
            </button>
          )}
        </>
      )}

      {statusFor && (
        <StatusPicker
          current={statusFor.task.status}
          title={`${mt.changeStatus} · ${statusFor.task.code}`}
          onPick={(s) => void setTaskStatus(statusFor.task.id, s, today)}
          onClose={() => setStatusFor(null)}
        />
      )}
      {adding && seriesList && people && (
        <TaskForm
          seriesList={seriesList}
          people={people}
          defaultSeriesId={filter.seriesId !== 'all' ? filter.seriesId : undefined}
          onClose={() => setAdding(false)}
        />
      )}
    </Screen>
  );
}
