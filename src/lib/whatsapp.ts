// رسالة متابعة لمسؤول على واتساب: بيفتح واتساب والرسالة جاهزة، وإنت تختار الشخص.
import { seriesNextDate } from '../db/repos/meetings';
import { displayName } from '../db/repos/people';
import { db } from '../db/schema';
import type { Person, Task } from '../db/types';
import { ownerMessage, type MessageSeries } from '../domain/followup';
import { isRtl, t } from '../i18n';
import { formatDate, todayISO } from './dates';

/** أسماء السلاسل وتاريخ الاجتماع القادم لكل واحدة (للرسالة). */
export async function messageSeries(tasks: Pick<Task, 'seriesId'>[]): Promise<Record<string, MessageSeries>> {
  const ids = [...new Set(tasks.map((x) => x.seriesId))];
  const out: Record<string, MessageSeries> = {};
  for (const id of ids) {
    const s = await db.series.get(id);
    if (s) out[id] = { name: s.name, nextDate: await seriesNextDate(s) };
  }
  return out;
}

export function buildOwnerMessage(person: Pick<Person, 'name' | 'title'>, tasks: Task[], series: Record<string, MessageSeries>): string {
  return ownerMessage(displayName(person), tasks, series, todayISO(), { ...t().followup.msg, statuses: t().task.statusesShort, formatDate }, isRtl());
}

export function openWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
