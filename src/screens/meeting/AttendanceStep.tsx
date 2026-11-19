// خطوة 2: الحضور — لمسة على الاسم = حضر/غائب، وإضافة ضيف لاجتماع واحد.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { TextField } from '../../components/fields';
import { CheckIcon, CloseIcon, PlusIcon } from '../../components/icons';
import { useLive } from '../../db/live';
import { addGuest, addPersonToMeeting, listAttendance, removeAttendance, setAllPresent, setPresent } from '../../db/repos/meetings';
import { displayName, listPeople } from '../../db/repos/people';
import type { Meeting } from '../../db/types';
import { fmt, t } from '../../i18n';
import { MemberPicker } from '../series/MemberPicker';

export function AttendanceStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const rows = useLive(() => listAttendance(meeting.id), [meeting.id]);
  const people = useLive(() => listPeople(), []);
  const [guestOpen, setGuestOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const pMap = new Map((people ?? []).map((p) => [p.id, p]));
  const presentN = rows?.filter((r) => r.present).length ?? 0;

  return (
    <section class="card">
      <div class="card-title-row">
        <h2>{t().minutes.attendance}</h2>
        {rows && <span class="badge">{fmt(m.presentCount, { p: presentN, n: rows.length })}</span>}
      </div>
      {rows && rows.length === 0 && <p class="muted">{m.noAttendees}</p>}
      {rows && rows.length > 0 && (
        <>
          <p class="muted small">{m.tapHint}</p>
          <div class="btn-row tight">
            <button class="btn ghost sm" onClick={() => void setAllPresent(meeting.id, true)}>
              {m.allPresent}
            </button>
            <button class="btn ghost sm" onClick={() => void setAllPresent(meeting.id, false)}>
              {m.allAbsent}
            </button>
          </div>
          <ul class="list att-list">
            {rows.map((r) => {
              const p = r.personId ? pMap.get(r.personId) : undefined;
              const name = p ? displayName(p) : `${r.guestTitle ? r.guestTitle + ' ' : ''}${r.guestName ?? ''}`;
              return (
                <li key={r.id} class="att-li">
                  <button class={`list-row check-row att-row ${r.present ? 'on' : 'off'}`} aria-pressed={r.present} onClick={() => void setPresent(r.id, !r.present)}>
                    <span class="checkbox" aria-hidden="true">{r.present && <CheckIcon width={16} height={16} />}</span>
                    <span class="list-main">
                      <span class="list-title">{name}</span>
                      {(p?.position || !r.personId) && <span class="list-sub">{p?.position || m.guest}</span>}
                    </span>
                    <span class={`att-state ${r.present ? 'yes' : 'no'}`}>{r.present ? m.present : m.absent}</span>
                  </button>
                  {!r.personId && (
                    <button class="icon-btn sm" aria-label={m.removeGuest} onClick={() => void removeAttendance(r.id)}>
                      <CloseIcon width={18} height={18} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div class="btn-row">
        <button class="btn grow" onClick={() => setGuestOpen(true)}>
          <PlusIcon width={18} height={18} /> {m.addGuest}
        </button>
        <button class="btn ghost" onClick={() => setPicking(true)}>
          {m.addFromDirectory}
        </button>
      </div>

      {guestOpen && <GuestSheet meetingId={meeting.id} onClose={() => setGuestOpen(false)} />}
      {picking && people && rows && (
        <MemberPicker
          people={people}
          selected={rows.filter((r) => r.personId).map((r) => r.personId!)}
          onClose={() => setPicking(false)}
          onDone={async (ids) => {
            for (const id of ids) await addPersonToMeeting(meeting.id, id);
            setPicking(false);
          }}
        />
      )}
    </section>
  );
}

function GuestSheet({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const m = t().meeting;
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [tried, setTried] = useState(false);
  const save = async () => {
    setTried(true);
    if (!name.trim()) return;
    await addGuest(meetingId, name, title);
    onClose();
  };
  return (
    <Sheet
      title={m.addGuest}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={save}>
            {t().common.save}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      <TextField label={m.guestName} value={name} onInput={setName} autoFocus error={tried && !name.trim() && t().people.nameRequired} />
      <TextField label={m.guestTitle} value={title} onInput={setTitle} />
    </Sheet>
  );
}
