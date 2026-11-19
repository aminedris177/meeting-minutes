// إضافة المهام المقروءة من Excel لسلسلة: بنفس أرقامها لو موجودة، والمسؤول بيتطابق مع الدليل بالاسم.
import { isOpen } from '../../domain/delay';
import type { ParsedTask } from '../../domain/excelImport';
import { nameKey, splitTitle } from '../../domain/names';
import { formatTaskCode } from '../../domain/numbering';
import type { ISODate } from '../../lib/dates';
import { db, newId, type AppDB } from '../schema';
import type { Person, Task, TaskUpdate } from '../types';

export interface ImportResult {
  added: number;
  skipped: string[]; // أكواد موجودة بالفعل في السلسلة
  newPeople: number;
}

export async function importTasks(
  seriesId: string,
  rows: ParsedTask[],
  today: ISODate,
  opts: { createMissingPeople: boolean },
  d: AppDB = db,
): Promise<ImportResult> {
  return d.transaction('rw', [d.series, d.tasks, d.taskUpdates, d.people], async () => {
    const series = await d.series.get(seriesId);
    if (!series) throw new Error('Series not found');
    const existing = await d.tasks.where('seriesId').equals(seriesId).toArray();
    const usedNumbers = new Set(existing.map((t) => t.number));
    const usedCodes = new Set(existing.map((t) => t.code));
    const people = await d.people.toArray();
    const byKey = new Map(people.map((p) => [nameKey(p.name), p]));

    let counter = series.taskCounter;
    let added = 0;
    let newPeople = 0;
    const skipped: string[] = [];
    const now = Date.now();
    let stamp = now;

    // المهام اللي ليها رقم الأول — علشان الأرقام الجديدة تيجي بعدها
    const ordered = [...rows].sort((a, b) => (a.number ?? Infinity) - (b.number ?? Infinity));
    const maxGiven = Math.max(0, ...ordered.map((r) => r.number ?? 0));
    counter = Math.max(counter, maxGiven);

    for (const r of ordered) {
      let number: number;
      let code: string;
      if (r.number && r.code) {
        if (usedNumbers.has(r.number) || usedCodes.has(r.code)) {
          skipped.push(r.code);
          continue;
        }
        number = r.number;
        code = r.code;
      } else {
        number = ++counter;
        code = formatTaskCode(series.taskPrefix, number);
      }
      usedNumbers.add(number);
      usedCodes.add(code);

      let ownerId: string | null = null;
      if (r.ownerName) {
        const { title, name } = splitTitle(r.ownerName);
        let p: Person | undefined = byKey.get(nameKey(name));
        if (!p && opts.createMissingPeople) {
          p = { id: newId(), name, title, position: '', email: '', active: true, createdAt: now };
          await d.people.add(p);
          byKey.set(nameKey(name), p);
          newPeople++;
        }
        ownerId = p?.id ?? null;
      }

      const task: Task = {
        id: newId(),
        seriesId,
        number,
        code,
        topic: r.topic,
        description: r.description,
        ownerId,
        createdDate: r.createdDate ?? today,
        targetDate: r.targetDate,
        priority: 'medium',
        status: r.status,
        closedDate: isOpen({ status: r.status }) ? undefined : (r.closedDate ?? today),
        createdAt: now,
        updatedAt: now,
      };
      await d.tasks.add(task);
      if (r.update || r.nextAction) {
        const u: TaskUpdate = {
          id: newId(),
          taskId: task.id,
          text: r.update,
          nextAction: r.nextAction,
          date: task.closedDate ?? today,
          createdAt: stamp++,
        };
        await d.taskUpdates.add(u);
      }
      added++;
    }
    await d.series.update(seriesId, { taskCounter: Math.max(counter, ...[...usedNumbers]), updatedAt: Date.now() });
    return { added, skipped, newPeople };
  });
}
