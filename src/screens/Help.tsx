// دليل الاستخدام جوه التطبيق — بلغة التطبيق الحالية، بالصور، وفيه بحث. #/help/<id> بيفتح موضوع معيّن.
import { useEffect, useState } from 'preact/hooks';
import { Screen } from '../components/Screen';
import { matchesQuery } from '../domain/search';
import { getLang, t } from '../i18n';
import { startTour } from '../components/Tour';
import { HELP_SHOTS, helpShotUrl } from './helpShots';

export function HelpScreen({ section }: { section?: string }) {
  const m = t().help;
  const [open, setOpen] = useState<string | null>(section ?? null);
  const [q, setQ] = useState('');
  const searching = q.trim().length > 0;

  // لو جاي على موضوع معيّن: افتحه وانزل له
  useEffect(() => {
    if (!section) return;
    setOpen(section);
    requestAnimationFrame(() => document.getElementById(`help-${section}`)?.scrollIntoView({ block: 'start' }));
  }, [section]);

  // في البحث: المواضيع اللي فيها الكلمة، والخطوات المطابقة بس
  const results = m.sections
    .map((s) => {
      if (!searching) return { s, steps: s.steps.map((_, i) => i), tips: s.tips };
      if (matchesQuery(s.title, q)) return { s, steps: s.steps.map((_, i) => i), tips: s.tips };
      const steps = s.steps.map((st, i) => (matchesQuery(st, q) ? i : -1)).filter((i) => i >= 0);
      const tips = s.tips.filter((tip) => matchesQuery(tip, q));
      return steps.length || tips.length ? { s, steps, tips } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return (
    <Screen title={m.title} back="#/">
      <input
        type="search"
        class="help-search"
        value={q}
        placeholder={m.search}
        aria-label={m.search}
        onInput={(e) => setQ((e.currentTarget as HTMLInputElement).value)}
      />
      {!searching && (
        <>
          <p class="muted">{m.intro}</p>
          <button class="btn ghost help-tour-btn" onClick={() => startTour()}>
            {m.tour}
          </button>
          <nav class="help-topics" aria-label={m.title}>
            {m.sections.map((s) => (
              <a key={s.id} class={`chip ${open === s.id ? 'on' : ''}`} href={`#/help/${s.id}`}>
                {s.title}
              </a>
            ))}
          </nav>
        </>
      )}
      {searching && results.length === 0 && <p class="muted">{m.noResults}</p>}
      {results.map(({ s, steps, tips }) => {
        const isOpen = searching || open === s.id;
        return (
          <details
            key={s.id}
            id={`help-${s.id}`}
            class="card help-section"
            open={isOpen}
            onToggle={(e) => {
              if (searching) return;
              const now = (e.currentTarget as HTMLDetailsElement).open;
              if (now) setOpen(s.id);
              else if (open === s.id) setOpen(null);
            }}
          >
            <summary>
              <span>{s.title}</span>
            </summary>
            <ol class="help-steps">
              {steps.map((i) => (
                <li key={i} value={i + 1}>
                  {s.steps[i]}
                  {isOpen && HELP_SHOTS[s.id]?.includes(i) && (
                    <figure class="help-shot">
                      <img src={helpShotUrl(getLang(), s.id, i)} alt="" loading="lazy" decoding="async" />
                    </figure>
                  )}
                </li>
              ))}
            </ol>
            {tips.map((tip) => (
              <p class="help-tip">
                <b>{m.tipsLabel}:</b> {tip}
              </p>
            ))}
          </details>
        );
      })}
    </Screen>
  );
}
