// دليل الاستخدام جوه التطبيق — بلغة التطبيق الحالية. #/help/<id> بيفتح موضوع معيّن.
import { useEffect, useState } from 'preact/hooks';
import { Screen } from '../components/Screen';
import { t } from '../i18n';

export function HelpScreen({ section }: { section?: string }) {
  const m = t().help;
  const [open, setOpen] = useState<string | null>(section ?? null);

  // لو جاي على موضوع معيّن: افتحه وانزل له
  useEffect(() => {
    if (!section) return;
    setOpen(section);
    requestAnimationFrame(() => document.getElementById(`help-${section}`)?.scrollIntoView({ block: 'start' }));
  }, [section]);

  return (
    <Screen title={m.title} back="#/">
      <p class="muted">{m.intro}</p>
      <nav class="help-topics" aria-label={m.title}>
        {m.sections.map((s) => (
          <a key={s.id} class={`chip ${open === s.id ? 'on' : ''}`} href={`#/help/${s.id}`}>
            {s.title}
          </a>
        ))}
      </nav>
      {m.sections.map((s) => (
        <details
          key={s.id}
          id={`help-${s.id}`}
          class="card help-section"
          open={open === s.id}
          onToggle={(e) => {
            const isOpen = (e.currentTarget as HTMLDetailsElement).open;
            if (isOpen) setOpen(s.id);
            else if (open === s.id) setOpen(null);
          }}
        >
          <summary>
            <span>{s.title}</span>
          </summary>
          <ol class="help-steps">
            {s.steps.map((step) => (
              <li>{step}</li>
            ))}
          </ol>
          {s.tips.map((tip) => (
            <p class="help-tip">
              <b>{m.tipsLabel}:</b> {tip}
            </p>
          ))}
        </details>
      ))}
    </Screen>
  );
}
