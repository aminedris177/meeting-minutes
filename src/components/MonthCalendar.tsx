// تقويم شهري جوه التطبيق: الاجتماعات (اللي اتعملت والمسودات والجاية من التكرار) ومواعيد المهام.
// الأسبوع بيبدأ السبت. لمسة على يوم = تفاصيله تحت الشبكة.
import { useState } from 'preact/hooks';
import { useLive } from '../db/live';
import { seriesNextDate } from '../db/repos/meetings';
import { displayName } from '../db/repos/people';
import { db } from '../db/schema';
import { monthEnd, monthGrid, monthOf, projectedMeetings, shiftMonth, type MonthRef } from '../domain/calendar';
import { isOpen } from '../domain/delay';
import { fmt, getLang, t } from '../i18n';
import { formatDate, parseISODate, todayISO, type ISODate } from '../lib/dates';
import { ChevronIcon } from './icons';

type Kind = 'held' | 'draft' | 'planned' | 'due' | 'late';

interface CalEvent {
  date: ISODate;
  kind: Kind;
  color: string;
  title: string;
  sub: string;
  href: string;
}

const locale = () => (getLang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB');

async function loadEvents(m: MonthRef, today: ISODate): Promise<CalEvent[]> {
  const grid = monthGrid(m);
  const from = grid[0];
  const to = grid[grid.length - 1];
  const [allSeries, meetings, tasks, people] = await Promise.all([db.series.toArray(), db.meetings.toArray(), db.tasks.toArray(), db.people.toArray()]);
  const series = allSeries.filter((s) => !s.archived);
  const sMap = new Map(allSeries.map((s) => [s.id, s]));
  const pMap = new Map(people.map((p) => [p.id, p]));
  const mt = t().meetings;
  const out: CalEvent[] = [];

  for (const mtg of meetings) {
    const s = sMap.get(mtg.seriesId);
    if (!s || mtg.date < from || mtg.date > to) continue;
    out.push({
      date: mtg.date,
      kind: mtg.status === 'final' ? 'held' : 'draft',
      color: s.colors.primary,
      title: s.name,
      sub: `${fmt(mt.meetingN, { n: mtg.number })} · ${mtg.status === 'final' ? mt.final : mt.draft}`,
      href: `#/meeting/${mtg.id}`,
    });
  }

  for (const s of series) {
    const existing = new Set(meetings.filter((x) => x.seriesId === s.id).map((x) => x.date));
    const next = await seriesNextDate(s);
    for (const d of projectedMeetings(next, s.recurrence, from, to, existing)) {
      out.push({ date: d, kind: 'planned', color: s.colors.primary, title: s.name, sub: t().calendar.planned, href: `#/series/${s.id}` });
    }
  }

  for (const task of tasks) {
    if (!isOpen(task) || !task.targetDate || task.targetDate < from || task.targetDate > to) continue;
    const s = sMap.get(task.seriesId);
    if (!s || s.archived) continue;
    const owner = task.ownerId ? pMap.get(task.ownerId) : undefined;
    out.push({
      date: task.targetDate,
      kind: task.targetDate < today ? 'late' : 'due',
      color: s.colors.secondary,
      title: `${task.code} · ${task.description}`,
      sub: owner ? displayName(owner) : t().task.unassigned,
      href: `#/task/${task.id}`,
    });
  }
  return out;
}

export function MonthCalendar() {
  const m = t().calendar;
  const today = todayISO();
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const [selected, setSelected] = useState<ISODate>(today);
  const events = useLive(() => loadEvents(month, today), [month.year, month.month, today]);
  const grid = monthGrid(month);
  const byDay = new Map<ISODate, CalEvent[]>();
  for (const e of events ?? []) byDay.set(e.date, [...(byDay.get(e.date) ?? []), e]);

  const title = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(parseISODate(`${month.year}-${String(month.month).padStart(2, '0')}-01`));
  // أسماء الأيام من سبت معروف (31/10/2026)
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(locale(), { weekday: 'short' }).format(new Date(2026, 9, 31 + i)));
  const inMonth = (d: ISODate) => d.slice(0, 7) === monthEnd(month).slice(0, 7);
  const dayEvents = (byDay.get(selected) ?? []).sort((a, b) => order(a.kind) - order(b.kind));

  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    const isThisMonth = monthOf(today).year === next.year && monthOf(today).month === next.month;
    setSelected(isThisMonth ? today : `${next.year}-${String(next.month).padStart(2, '0')}-01`);
  };

  return (
    <section class="card cal">
      <div class="cal-head">
        <button class="icon-btn" onClick={() => go(-1)} aria-label={m.prev}>
          <ChevronIcon class="chev-back" />
        </button>
        <h2>{title}</h2>
        <button class="icon-btn" onClick={() => go(1)} aria-label={m.next}>
          <ChevronIcon />
        </button>
      </div>
      <div class="cal-grid" role="grid">
        {weekdays.map((w) => (
          <span class="cal-wd" role="columnheader">
            {w}
          </span>
        ))}
        {grid.map((d) => {
          const evs = byDay.get(d) ?? [];
          const meetings = evs.filter((e) => e.kind === 'held' || e.kind === 'draft' || e.kind === 'planned');
          const dues = evs.filter((e) => e.kind === 'due' || e.kind === 'late');
          const late = dues.some((e) => e.kind === 'late');
          return (
            <button
              key={d}
              role="gridcell"
              class={`cal-day ${inMonth(d) ? '' : 'out'} ${d === today ? 'today' : ''} ${d === selected ? 'sel' : ''}`}
              aria-label={`${formatDate(d)}${evs.length ? ` · ${evs.length}` : ''}`}
              aria-selected={d === selected}
              onClick={() => setSelected(d)}
            >
              <span class="cal-num">{Number(d.slice(8))}</span>
              <span class="cal-marks">
                {meetings.slice(0, 3).map((e) => (
                  <i class={`mk ${e.kind === 'planned' ? 'hollow' : 'dot'}`} style={{ '--c': e.color }} />
                ))}
                {dues.length > 0 && <i class={`mk sq ${late ? 'late' : ''}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <div class="cal-legend">
        <span>
          <i class="mk dot" /> {m.legendHeld}
        </span>
        <span>
          <i class="mk hollow" /> {m.legendPlanned}
        </span>
        <span>
          <i class="mk sq" /> {m.legendDue}
        </span>
        <span>
          <i class="mk sq late" /> {m.legendLate}
        </span>
      </div>
      <div class="cal-day-list">
        <h3 dir="ltr" class="align-start">
          {formatDate(selected)}
        </h3>
        {dayEvents.length === 0 ? (
          <p class="muted small">{m.empty}</p>
        ) : (
          <ul class="list">
            {dayEvents.map((e) => (
              <li>
                <a class="list-row cal-ev" href={e.href}>
                  <i class={`mk ${e.kind === 'planned' ? 'hollow' : e.kind === 'due' || e.kind === 'late' ? `sq ${e.kind === 'late' ? 'late' : ''}` : 'dot'}`} style={{ '--c': e.color }} />
                  <span class="list-main">
                    <span class="list-title">{e.title}</span>
                    <span class="list-sub">{e.sub}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

const order = (k: Kind) => ({ held: 0, draft: 1, planned: 2, late: 3, due: 4 })[k];
