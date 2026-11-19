// معالج إنشاء/تعديل سلسلة: الاسم ← البادئة ← التكرار ← الحضور ← المحاور ← أقسام المحضر.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { ColorField, DateField, Segmented, TextField, Toggle } from '../../components/fields';
import { CloseIcon, PlusIcon, TrashIcon } from '../../components/icons';
import { SortableList } from '../../components/SortableList';
import { useLive } from '../../db/live';
import { displayName, listPeople } from '../../db/repos/people';
import {
  canDeleteSeries,
  createSeries,
  deleteSeries,
  seriesUsesPrefix,
  setSeriesArchived,
  updateSeries,
  validateSeries,
  type SeriesError,
} from '../../db/repos/series';
import { db } from '../../db/schema';
import type { RecurrenceKind, Series } from '../../db/types';
import { isValidRecurrence, nextMeetingDate } from '../../domain/recurrence';
import { DEFAULT_COLORS, emptySeriesDraft, normalizePrefix, PREFIX_MAX, type SeriesDraft } from '../../domain/series';
import { formatTaskCode } from '../../domain/numbering';
import { fmt, t } from '../../i18n';
import { formatDate } from '../../lib/dates';
import { navigate } from '../../lib/router';
import { MemberPicker } from './MemberPicker';
import { MinutesPreview } from './MinutesPreview';

const STEPS = ['name', 'prefix', 'recurrence', 'members', 'topics', 'sections'] as const;
type Step = (typeof STEPS)[number];

const STEP_ERRORS: Record<Step, SeriesError[]> = {
  name: ['name'],
  prefix: ['prefix'],
  recurrence: ['recurrence'],
  members: [],
  topics: [],
  sections: ['colors'],
};

interface Topic {
  key: string;
  text: string;
}

let topicSeq = 0;
const toTopics = (list: string[]): Topic[] => list.map((text) => ({ key: `t${topicSeq++}`, text }));

export function SeriesWizard({ id }: { id?: string }) {
  const series = useLive(async () => (id ? ((await db.series.get(id)) ?? null) : null), [id]);
  if (id && series === undefined) return <main class="screen" />;
  if (id && series === null) {
    return (
      <main class="screen">
        <div class="empty">
          <p>{t().series.notFound}</p>
          <a class="btn" href="#/">{t().common.back}</a>
        </div>
      </main>
    );
  }
  return <WizardBody key={id ?? 'new'} existing={series ?? undefined} />;
}

function WizardBody({ existing }: { existing?: Series }) {
  const m = t().series;
  const isEdit = !!existing;
  const initial = useMemo<SeriesDraft>(() => {
    if (!existing) return emptySeriesDraft();
    const { name, taskPrefix, recurrence, firstMeetingDate, memberIds, defaultTopics, colors, sections, registerName } = existing;
    return { name, taskPrefix, recurrence, firstMeetingDate, memberIds, defaultTopics, colors, sections, registerName };
  }, [existing]);

  const [draft, setDraft] = useState<SeriesDraft>(initial);
  const [topics, setTopics] = useState<Topic[]>(() => toTopics(initial.defaultTopics));
  const [step, setStep] = useState<Step>('name');
  const [visited, setVisited] = useState<Set<Step>>(new Set(['name']));
  const [showErrors, setShowErrors] = useState<Set<Step>>(new Set());
  const [picking, setPicking] = useState(false);
  const [dupPrefix, setDupPrefix] = useState(false);
  const [busy, setBusy] = useState(false);
  const people = useLive(() => listPeople(), []);
  const bodyRef = useRef<HTMLDivElement>(null);
  // المحور اللي لسه متضاف — بنركّز عليه بعد ما يترسم فعلاً
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  useLayoutEffect(() => {
    if (!focusTopic) return;
    bodyRef.current?.querySelector<HTMLInputElement>(`input[data-topic="${focusTopic}"]`)?.focus();
    setFocusTopic(null);
  }, [focusTopic, topics]);

  const full: SeriesDraft = { ...draft, defaultTopics: topics.map((x) => x.text) };
  const errors = validateSeries(full);
  const stepHasError = (s: Step) => STEP_ERRORS[s].some((e) => errors.includes(e));
  const shown = (s: Step) => showErrors.has(s) && stepHasError(s);
  const dirty = JSON.stringify(full) !== JSON.stringify(initial);

  const set = <K extends keyof SeriesDraft>(k: K, v: SeriesDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  useEffect(() => {
    const p = normalizePrefix(draft.taskPrefix);
    if (!p) return setDupPrefix(false);
    let alive = true;
    void seriesUsesPrefix(p, existing?.id).then((v) => alive && setDupPrefix(v));
    return () => {
      alive = false;
    };
  }, [draft.taskPrefix, existing?.id]);

  const goTo = (s: Step) => {
    setStep(s);
    setVisited((v) => new Set([...v, s]));
    bodyRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  };

  const idx = STEPS.indexOf(step);
  const next = () => {
    if (stepHasError(step)) {
      setShowErrors((s) => new Set([...s, step]));
      return;
    }
    goTo(STEPS[idx + 1]);
  };

  const save = async () => {
    if (errors.length) {
      setShowErrors(new Set(STEPS));
      const first = STEPS.find(stepHasError);
      if (first) goTo(first);
      return;
    }
    setBusy(true);
    try {
      // بعد الحفظ: صفحة السلسلة (منها بيبدأ الاجتماع)
      if (existing) {
        await updateSeries(existing.id, full);
        navigate(`/series/${existing.id}`);
      } else {
        const created = await createSeries(full);
        navigate(`/series/${created.id}`);
      }
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    if (dirty && !confirm(m.discard)) return;
    history.length > 1 ? history.back() : navigate('/');
  };

  const peopleById = new Map((people ?? []).map((p) => [p.id, p]));
  // النشطين اللي لسه مش في الحضور — لزرار «اختيار الكل»
  const unselectedActive = (people ?? []).filter((p) => p.active && !draft.memberIds.includes(p.id));
  const isLast = idx === STEPS.length - 1;

  return (
    <main class="screen wizard">
      <header class="screen-header">
        <button class="icon-btn" onClick={cancel} aria-label={m.cancel}>
          <CloseIcon />
        </button>
        <h1>{isEdit ? m.editTitle : m.newTitle}</h1>
      </header>

      <nav class="steps" aria-label={fmt(m.step, { n: idx + 1, total: STEPS.length })}>
        {STEPS.map((s, i) => (
          <button
            key={s}
            class={`step-tab ${s === step ? 'current' : ''} ${visited.has(s) || isEdit ? 'visited' : ''} ${showErrors.has(s) && stepHasError(s) ? 'error' : ''}`}
            onClick={() => goTo(s)}
            aria-current={s === step ? 'step' : undefined}
          >
            <span class="step-num">{i + 1}</span>
            <span class="step-label">{m.steps[s]}</span>
          </button>
        ))}
      </nav>

      <div class="screen-body" ref={bodyRef}>
        {step === 'name' && (
          <section class="card">
            <TextField
              label={m.name}
              value={draft.name}
              onInput={(v) => set('name', v)}
              placeholder={m.namePlaceholder}
              error={shown('name') && m.nameRequired}
              autoFocus={!isEdit}
            />
          </section>
        )}

        {step === 'prefix' && (
          <section class="card">
            <TextField
              label={m.prefix}
              value={draft.taskPrefix}
              onInput={(v) => set('taskPrefix', v.toUpperCase().replace(/[^A-Za-z0-9]/g, ''))}
              dir="ltr"
              maxLength={PREFIX_MAX}
              autoCapitalize="characters"
              error={shown('prefix') && m.prefixInvalid}
              hint={fmt(m.prefixHint, { max: PREFIX_MAX })}
              autoFocus
            />
            {normalizePrefix(draft.taskPrefix) && (
              <p class="prefix-preview" dir="ltr">
                {[1, 2, 100].map((n) => formatTaskCode(normalizePrefix(draft.taskPrefix), n)).join('   ·   ')}
              </p>
            )}
            {dupPrefix && <p class="warn small">{m.prefixDuplicate}</p>}
            {existing && existing.taskCounter > 0 && normalizePrefix(draft.taskPrefix) !== existing.taskPrefix && (
              <p class="warn small">{m.prefixLocked}</p>
            )}
          </section>
        )}

        {step === 'recurrence' && (
          <section class="card">
            <div class="field">
              <span class="label">{m.recurrence}</span>
              <Segmented<RecurrenceKind>
                value={draft.recurrence.kind}
                options={(['weekly', 'biweekly', 'monthly', 'custom'] as const).map((k) => ({ value: k, label: m.kinds[k] }))}
                onChange={(kind) => set('recurrence', kind === 'custom' ? { kind, everyDays: draft.recurrence.everyDays ?? 10 } : { kind })}
              />
            </div>
            {draft.recurrence.kind === 'custom' && (
              <div class={`field inline-number ${shown('recurrence') || !isValidRecurrence(draft.recurrence) ? 'has-error' : ''}`}>
                <label>{m.everyDays}</label>
                <div class="number-row">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={365}
                    dir="ltr"
                    value={draft.recurrence.everyDays ?? ''}
                    onInput={(e) => {
                      const n = parseInt(e.currentTarget.value, 10);
                      set('recurrence', { kind: 'custom', everyDays: Number.isNaN(n) ? undefined : n });
                    }}
                  />
                  <span>{m.everyDaysUnit}</span>
                </div>
                {!isValidRecurrence(draft.recurrence) && <small class="error">{m.everyDaysInvalid}</small>}
              </div>
            )}
            <DateField
              label={m.firstMeeting}
              value={draft.firstMeetingDate}
              onChange={(v) => set('firstMeetingDate', v)}
              hint={m.firstMeetingHint}
            />
            {draft.firstMeetingDate && isValidRecurrence(draft.recurrence) && (
              <p class="muted small">
                {fmt(m.nextPreview, { date: formatDate(nextMeetingDate(draft.firstMeetingDate, draft.recurrence)) })}
              </p>
            )}
          </section>
        )}

        {step === 'members' && (
          <section class="card">
            <h2>{m.members}</h2>
            {draft.memberIds.length === 0 ? (
              <p class="muted">{m.membersEmpty}</p>
            ) : (
              <>
                <p class="muted small">{m.membersHint}</p>
                <SortableList
                  items={draft.memberIds}
                  getKey={(id) => id}
                  onReorder={(ids) => set('memberIds', ids)}
                  renderItem={(pid, i) => {
                    const p = peopleById.get(pid);
                    return (
                      <div class="member-row">
                        <span class="order">{i + 1}</span>
                        <span class="list-main">
                          <span class="list-title">{p ? displayName(p) : '—'}</span>
                          {p?.position && <span class="list-sub">{p.position}</span>}
                        </span>
                        {p && !p.active && <span class="badge muted-badge">{m.inactiveMember}</span>}
                        <button
                          class="icon-btn sm"
                          aria-label={t().drag.remove}
                          onClick={() => set('memberIds', draft.memberIds.filter((x) => x !== pid))}
                        >
                          <CloseIcon width={18} height={18} />
                        </button>
                      </div>
                    );
                  }}
                />
              </>
            )}
            <div class="btn-row">
              <button class="btn grow" onClick={() => setPicking(true)}>
                <PlusIcon width={18} height={18} /> {m.addMembers}
              </button>
              {unselectedActive.length > 0 && (
                <button class="btn ghost" onClick={() => set('memberIds', [...draft.memberIds, ...unselectedActive.map((p) => p.id)])}>
                  {fmt(m.addAllMembers, { n: unselectedActive.length })}
                </button>
              )}
            </div>
          </section>
        )}

        {step === 'topics' && (
          <section class="card">
            <h2>{m.topics}</h2>
            <p class="muted small">{m.topicsHint}</p>
            {topics.length === 0 ? (
              <p class="muted">{m.topicsEmpty}</p>
            ) : (
              <SortableList
                items={topics}
                getKey={(x) => x.key}
                onReorder={setTopics}
                renderItem={(topic, i) => (
                  <div class="topic-row">
                    <input
                      data-topic={topic.key}
                      enterKeyHint="next"
                      onKeyDown={(e) => {
                        // Enter = محور جديد بعده
                        if (e.key !== 'Enter' || e.isComposing) return;
                        e.preventDefault();
                        const [fresh] = toTopics(['']);
                        setTopics((ts) => {
                          const at = ts.findIndex((x) => x.key === topic.key);
                          return [...ts.slice(0, at + 1), fresh, ...ts.slice(at + 1)];
                        });
                        setFocusTopic(fresh.key);
                      }}
                      value={topic.text}
                      placeholder={fmt(m.topicPlaceholder, { n: i + 1 })}
                      onInput={(e) => {
                        const text = e.currentTarget.value;
                        setTopics((ts) => ts.map((x) => (x.key === topic.key ? { ...x, text } : x)));
                      }}
                    />
                    <button
                      class="icon-btn sm"
                      aria-label={t().drag.remove}
                      onClick={() => setTopics((ts) => ts.filter((x) => x.key !== topic.key))}
                    >
                      <CloseIcon width={18} height={18} />
                    </button>
                  </div>
                )}
              />
            )}
            <button
              class="btn full"
              onClick={() => {
                const [fresh] = toTopics(['']);
                setTopics((ts) => [...ts, fresh]);
                setFocusTopic(fresh.key);
              }}
            >
              <PlusIcon width={18} height={18} /> {m.addTopic}
            </button>
          </section>
        )}

        {step === 'sections' && (
          <>
            <section class="card">
              <h2>{m.sections}</h2>
              <p class="muted small">{m.sectionsHint}</p>
              {(['decisions', 'newTasks', 'register', 'signatures'] as const).map((k) => (
                <Toggle key={k} label={m.sec[k]} checked={draft.sections[k]} onChange={(v) => set('sections', { ...draft.sections, [k]: v })} />
              ))}
              {draft.sections.register && (
                <TextField label={m.registerName} value={draft.registerName} onInput={(v) => set('registerName', v)} placeholder={m.registerPlaceholder} />
              )}
            </section>

            <section class="card">
              <h2>{m.colors}</h2>
              <ColorField label={m.primary} value={draft.colors.primary} onChange={(v) => set('colors', { ...draft.colors, primary: v })} />
              <ColorField label={m.secondary} value={draft.colors.secondary} onChange={(v) => set('colors', { ...draft.colors, secondary: v })} />
              <button class="btn ghost sm" onClick={() => set('colors', { ...DEFAULT_COLORS })}>
                {m.resetColors}
              </button>
            </section>

            <section class="card">
              <h2>{m.colorsPreview}</h2>
              <MinutesPreview
                seriesName={draft.name}
                colors={draft.colors}
                firstDate={draft.firstMeetingDate}
                nextDate={
                  draft.firstMeetingDate && isValidRecurrence(draft.recurrence)
                    ? nextMeetingDate(draft.firstMeetingDate, draft.recurrence)
                    : undefined
                }
                memberNames={draft.memberIds.map((id) => peopleById.get(id)).filter((p) => !!p).map((p) => displayName(p!))}
              />
            </section>
          </>
        )}

        {isEdit && step === 'name' && existing && <DangerZone series={existing} />}
      </div>

      <footer class="wizard-footer">
        {isEdit ? (
          <>
            <button class="btn primary grow" onClick={save} disabled={busy || !dirty}>
              {m.save}
            </button>
            <button class="btn ghost" onClick={cancel}>
              {m.cancel}
            </button>
          </>
        ) : (
          <>
            {idx > 0 && (
              <button class="btn ghost" onClick={() => goTo(STEPS[idx - 1])}>
                {m.back}
              </button>
            )}
            {isLast ? (
              <button class="btn primary grow" onClick={save} disabled={busy}>
                {m.create}
              </button>
            ) : (
              <button class="btn primary grow" onClick={next}>
                {m.next}
              </button>
            )}
          </>
        )}
      </footer>

      {picking && people && (
        <MemberPicker
          people={people}
          selected={draft.memberIds}
          onClose={() => setPicking(false)}
          onDone={(ids) => {
            set('memberIds', ids);
            setPicking(false);
          }}
        />
      )}
    </main>
  );
}

function DangerZone({ series }: { series: Series }) {
  const m = t().series;
  const [deletable, setDeletable] = useState<boolean | null>(null);
  useEffect(() => {
    void canDeleteSeries(series.id).then(setDeletable);
  }, [series.id]);

  const toggleArchive = async () => {
    if (!series.archived && !confirm(fmt(m.confirmArchive, { name: series.name }))) return;
    await setSeriesArchived(series.id, !series.archived);
    navigate('/');
  };

  const remove = async () => {
    if (!confirm(fmt(m.confirmDelete, { name: series.name }))) return;
    await deleteSeries(series.id);
    navigate('/');
  };

  return (
    <section class="card danger-zone">
      <button class="btn ghost full" onClick={toggleArchive}>
        {series.archived ? m.unarchive : m.archive}
      </button>
      {deletable === true && (
        <button class="btn danger-ghost full" onClick={remove}>
          <TrashIcon width={18} height={18} /> {m.delete}
        </button>
      )}
      {deletable === false && <p class="muted small">{m.archiveInstead}</p>}
    </section>
  );
}
