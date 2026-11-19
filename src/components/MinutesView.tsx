// المحضر بصيغة HTML (عرض A4 = 794px): للمعاينة والطباعة، ومنه بيتعمل الـ PDF.
// كل قسم «بلوك» مستقل (data-block)، والجداول ليها thead — علشان التقسيم لصفحات من غير قطع الصفوف.
import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { MinutesModel } from '../db/types';
import { CREAM_COLOR, LIGHT_COLOR } from '../domain/series';
import { fmt, t } from '../i18n';
import { formatDate } from '../lib/dates';

export const A4_WIDTH_PX = 794;

interface Props {
  model: MinutesModel;
  logoUrl?: string;
}

export function MinutesView({ model, logoUrl }: Props) {
  const m = t().minutes;
  const ms = t().meeting.registerStatuses;
  const st = t().task.statuses;
  const pr = t().task.priorities;
  const { colors, sections } = model;
  const th = { background: colors.secondary };
  const zebra = (i: number) => ({ background: i % 2 ? CREAM_COLOR : '#FFFFFF' });
  const present = model.attendees.filter((a) => a.present);

  // الحضور في عمودين
  const half = Math.ceil(model.attendees.length / 2);
  const left = model.attendees.slice(0, half);
  const right = model.attendees.slice(half);

  return (
    <article class="minutes" dir="rtl" style={{ '--mp': colors.primary, '--ms': colors.secondary, '--ml': LIGHT_COLOR }}>
      <header class="mv-block mv-head" data-block>
        {(logoUrl || model.orgName) && (
          <div class="mv-org">
            {logoUrl && <img src={logoUrl} alt="" />}
            {model.orgName && <span>{model.orgName}</span>}
          </div>
        )}
        <div class="mv-band" style={{ background: colors.primary }}>
          <strong>{m.title}</strong>
          <span>{model.seriesName}</span>
        </div>
        <table class="mv-info">
          <tbody>
            <tr>
              <td>
                {m.number}: <b>{model.number}</b>
              </td>
              <td>
                {m.date}: <b dir="ltr">{formatDate(model.date)}</b>
              </td>
              <td>
                {m.nextDate}: <b dir="ltr">{model.nextDate ? formatDate(model.nextDate) : m.none}</b>
              </td>
            </tr>
          </tbody>
        </table>
        {model.status === 'draft' && <p class="mv-draft">{t().meeting.draftBanner}</p>}
      </header>

      {model.attendees.length > 0 && (
        <Section title={m.attendance}>
          <table class="mv-table mv-att">
            <thead>
              <tr style={th}>
                <th class="n">{m.idx}</th>
                <th>{m.name}</th>
                <th class="c">{m.present}</th>
                {right.length > 0 && (
                  <>
                    <th class="n">{m.idx}</th>
                    <th>{m.name}</th>
                    <th class="c">{m.present}</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {left.map((a, i) => {
                const b = right[i];
                return (
                  <tr style={zebra(i)}>
                    <td class="n">{i + 1}</td>
                    <td>
                      {a.name}
                      {a.guest && <small> ({m.guest})</small>}
                    </td>
                    <td class="c box">{a.present ? '☑' : '☐'}</td>
                    {right.length > 0 &&
                      (b ? (
                        <>
                          <td class="n">{half + i + 1}</td>
                          <td>
                            {b.name}
                            {b.guest && <small> ({m.guest})</small>}
                          </td>
                          <td class="c box">{b.present ? '☑' : '☐'}</td>
                        </>
                      ) : (
                        <>
                          <td />
                          <td />
                          <td />
                        </>
                      ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>
      )}

      {model.topics.length > 0 && (
        <Section title={m.topics}>
          <ol class="mv-list">
            {model.topics.map((x) => (
              <li>{x}</li>
            ))}
          </ol>
        </Section>
      )}

      {model.notes.trim() && (
        <Section title={m.notes}>
          <p class="mv-notes">{model.notes}</p>
        </Section>
      )}

      {model.review.length > 0 && (
        <Section title={m.review}>
          <table class="mv-table">
            <thead>
              <tr style={th}>
                <th class="code">{m.code}</th>
                <th>{m.topic}</th>
                <th>{m.owner}</th>
                <th class="wide">{m.update}</th>
                <th>{m.status}</th>
              </tr>
            </thead>
            <tbody>
              {model.review.map((r, i) => (
                <tr style={zebra(i)}>
                  <td class="code" dir="ltr">
                    {r.code}
                  </td>
                  <td>{r.topic || m.none}</td>
                  <td>{r.owner || m.unassigned}</td>
                  <td class="wide">
                    {r.update}
                    {r.nextAction && (
                      <div class="mv-next">
                        <b>{m.next}:</b> {r.nextAction}
                      </div>
                    )}
                  </td>
                  <td class={`mv-status s-${r.status}`}>
                    {st[r.status]}
                    {r.delay > 0 && <div class="mv-late">{fmt(m.late, { n: r.delay })}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {sections.decisions && model.decisions.length > 0 && (
        <Section title={m.decisions}>
          <ol class="mv-list">
            {model.decisions.map((x) => (
              <li>
                {x.text}
                {x.taskCode && (
                  <span class="mv-ref" dir="ltr">
                    {' '}
                    ({x.taskCode})
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {sections.newTasks && model.newTasks.length > 0 && (
        <Section title={m.newTasks}>
          <table class="mv-table">
            <thead>
              <tr style={th}>
                <th class="code">{m.code}</th>
                <th class="wide">{m.description}</th>
                <th>{m.owner}</th>
                <th>{m.target}</th>
                <th>{m.priority}</th>
              </tr>
            </thead>
            <tbody>
              {model.newTasks.map((x, i) => (
                <tr style={zebra(i)}>
                  <td class="code" dir="ltr">
                    {x.code}
                  </td>
                  <td class="wide">
                    {x.description}
                    {x.topic && <div class="mv-sub">{x.topic}</div>}
                  </td>
                  <td>{x.owner || m.unassigned}</td>
                  <td dir="ltr" class="date">
                    {x.targetDate ? formatDate(x.targetDate) : m.none}
                  </td>
                  <td>{pr[x.priority]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {sections.register && model.register.length > 0 && (
        <Section title={model.registerName || m.register}>
          <table class="mv-table">
            <thead>
              <tr style={th}>
                <th class="n">{m.idx}</th>
                <th>{m.item}</th>
                <th class="wide">{m.text}</th>
                <th>{m.status}</th>
              </tr>
            </thead>
            <tbody>
              {model.register.map((x, i) => (
                <tr style={zebra(i)} class={x.isNew ? 'mv-new' : ''}>
                  <td class="n">{i + 1}</td>
                  <td>{x.item}</td>
                  <td class="wide">{x.text}</td>
                  <td>{ms[x.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {sections.signatures && present.length > 0 && (
        <Section title={m.signatures}>
          <table class="mv-table mv-sign">
            <thead>
              <tr style={th}>
                <th class="n">{m.idx}</th>
                <th>{m.name}</th>
                <th class="wide">{m.signature}</th>
              </tr>
            </thead>
            <tbody>
              {present.map((a, i) => (
                <tr>
                  <td class="n">{i + 1}</td>
                  <td>{a.name}</td>
                  <td class="wide" />
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </article>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="mv-block mv-section" data-block>
      <h2 class="mv-h">{title}</h2>
      {children}
    </section>
  );
}

/** عرض صفحة بعرض A4 مصغّرة على قد عرض الشاشة. */
export function ScaledPage({ children }: { children: ComponentChildren }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>();

  const measure = () => {
    if (!outer.current || !inner.current) return;
    const s = Math.min(1, outer.current.clientWidth / A4_WIDTH_PX);
    setScale(s);
    setHeight(inner.current.scrollHeight * s);
  };
  useLayoutEffect(measure);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div class="scaled-outer" ref={outer} style={height !== undefined ? { height: `${height}px` } : undefined}>
      <div class="scaled-inner" ref={inner} style={{ width: `${A4_WIDTH_PX}px`, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
