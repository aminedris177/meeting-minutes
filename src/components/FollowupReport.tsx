// تقرير متابعة المهام لسلسلة واحدة (للـ PDF، صفحة A4 بالعرض).
import type { Person, Series, Task, TaskUpdate } from '../db/types';
import { displayName } from '../db/repos/people';
import { CREAM_COLOR, LIGHT_COLOR } from '../domain/series';
import { dir, t } from '../i18n';
import { formatDate, type ISODate } from '../lib/dates';

export interface FollowupRow {
  task: Task;
  owner?: Person;
  delay: number;
  latest?: TaskUpdate;
}

export interface FollowupData {
  orgName: string;
  series: Series;
  today: ISODate;
  rows: FollowupRow[];
  counts: { open: number; overdue: number; done: number; total: number };
}

export function FollowupReport({ data, logoUrl }: { data: FollowupData; logoUrl?: string }) {
  const m = t().minutes;
  const f = t().report;
  const st = t().task.statuses;
  const { series } = data;
  const th = { background: series.colors.secondary };
  return (
    <article class="minutes report" dir={dir()} style={{ width: '1123px', '--mp': series.colors.primary, '--ms': series.colors.secondary, '--ml': LIGHT_COLOR }}>
      <header class="mv-block mv-head" data-block>
        {(logoUrl || data.orgName) && (
          <div class="mv-org">
            {logoUrl && <img src={logoUrl} alt="" />}
            {data.orgName && <span>{data.orgName}</span>}
          </div>
        )}
        <div class="mv-band" style={{ background: series.colors.primary }}>
          <strong>{f.title}</strong>
          <span>{series.name}</span>
        </div>
        <table class="mv-info">
          <tbody>
            <tr>
              <td>
                {f.date}: <b dir="ltr">{formatDate(data.today)}</b>
              </td>
              <td>
                {f.open}: <b>{data.counts.open}</b>
              </td>
              <td>
                {f.overdue}: <b class="late">{data.counts.overdue}</b>
              </td>
              <td>
                {f.done}: <b>{data.counts.done}</b>
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      <section class="mv-block mv-section" data-block data-split>
        <h2 class="mv-h">{f.tasks}</h2>
        <table class="mv-table">
          <thead>
            <tr style={th}>
              <th class="code">{m.code}</th>
              <th>{m.topic}</th>
              <th class="wide">{m.description}</th>
              <th>{m.owner}</th>
              <th>{f.created}</th>
              <th>{m.target}</th>
              <th>{m.status}</th>
              <th>{f.delay}</th>
              <th class="wide2">{f.latest}</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr style={{ background: i % 2 ? CREAM_COLOR : '#FFFFFF' }} class={r.delay > 0 ? 'row-late' : ''}>
                <td class="code" dir="ltr">
                  {r.task.code}
                </td>
                <td>{r.task.topic || m.none}</td>
                <td class="wide">{r.task.description}</td>
                <td>{r.owner ? displayName(r.owner) : m.unassigned}</td>
                <td class="date" dir="ltr">
                  {formatDate(r.task.createdDate)}
                </td>
                <td class="date" dir="ltr">
                  {r.task.targetDate ? formatDate(r.task.targetDate) : m.none}
                </td>
                <td class={`mv-status s-${r.task.status}`}>{st[r.task.status]}</td>
                <td class={`c ${r.delay > 0 ? 'late' : ''}`}>{r.delay > 0 ? r.delay : m.none}</td>
                <td class="wide2">
                  {r.latest?.text}
                  {r.latest?.nextAction && (
                    <div class="mv-next">
                      <b>{m.next}:</b> {r.latest.nextAction}
                    </div>
                  )}
                  {r.latest && (
                    <div class="mv-sub align-start" dir="ltr">
                      {formatDate(r.latest.date)}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.rows.length === 0 && <p>{f.empty}</p>}
      </section>
    </article>
  );
}
