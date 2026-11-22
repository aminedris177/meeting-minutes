// قوالب المهام المتكررة: بتتحفظ في الإعدادات (فبتدخل في النسخة الاحتياطية).
import type { ID, TaskPriority } from '../types';
import { newId, type AppDB, db } from '../schema';
import { getSetting, setSetting } from './settings';

export interface TaskTemplate {
  id: ID;
  description: string;
  topic: string;
  ownerId: ID | null;
  priority: TaskPriority;
}

const KEY = 'taskTemplates';

export async function listTemplates(d: AppDB = db): Promise<TaskTemplate[]> {
  return (await getSetting<TaskTemplate[]>(KEY, d)) ?? [];
}

export async function saveTemplate(input: Omit<TaskTemplate, 'id'>, d: AppDB = db): Promise<TaskTemplate> {
  const list = await listTemplates(d);
  const desc = input.description.trim();
  // نفس الوصف = تحديث القالب الموجود بدل التكرار
  const existing = list.find((x) => x.description.trim() === desc);
  const tpl: TaskTemplate = { ...input, description: desc, id: existing?.id ?? newId() };
  await setSetting(KEY, existing ? list.map((x) => (x.id === existing.id ? tpl : x)) : [...list, tpl], d);
  return tpl;
}

export async function removeTemplate(id: ID, d: AppDB = db): Promise<void> {
  await setSetting(KEY, (await listTemplates(d)).filter((x) => x.id !== id), d);
}
