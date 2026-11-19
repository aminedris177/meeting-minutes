// طباعة المحضر بـ window.print(): بنرسم المحضر في عنصر خاص، والـ CSS بيخفي باقي التطبيق وقت الطباعة.
import { h, render } from 'preact';
import { MinutesView } from '../components/MinutesView';
import type { MinutesModel } from '../db/types';

export async function waitForAssets(root: HTMLElement): Promise<void> {
  await document.fonts?.ready;
  await Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((r) => ((img.onload = () => r()), (img.onerror = () => r()))),
    ),
  );
}

export async function printMinutes(model: MinutesModel, logoUrl?: string): Promise<void> {
  document.getElementById('print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'print-root';
  document.body.appendChild(root);
  render(h(MinutesView, { model, logoUrl }), root);
  await waitForAssets(root);
  const cleanup = () => {
    window.removeEventListener('afterprint', cleanup);
    render(null, root);
    root.remove();
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
}
