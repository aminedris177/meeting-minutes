// إلغاء مسودة اجتماع، أو حذف آخر اجتماع معتمد: بيوضح اللي هيتمسح واللي هيفضل، ويسأل عن المهام الجديدة.
import { useState } from 'preact/hooks';
import { Segmented } from '../../components/fields';
import { Sheet } from '../../components/Sheet';
import { saveSafetySnapshot } from '../../db/backup';
import { useLive } from '../../db/live';
import { deleteMeeting, meetingNewTasks } from '../../db/repos/meetings';
import type { Meeting } from '../../db/types';
import { fmt, t } from '../../i18n';

export function DeleteMeetingSheet({ meeting, onClose, onDeleted }: { meeting: Meeting; onClose: () => void; onDeleted: () => void }) {
  const m = t().meeting;
  const d = m.del;
  const final = meeting.status === 'final';
  const newTasks = useLive(() => meetingNewTasks(meeting.id), [meeting.id]);
  const [tasksChoice, setTasksChoice] = useState<'delete' | 'keep'>('delete');
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !final || typed.trim() === String(meeting.number);

  const run = async () => {
    if (!ok || busy) return;
    setBusy(true);
    try {
      if (final) await saveSafetySnapshot('before-delete-meeting', __APP_VERSION__);
      await deleteMeeting(meeting.id, { deleteNewTasks: tasksChoice === 'delete' });
      onDeleted();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={fmt(final ? d.titleFinal : d.titleDraft, { n: meeting.number })}
      onClose={onClose}
      footer={
        <>
          <button class="btn danger grow" onClick={() => void run()} disabled={!ok || busy}>
            {final ? d.confirmFinal : d.confirmDraft}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      {final && <p class="warn">{d.finalWarn}</p>}
      <p>{d.removes}</p>
      <p>{d.keeps}</p>
      <p class="muted small">{d.number}</p>
      {newTasks && newTasks.length > 0 && (
        <div class="field">
          <span class="label">{fmt(d.newTasks, { n: newTasks.length })}</span>
          <ul class="del-tasks">
            {newTasks.map((x) => (
              <li key={x.id}>
                <b dir="ltr">{x.code}</b> {x.description}
              </li>
            ))}
          </ul>
          <Segmented<'delete' | 'keep'>
            value={tasksChoice}
            options={[
              { value: 'delete', label: d.deleteTasks },
              { value: 'keep', label: d.keepTasks },
            ]}
            onChange={setTasksChoice}
          />
        </div>
      )}
      {final && (
        <>
          <p class="muted small">{d.safety}</p>
          <div class="field">
            <label for="del-num">{fmt(d.typeNumber, { n: meeting.number })}</label>
            <input id="del-num" inputMode="numeric" dir="ltr" value={typed} onInput={(e) => setTyped(e.currentTarget.value)} />
          </div>
        </>
      )}
    </Sheet>
  );
}
