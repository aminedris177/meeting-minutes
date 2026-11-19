import type { ComponentChildren } from 'preact';
import { t } from '../i18n';
import { ChevronIcon } from './icons';

interface Props {
  title: string;
  /** رابط زرار الرجوع (hash) */
  back?: string;
  actions?: ComponentChildren;
  children?: ComponentChildren;
}

export function Screen({ title, back, actions, children }: Props) {
  return (
    <main class="screen">
      <header class="screen-header">
        {back && (
          <a class="icon-btn back" href={back} aria-label={t().common.back}>
            <ChevronIcon class="chev-back" />
          </a>
        )}
        <h1>{title}</h1>
        {actions && <div class="header-actions">{actions}</div>}
      </header>
      <div class="screen-body">{children}</div>
    </main>
  );
}

export function EmptyState({ text, hint, children }: { text: string; hint?: string; children?: ComponentChildren }) {
  return (
    <div class="empty">
      <p>{text}</p>
      {hint && <small>{hint}</small>}
      {children}
    </div>
  );
}
