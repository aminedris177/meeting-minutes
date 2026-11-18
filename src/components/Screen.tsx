import type { ComponentChildren } from 'preact';

export function Screen({ title, children }: { title: string; children?: ComponentChildren }) {
  return (
    <main class="screen">
      <header class="screen-header">
        <h1>{title}</h1>
      </header>
      <div class="screen-body">{children}</div>
    </main>
  );
}

export function EmptyState({ text, hint }: { text: string; hint?: string }) {
  return (
    <div class="empty">
      <p>{text}</p>
      {hint && <small>{hint}</small>}
    </div>
  );
}
