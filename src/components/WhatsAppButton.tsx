// زرار «ابعت مهامه على واتساب» لمسؤول (كل مهامه المفتوحة، أو في سلسلة واحدة بس).
import { useLive } from '../db/live';
import { db } from '../db/schema';
import { isOpen } from '../domain/delay';
import { t } from '../i18n';
import { buildOwnerMessage, messageSeries, openWhatsApp } from '../lib/whatsapp';

export function WhatsAppButton({ ownerId, seriesId, small }: { ownerId: string; seriesId?: string; small?: boolean }) {
  const m = t().followup;
  const data = useLive(async () => {
    const person = await db.people.get(ownerId);
    const tasks = (await db.tasks.where('ownerId').equals(ownerId).toArray()).filter((x) => (!seriesId || seriesId === 'all' || x.seriesId === seriesId) && isOpen(x));
    return { person, tasks, series: await messageSeries(tasks) };
  }, [ownerId, seriesId]);
  if (!data?.person) return null;
  const send = () => {
    if (!data.tasks.length) return alert(m.whatsappNone);
    openWhatsApp(buildOwnerMessage(data.person!, data.tasks, data.series));
  };
  return (
    <button class={`btn wa-btn ${small ? 'sm' : ''}`} onClick={send} disabled={!data.tasks.length}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">
        <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.2-.4.7-1.4a.5.5 0 000-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.9 11.9 0 004.5 4c1.7.7 2.4.8 3.2.6a2.8 2.8 0 001.8-1.3 2.3 2.3 0 00.2-1.3c-.1-.1-.3-.2-.5-.3z" />
      </svg>
      {m.whatsapp}
    </button>
  );
}
