// خطوة 5: المهام الجديدة اللي اتفتحت في الاجتماع ده (بترقيم السلسلة).
import { useState } from 'preact/hooks';
import { PlusIcon } from '../../components/icons';
import { TaskForm } from '../../components/task/TaskForm';
import { useLive } from '../../db/live';
import { displayName, listPeople } from '../../db/repos/people';
import { db } from '../../db/schema';
import type { Meeting, Task } from '../../db/types';
import { t } from '../../i18n';
import { formatDate } from '../../lib/dates';

export function NewTasksStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const mt = t().task;
  const tasks = useLive(async () => (await db.tasks.where('meetingId').equals(meeting.id).toArray()).sort((a, b) => a.number - b.number), [meeting.id]);
  const series = useLive(() => db.series.get(meeting.seriesId), [meeting.seriesId]);
  const people = useLive(() => listPeople(), []);
  const [editing, setEditing] = useState<Task | 'new' | null>(null);
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));

  return (
    <section class="card">
      <h2>{t().minutes.newTasks}</h2>
      {tasks && tasks.length === 0 && <p class="muted">{m.newTasksEmpty}</p>}
      {tasks && tasks.length > 0 && (
        <ul class="list">
          {tasks.map((tk) => {
            const owner = tk.ownerId ? pMap.get(tk.ownerId) : undefined;
            return (
              <li key={tk.id}>
                <button class="list-row new-task-row" onClick={() => setEditing(tk)}>
                  <span class="code" dir="ltr">
                    {tk.code}
                  </span>
                  <span class="list-main">
                    <span class="list-title">{tk.description}</span>
                    <span class="list-sub">
                      {owner ? displayName(owner) : mt.unassigned}
                      {tk.targetDate && (
                        <>
                          {' · '}
                          <span dir="ltr">{formatDate(tk.targetDate)}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button class="btn full" onClick={() => setEditing('new')}>
        <PlusIcon width={18} height={18} /> {m.addTask}
      </button>

      {editing && series && people && (
        <TaskForm
          task={editing === 'new' ? undefined : editing}
          seriesList={[series]}
          people={people}
          defaultSeriesId={series.id}
          meetingId={meeting.id}
          defaultCreatedDate={meeting.date}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
