// نموذج إضافة/تعديل مهمة (Sheet).
import { useMemo, useState } from 'preact/hooks';
import { Sheet } from '../Sheet';
import { DateField, Segmented } from '../fields';
import { displayName } from '../../db/repos/people';
import { createTask, TASK_PRIORITIES, updateTask } from '../../db/repos/tasks';
import type { ID, Person, Series, Task, TaskPriority } from '../../db/types';
import { fmt, t } from '../../i18n';
import { todayISO, type ISODate } from '../../lib/dates';

interface Props {
  /** موجودة = تعديل */
  task?: Task;
  seriesList: Series[];
  people: Person[];
  defaultSeriesId?: ID;
  meetingId?: ID;
  /** تاريخ الإدراج الافتراضي (في الاجتماع = تاريخ الاجتماع) */
  defaultCreatedDate?: ISODate;
  onClose: () => void;
  onSaved?: (t: Task) => void;
}

interface FormState {
  seriesId: ID;
  description: string;
  topic: string;
  ownerId: ID | null;
  createdDate: ISODate;
  targetDate?: ISODate;
  priority: TaskPriority;
}

export function TaskForm({ task, seriesList, people, defaultSeriesId, meetingId, defaultCreatedDate, onClose, onSaved }: Props) {
  const m = t().task;
  const active = seriesList.filter((s) => !s.archived || s.id === task?.seriesId);
  const [f, setF] = useState<FormState>(() => ({
    seriesId: task?.seriesId ?? defaultSeriesId ?? active[0]?.id ?? '',
    description: task?.description ?? '',
    topic: task?.topic ?? '',
    ownerId: task?.ownerId ?? null,
    createdDate: task?.createdDate ?? defaultCreatedDate ?? todayISO(),
    targetDate: task?.targetDate,
    priority: task?.priority ?? 'medium',
  }));
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const series = seriesList.find((s) => s.id === f.seriesId);
  // المسؤول: حضور السلسلة الأول (بترتيبهم)، وبعدين باقي الدليل
  const { members, others } = useMemo(() => {
    const ids = series?.memberIds ?? [];
    const byId = new Map(people.map((p) => [p.id, p]));
    const members = ids.map((id) => byId.get(id)).filter((p): p is Person => !!p && (p.active || p.id === f.ownerId));
    const others = people.filter((p) => !ids.includes(p.id) && (p.active || p.id === f.ownerId));
    return { members, others };
  }, [series, people, f.ownerId]);

  const topicChoices = [...new Set((series?.defaultTopics ?? []).map((tp) => tp.trim()).filter(Boolean))];

  const descError = tried && !f.description.trim();

  const save = async () => {
    setTried(true);
    if (!f.description.trim() || !f.seriesId || busy) return;
    setBusy(true);
    try {
      if (task) {
        const { seriesId: _ignored, ...patch } = f;
        await updateTask(task.id, patch);
        onSaved?.({ ...task, ...patch });
      } else {
        const created = await createTask({ ...f, meetingId });
        onSaved?.(created);
      }
      onClose();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={task ? `${m.edit} ${task.code}` : m.new}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={save} disabled={busy}>
            {t().common.save}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      {!task && active.length > 1 && (
        <div class="field">
          <label for="task-series">{m.series}</label>
          <select id="task-series" value={f.seriesId} onChange={(e) => set('seriesId', e.currentTarget.value)}>
            {active.map((s) => (
              <option value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div class={`field ${descError ? 'has-error' : ''}`}>
        <label for="task-desc">{m.description}</label>
        <textarea id="task-desc" rows={3} value={f.description} onInput={(e) => set('description', e.currentTarget.value)} autoFocus={!task} />
        {descError && <small class="error">{m.descriptionRequired}</small>}
      </div>

      <div class="field">
        <label for="task-topic">{m.topic}</label>
        <input
          id="task-topic"
          value={f.topic}
          placeholder={m.topicPlaceholder}
          autoComplete="off"
          onInput={(e) => set('topic', e.currentTarget.value)}
        />
        {/* محاور السلسلة كأزرار (datalist مش شغال كويس على الموبايل) — لمسة تانية على نفس المحور تشيله */}
        {topicChoices.length > 0 && (
          <div class="topic-chips">
            {topicChoices.map((tp) => {
              const on = f.topic.trim() === tp;
              return (
                <button type="button" class={`chip ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => set('topic', on ? '' : tp)}>
                  {tp}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div class="field">
        <label for="task-owner">{m.owner}</label>
        <select id="task-owner" value={f.ownerId ?? ''} onChange={(e) => set('ownerId', e.currentTarget.value || null)}>
          <option value="">{m.unassigned}</option>
          {members.length > 0 && (
            <optgroup label={m.members}>
              {members.map((p) => (
                <option value={p.id}>{displayName(p)}</option>
              ))}
            </optgroup>
          )}
          {others.length > 0 && (
            <optgroup label={m.others}>
              {others.map((p) => (
                <option value={p.id}>{displayName(p)}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      <div class="field-pair">
        <DateField label={m.createdDate} value={f.createdDate} onChange={(v) => set('createdDate', v ?? todayISO())} clearable={false} />
        <DateField label={m.targetDate} value={f.targetDate} onChange={(v) => set('targetDate', v)} />
      </div>

      <div class="field">
        <span class="label">{m.priority}</span>
        <Segmented<TaskPriority>
          value={f.priority}
          options={TASK_PRIORITIES.map((p) => ({ value: p, label: m.priorities[p] }))}
          onChange={(v) => set('priority', v)}
        />
      </div>
    </Sheet>
  );
}
