// شارة الحالة واختيار الحالة بلمسة.
import { Sheet } from '../Sheet';
import { CheckIcon } from '../icons';
import { TASK_STATUSES } from '../../db/repos/tasks';
import type { TaskStatus } from '../../db/types';
import { t } from '../../i18n';

export function StatusBadge({ status, onClick, short }: { status: TaskStatus; onClick?: () => void; short?: boolean }) {
  const m = t().task;
  const label = short ? m.statusesShort[status] : m.statuses[status];
  if (!onClick) return <span class={`status s-${status}`}>{label}</span>;
  return (
    <button
      type="button"
      class={`status s-${status} tappable`}
      aria-label={`${m.changeStatus}: ${m.statuses[status]}`}
      onClick={(e) => {
        // الكارت نفسه لينك — منع فتحه
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
    >
      {label}
      <span class="caret" aria-hidden="true">▾</span>
    </button>
  );
}

interface PickerProps {
  current: TaskStatus;
  title?: string;
  onPick: (s: TaskStatus) => void;
  onClose: () => void;
}

/** اختيار الحالة: لمسة واحدة على الحالة الجديدة = تتغير وتتقفل. */
export function StatusPicker({ current, title, onPick, onClose }: PickerProps) {
  const m = t().task;
  return (
    <Sheet title={title ?? m.changeStatus} onClose={onClose}>
      <div class="status-options">
        {TASK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            class={`status-option s-${s} ${s === current ? 'current' : ''}`}
            aria-pressed={s === current}
            onClick={() => {
              if (s !== current) onPick(s);
              onClose();
            }}
          >
            <span class="dot" aria-hidden="true" />
            <span class="grow">{m.statuses[s]}</span>
            {s === current && <CheckIcon width={20} height={20} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
