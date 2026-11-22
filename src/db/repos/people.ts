import { nameKey, normalizeTitle } from '../../domain/names';
import { db, newId, type AppDB } from '../schema';
import type { ID, Person } from '../types';
import { t } from '../../i18n';

export type PersonInput = Pick<Person, 'name' | 'title' | 'position' | 'email'>;

const clean = (p: PersonInput): PersonInput => ({
  name: p.name.replace(/\s+/g, ' ').trim(),
  title: normalizeTitle(p.title),
  position: p.position.trim(),
  email: p.email.trim(),
});

export async function listPeople(d: AppDB = db): Promise<Person[]> {
  const all = await d.people.toArray();
  return all.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
}

export async function addPerson(input: PersonInput, d: AppDB = db): Promise<Person> {
  const p: Person = { id: newId(), ...clean(input), active: true, createdAt: Date.now() };
  if (!p.name) throw new Error('Person name is required');
  await d.people.add(p);
  return p;
}

/**
 * إضافة مجموعة أشخاص مرة واحدة (من قائمة ملصوقة).
 * الأسماء الموجودة بالفعل في الدليل (أو المكررة في نفس القائمة) بتتخطّى.
 */
export async function addPeopleBulk(
  inputs: PersonInput[],
  d: AppDB = db,
): Promise<{ added: Person[]; skipped: string[] }> {
  return d.transaction('rw', d.people, async () => {
    const seen = new Set((await d.people.toArray()).map((p) => nameKey(p.name)));
    const added: Person[] = [];
    const skipped: string[] = [];
    const now = Date.now();
    for (const input of inputs) {
      const c = clean(input);
      if (!c.name) continue;
      const key = nameKey(c.name);
      if (seen.has(key)) {
        skipped.push(c.name);
        continue;
      }
      seen.add(key);
      added.push({ id: newId(), ...c, active: true, createdAt: now + added.length });
    }
    await d.people.bulkAdd(added);
    return { added, skipped };
  });
}

/** أسماء الدليل كمفاتيح مقارنة — لتعليم المكرر في المعاينة قبل الإضافة. */
export async function existingNameKeys(d: AppDB = db): Promise<Set<string>> {
  return new Set((await d.people.toArray()).map((p) => nameKey(p.name)));
}

export async function updatePerson(id: ID, input: PersonInput & { active: boolean }, d: AppDB = db): Promise<void> {
  const c = clean(input);
  if (!c.name) throw new Error('Person name is required');
  await d.people.update(id, { ...c, active: input.active });
}

/** هل الشخص مستخدم في أي سلسلة أو مهمة أو حضور؟ */
export async function isPersonInUse(id: ID, d: AppDB = db): Promise<boolean> {
  const [inSeries, tasks, att] = await Promise.all([
    d.series.filter((s) => s.memberIds.includes(id)).count(),
    d.tasks.where('ownerId').equals(id).count(),
    d.attendance.where('personId').equals(id).count(),
  ]);
  return inSeries + tasks + att > 0;
}

/**
 * الحذف الآمن: لو الشخص مستخدم في أي مكان → يتوقّف (غير نشط) بدل الحذف،
 * علشان المحاضر القديمة تفضل سليمة.
 */
export async function removePerson(id: ID, d: AppDB = db): Promise<'deleted' | 'deactivated'> {
  return d.transaction('rw', [d.people, d.series, d.tasks, d.attendance], async () => {
    if (await isPersonInUse(id, d)) {
      await d.people.update(id, { active: false });
      return 'deactivated' as const;
    }
    await d.people.delete(id);
    return 'deleted' as const;
  });
}

/** عرض اللقب حسب اللغة (م/ ← Eng.)؛ لقب غير معروف بيتعرض زي ما هو. */
export function titleLabel(title: string): string {
  return t().titles[title] ?? title;
}

/** اسم اللقب في الاختيار (أستاذ / أستاذة / م/ / د/). */
export function titleName(title: string): string {
  return t().titleNames[title] ?? titleLabel(title);
}

export function displayName(p: Pick<Person, 'name' | 'title'>): string {
  return p.title ? `${titleLabel(p.title)} ${p.name}` : p.name;
}
