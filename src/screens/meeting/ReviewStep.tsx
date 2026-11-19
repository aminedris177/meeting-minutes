// خطوة 3: مراجعة المهام المفتوحة — المتأخر الأول، ولكل مهمة: الحالة بلمسة + تحديث + المطلوب للاجتماع القادم.
import { useRef } from 'preact/hooks';
import { AutoField } from '../../components/AutoField';
import { useLive } from '../../db/live';
import { reviewItems, saveMeetingUpdate, type ReviewItem } from '../../db/repos/meetings';
import { displayName } from '../../db/repos/people';
import { latestTextUpdate, listTaskUpdates, setTaskStatus, TASK_STATUSES } from '../../db/repos/tasks';
import type { Meeting } from '../../db/types';
import { fmt, t } from '../../i18n';
import { formatDate } from '../../lib/dates';

export function ReviewStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const items = useLive(() => reviewItems(meeting), [meeting.id, meeting.date]);
  if (!items) return null;
  if (items.length === 0) {
    return (
      <section class="card">
        <p class="muted center">{m.reviewEmpty}</p>
      </section>
    );
  }
  return (
    <>
      <p class="muted small">{fmt(m.reviewCount, { n: items.length })}</p>
      {items.map((r) => (
        <ReviewCard key={r.task.id} item={r} meeting={meeting} />
      ))}
    </>
  );
}

function ReviewCard({ item, meeting }: { item: ReviewItem; meeting: Meeting }) {
  const m = t().meeting;
  const mt = t().task;
  const { task, owner, delay, update } = item;
  // آخر قيمة للحقلين — علشان حفظ واحد ميمسحش التاني لو اتكتبوا ورا بعض بسرعة
  const latest = useRef({ text: update?.text ?? '', next: update?.nextAction ?? '' });
  // آخر تحديث من اجتماع سابق — علشان تفتكر وقفتوا فين
  const previous = useLive(
    async () => latestTextUpdate((await listTaskUpdates(task.id)).filter((u) => u.meetingId !== meeting.id)),
    [task.id, meeting.id],
  );

  return (
    <section class={`card review-card ${delay > 0 ? 'overdue' : ''}`}>
      <div class="task-top">
        <span class="code" dir="ltr">
          {task.code}
        </span>
        {task.topic && <span class="task-series">{task.topic}</span>}
        {delay > 0 && <b class="late-tag">{fmt(mt.delay, { n: delay })}</b>}
      </div>
      <p class="task-desc">{task.description}</p>
      <div class="task-meta">
        <span class={owner ? '' : 'muted'}>{owner ? displayName(owner) : mt.unassigned}</span>
        {task.targetDate && (
          <span class="muted" dir="ltr">
            {formatDate(task.targetDate)}
          </span>
        )}
      </div>

      {previous && (
        <div class="prev-update">
          <small>{fmt(m.lastUpdate, { date: formatDate(previous.date) })}</small>
          {previous.text && <p>{previous.text}</p>}
          {previous.nextAction && (
            <p class="tl-next">
              <b>{mt.nextLabel}:</b> {previous.nextAction}
            </p>
          )}
        </div>
      )}

      <div class="status-row" role="radiogroup" aria-label={mt.status}>
        {TASK_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={task.status === s}
            class={`status s-${s} ${task.status === s ? 'picked' : ''}`}
            onClick={() => task.status !== s && void setTaskStatus(task.id, s, meeting.date, { meetingId: meeting.id })}
          >
            {mt.statusesShort[s]}
          </button>
        ))}
      </div>

      <div class="field">
        <label>{m.update}</label>
        <AutoField
          multiline
          rows={2}
          value={update?.text ?? ''}
          placeholder={m.updatePlaceholder}
          ariaLabel={`${m.update} ${task.code}`}
          onSave={(text) => {
            latest.current.text = text;
            return saveMeetingUpdate(meeting, task.id, text, latest.current.next);
          }}
        />
      </div>
      <div class="field">
        <label>{m.nextAction}</label>
        <AutoField
          multiline
          rows={2}
          value={update?.nextAction ?? ''}
          ariaLabel={`${m.nextAction} ${task.code}`}
          onSave={(next) => {
            latest.current.next = next;
            return saveMeetingUpdate(meeting, task.id, latest.current.text, next);
          }}
        />
      </div>
    </section>
  );
}

