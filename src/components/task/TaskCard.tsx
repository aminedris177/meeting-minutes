// كارت المهمة في المتابعة: الرقم، الوصف، المسؤول، الموعد والتأخير، والحالة (تتغير بلمسة).
import { displayName } from '../../db/repos/people';
import type { TaskRow } from '../../db/repos/tasks';
import { isOpen } from '../../domain/delay';
import { fmt, t } from '../../i18n';
import { diffDays, formatDate, type ISODate } from '../../lib/dates';
import { StatusBadge } from './Status';

interface Props {
  row: TaskRow;
  today: ISODate;
  showSeries: boolean;
  onStatus: () => void;
}

export function TaskCard({ row, today, showSeries, onStatus }: Props) {
  const m = t().task;
  const { task, series, owner, delay } = row;
  const open = isOpen(task);
  const overdue = delay > 0;

  let due = '';
  if (open && task.targetDate) {
    const left = diffDays(today, task.targetDate);
    due = overdue ? fmt(m.delay, { n: delay }) : left === 0 ? m.dueToday : fmt(m.dueIn, { n: left });
  }

  return (
    <a
      class={`card task-card ${overdue ? 'overdue' : ''} ${open ? '' : 'closed'}`}
      href={`#/task/${task.id}`}
      style={series ? { '--series': series.colors.primary } : undefined}
    >
      <div class="task-top">
        <span class="code" dir="ltr">{task.code}</span>
        {showSeries && series && <span class="task-series">{series.name}</span>}
        <StatusBadge status={task.status} onClick={onStatus} short />
      </div>
      <p class="task-desc">{task.description}</p>
      <div class="task-meta">
        <span class={owner ? '' : 'muted'}>{owner ? displayName(owner) : m.unassigned}</span>
        {task.targetDate && (
          <span class="task-due">
            <span dir="ltr">{formatDate(task.targetDate)}</span>
            {due && <b class={overdue ? 'late' : ''}>{due}</b>}
          </span>
        )}
        {!open && task.closedDate && (
          <span class="muted">
            {m.closedDate}: <span dir="ltr">{formatDate(task.closedDate)}</span>
          </span>
        )}
      </div>
    </a>
  );
}
