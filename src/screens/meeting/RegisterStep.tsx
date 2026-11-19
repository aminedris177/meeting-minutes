// خطوة 6: السجل التراكمي (مثلاً «المواصفات المعتمدة») — مشترك على مستوى السلسلة، والجديد بيتعلّم على الاجتماع.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { Segmented, TextField } from '../../components/fields';
import { PlusIcon, TrashIcon } from '../../components/icons';
import { useLive } from '../../db/live';
import { addRegisterItem, listRegister, REGISTER_STATUSES, removeRegisterItem, updateRegisterItem } from '../../db/repos/meetings';
import { db } from '../../db/schema';
import type { Meeting, RegisterItem, RegisterStatus } from '../../db/types';
import { t } from '../../i18n';

export function RegisterStep({ meeting }: { meeting: Meeting }) {
  const m = t().meeting;
  const items = useLive(() => listRegister(meeting.seriesId), [meeting.seriesId]);
  const series = useLive(() => db.series.get(meeting.seriesId), [meeting.seriesId]);
  const [editing, setEditing] = useState<RegisterItem | 'new' | null>(null);

  return (
    <section class="card">
      <h2>{series?.registerName || t().minutes.register}</h2>
      {items && items.length === 0 && <p class="muted">{m.registerEmpty}</p>}
      {items && items.length > 0 && (
        <ul class="list">
          {items.map((r, i) => (
            <li key={r.id}>
              <button class={`list-row reg-row ${r.status === 'cancelled' ? 'inactive' : ''}`} onClick={() => setEditing(r)}>
                <span class="order">{i + 1}</span>
                <span class="list-main">
                  <span class="list-title">{r.item || r.text}</span>
                  {r.item && r.text && <span class="list-sub">{r.text}</span>}
                </span>
                <span class="reg-badges">
                  <span class={`badge reg-${r.status}`}>{m.registerStatuses[r.status]}</span>
                  {r.meetingId === meeting.id && <span class="badge new-badge">{m.newInMeeting}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button class="btn full" onClick={() => setEditing('new')}>
        <PlusIcon width={18} height={18} /> {m.addItem}
      </button>
      {editing && <RegisterSheet meeting={meeting} item={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function RegisterSheet({ meeting, item, onClose }: { meeting: Meeting; item?: RegisterItem; onClose: () => void }) {
  const m = t().meeting;
  const [name, setName] = useState(item?.item ?? '');
  const [text, setText] = useState(item?.text ?? '');
  const [status, setStatus] = useState<RegisterStatus>(item?.status ?? 'approved');
  const empty = !name.trim() && !text.trim();

  const save = async () => {
    if (empty) return;
    if (item) await updateRegisterItem(item.id, meeting.id, { item: name.trim(), text: text.trim(), status });
    else await addRegisterItem(meeting.seriesId, meeting.id, { item: name, text, status });
    onClose();
  };
  const remove = async () => {
    if (!item || !confirm(m.confirmRemoveItem)) return;
    await removeRegisterItem(item.id);
    onClose();
  };

  return (
    <Sheet
      title={item ? m.editItem : m.addItem}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={save} disabled={empty}>
            {t().common.save}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      <TextField label={m.item} value={name} onInput={setName} autoFocus={!item} />
      <div class="field">
        <label for="reg-text">{m.itemText}</label>
        <textarea id="reg-text" rows={3} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </div>
      <div class="field">
        <span class="label">{m.itemStatus}</span>
        <Segmented<RegisterStatus> value={status} options={REGISTER_STATUSES.map((s) => ({ value: s, label: m.registerStatuses[s] }))} onChange={setStatus} />
      </div>
      {item && (
        <button class="btn danger-ghost full" onClick={remove}>
          <TrashIcon width={18} height={18} /> {m.removeItem}
        </button>
      )}
    </Sheet>
  );
}
