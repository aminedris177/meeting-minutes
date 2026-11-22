// صفحة المهمة: البيانات، الحالة بلمسة، وسجل التحديثات كله مع إضافة تحديث.
import { useState } from 'preact/hooks';
import { Hint } from '../components/Hint';
import { DateField } from '../components/fields';
import { Screen } from '../components/Screen';
import { StatusBadge, StatusPicker } from '../components/task/Status';
import { TaskForm } from '../components/task/TaskForm';
import { TrashIcon } from '../components/icons';
import { useLive } from '../db/live';
import { displayName, listPeople } from '../db/repos/people';
import { addTaskUpdate, deleteTask, listTaskUpdates, setTaskStatus, latestTextUpdate } from '../db/repos/tasks';
import { db } from '../db/schema';
import type { Task, TaskUpdate } from '../db/types';
import { delayDays, isOpen } from '../domain/delay';
import { fmt, t } from '../i18n';
import { diffDays, formatDate, todayISO } from '../lib/dates';
import { navigate } from '../lib/router';

/** عدد التحديثات اللي بتظهر في السجل قبل «عرض الكل». */
const RECENT_UPDATES = 5;

export function TaskPage({ id }: { id: string }) {
  const m = t().task;
  const task = useLive(async () => (await db.tasks.get(id)) ?? null, [id]);
  if (task === undefined) return <main class="screen" />;
  if (task === null) {
    return (
      <Screen title={m.notFound} back="#/followup">
        <a class="btn" href="#/followup">{t().common.back}</a>
      </Screen>
    );
  }
  return <TaskBody task={task} />;
}

function TaskBody({ task }: { task: Task }) {
  const m = t().task;
  const today = todayISO();
  const series = useLive(() => db.series.get(task.seriesId), [task.seriesId]);
  const seriesList = useLive(() => db.series.toArray(), []);
  const people = useLive(() => listPeople(), []);
  const updates = useLive(() => listTaskUpdates(task.id), [task.id]);
  // ده اللي بيظهر في ملف المتابعة
  const latestId = updates ? latestTextUpdate(updates)?.id : undefined;
  const [showAll, setShowAll] = useState(false);
  const meeting = useLive(async () => (task.meetingId ? db.meetings.get(task.meetingId) : undefined), [task.meetingId]);
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);

  const owner = people?.find((p) => p.id === task.ownerId);
  const open = isOpen(task);
  const delay = delayDays(task, today);
  const left = open && task.targetDate ? diffDays(today, task.targetDate) : null;

  const remove = async () => {
    if (!confirm(fmt(m.confirmDelete, { code: task.code }))) return;
    await deleteTask(task.id);
    navigate('/followup');
  };

  return (
    <Screen title={task.code} back="#/followup">
      <section class={`card task-head ${delay > 0 ? 'overdue' : ''}`} style={series ? { '--series': series.colors.primary } : undefined}>
        <div class="task-top">
          {series && <span class="task-series">{series.name}</span>}
          <StatusBadge status={task.status} onClick={() => setPicking(true)} />
        </div>
        <p class="task-desc full">{task.description}</p>
        {delay > 0 && <p class="late-banner">{fmt(m.delay, { n: delay })}</p>}

        <dl class="details">
          <dt>{m.owner}</dt>
          <dd class={owner ? '' : 'muted'}>{owner ? displayName(owner) : m.unassigned}</dd>
          {task.topic && (
            <>
              <dt>{m.topic}</dt>
              <dd>{task.topic}</dd>
            </>
          )}
          <dt>{m.targetDate}</dt>
          <dd>
            {task.targetDate ? <span dir="ltr">{formatDate(task.targetDate)}</span> : <span class="muted">{m.noTarget}</span>}
            {left !== null && left >= 0 && <small class="muted"> · {left === 0 ? m.dueToday : fmt(m.dueIn, { n: left })}</small>}
          </dd>
          <dt>{m.createdDate}</dt>
          <dd dir="ltr" class="ltr-cell">{formatDate(task.createdDate)}</dd>
          <dt>{m.priority}</dt>
          <dd>
            <span class={`prio p-${task.priority}`}>{m.priorities[task.priority]}</span>
          </dd>
          {!open && task.closedDate && (
            <>
              <dt>{m.closedDate}</dt>
              <dd dir="ltr" class="ltr-cell">{formatDate(task.closedDate)}</dd>
            </>
          )}
          {meeting && (
            <>
              <dt>{m.openedIn}</dt>
              <dd>
                {fmt(m.meetingN, { n: meeting.number })} · <span dir="ltr">{formatDate(meeting.date)}</span>
              </dd>
            </>
          )}
        </dl>
        <button class="btn ghost sm" onClick={() => setEditing(true)}>
          {m.edit}
        </button>
      </section>

      <UpdateComposer taskId={task.id} />

      <section class="card">
        <h2>{m.history}</h2>
        {updates && updates.length === 0 && <p class="muted">{m.historyEmpty}</p>}
        <ol class="timeline">
          {(showAll ? updates : updates?.filter((u, i) => i < RECENT_UPDATES || u.id === latestId))?.map((u) => (
            <UpdateItem key={u.id} u={u} latest={u.id === latestId} />
          ))}
        </ol>
        {updates && updates.length > RECENT_UPDATES && (
          <button class="btn ghost sm" onClick={() => setShowAll(!showAll)}>
            {showAll ? fmt(m.showFewerUpdates, { n: RECENT_UPDATES }) : fmt(m.showAllUpdates, { n: updates.length })}
          </button>
        )}
      </section>

      <button class="btn danger-ghost" onClick={remove}>
        <TrashIcon width={18} height={18} /> {m.delete}
      </button>

      {picking && (
        <StatusPicker current={task.status} onPick={(s) => void setTaskStatus(task.id, s, today)} onClose={() => setPicking(false)} />
      )}
      {editing && seriesList && people && (
        <TaskForm task={task} seriesList={seriesList} people={people} onClose={() => setEditing(false)} />
      )}
    </Screen>
  );
}

function UpdateItem({ u, latest }: { u: TaskUpdate; latest: boolean }) {
  const m = t().task;
  return (
    <li class={`${u.status ? 'status-change' : ''} ${latest ? 'is-latest' : ''}`}>
      <span class="tl-date" dir="ltr">{formatDate(u.date)}</span>
      {latest && <span class="latest-badge">{m.latestBadge}</span>}
      {u.status && (
        <p class="tl-status">
          {u.prevStatus
            ? fmt(m.statusChanged, { from: m.statuses[u.prevStatus], to: m.statuses[u.status] })
            : fmt(m.statusSet, { to: m.statuses[u.status] })}
        </p>
      )}
      {u.text && <p class="tl-text">{u.text}</p>}
      {u.nextAction && (
        <p class="tl-next">
          <b>{m.nextLabel}:</b> {u.nextAction}
        </p>
      )}
    </li>
  );
}

function UpdateComposer({ taskId }: { taskId: string }) {
  const m = t().task;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [next, setNext] = useState('');
  const [date, setDate] = useState(todayISO());
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button class="btn full-width" onClick={() => setOpen(true)}>
        {m.addUpdate}
      </button>
    );
  }

  const empty = !text.trim() && !next.trim();
  const save = async () => {
    setTried(true);
    if (empty || busy) return;
    setBusy(true);
    try {
      await addTaskUpdate(taskId, { text, nextAction: next, date });
      setText('');
      setNext('');
      setTried(false);
      setOpen(false);
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section class="card composer">
      <h2>{m.addUpdate}</h2>
      <Hint id="export-latest" text={m.hintExport} />
      <div class={`field ${tried && empty ? 'has-error' : ''}`}>
        <label for="upd-text">{m.updateText}</label>
        <textarea id="upd-text" rows={3} value={text} placeholder={m.updatePlaceholder} onInput={(e) => setText(e.currentTarget.value)} autoFocus />
      </div>
      <div class="field">
        <label for="upd-next">{m.nextAction}</label>
        <textarea id="upd-next" rows={2} value={next} onInput={(e) => setNext(e.currentTarget.value)} />
        {tried && empty && <small class="error">{m.updateRequired}</small>}
      </div>
      <DateField label={m.updateDate} value={date} onChange={(v) => setDate(v ?? todayISO())} clearable={false} />
      <div class="actions">
        <button class="btn primary grow" onClick={save} disabled={busy}>
          {t().common.save}
        </button>
        <button class="btn ghost" onClick={() => setOpen(false)}>
          {t().common.cancel}
        </button>
      </div>
    </section>
  );
}
