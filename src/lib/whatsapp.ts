// رسالة متابعة لمسؤول على واتساب: بيفتح واتساب والرسالة جاهزة، وإنت تختار الشخص.
import { displayName } from '../db/repos/people';
import type { Person, Task } from '../db/types';
import { ownerMessage } from '../domain/followup';
import { t } from '../i18n';
import { formatDate, todayISO } from './dates';

export function buildOwnerMessage(person: Pick<Person, 'name' | 'title'>, tasks: Task[]): string {
  const m = t().followup.msg;
  return ownerMessage(displayName(person), tasks, todayISO(), {
    ...m,
    statuses: t().task.statusesShort,
    formatDate,
  });
}

export function openWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
}
