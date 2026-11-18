// اختيار الحضور من دليل الأشخاص (مع إمكانية إضافة شخص جديد).
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { CheckIcon, PlusIcon } from '../../components/icons';
import { displayName } from '../../db/repos/people';
import type { ID, Person } from '../../db/types';
import { fmt, t } from '../../i18n';
import { PersonForm } from '../people/PersonForm';

interface Props {
  people: Person[];
  selected: ID[];
  onDone: (ids: ID[]) => void;
  onClose: () => void;
}

export function MemberPicker({ people, selected, onDone, onClose }: Props) {
  const m = t().series;
  const [picked, setPicked] = useState<Set<ID>>(() => new Set(selected));
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  // الأشخاص اللي اتضافوا من هنا لسه ممكن ميكونوش وصلوا في props
  const [added, setAdded] = useState<Person[]>([]);

  const all = [...people, ...added.filter((a) => !people.some((p) => p.id === a.id))];
  const q = query.trim();
  const visible = all.filter((p) => (p.active || picked.has(p.id)) && (!q || p.name.includes(q) || p.position.includes(q)));

  // اختيار الكل = كل النشطين الظاهرين (بعد البحث)
  const selectable = visible.filter((p) => p.active);
  const allPicked = selectable.length > 0 && selectable.every((p) => picked.has(p.id));
  const toggleAll = () => {
    const next = new Set(picked);
    for (const p of selectable) {
      if (allPicked) next.delete(p.id);
      else next.add(p.id);
    }
    setPicked(next);
  };

  const toggle = (id: ID) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  const done = () => {
    // الترتيب: الحاليين بترتيبهم، وبعدين الجداد بترتيب الاختيار
    const kept = selected.filter((id) => picked.has(id));
    const fresh = [...picked].filter((id) => !selected.includes(id));
    onDone([...kept, ...fresh]);
  };

  if (adding) {
    return (
      <PersonForm
        onClose={() => setAdding(false)}
        onSaved={(p) => {
          setAdded([...added, p]);
          setPicked(new Set([...picked, p.id]));
        }}
      />
    );
  }

  return (
    <Sheet
      title={m.pickTitle}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={done}>
            {fmt(m.pickDone, { n: picked.size })}
          </button>
          <button class="btn ghost" onClick={() => setAdding(true)}>
            <PlusIcon width={18} height={18} /> {m.newPerson}
          </button>
        </>
      }
    >
      {all.length > 6 && (
        <input class="search" type="search" placeholder={t().people.search} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      )}
      {all.length === 0 ? (
        <p class="muted center">{m.pickEmpty}</p>
      ) : (
        <>
        {selectable.length > 1 && (
          <button class={`list-row check-row select-all ${allPicked ? 'on' : ''}`} onClick={toggleAll} aria-pressed={allPicked}>
            <span class="checkbox" aria-hidden="true">{allPicked && <CheckIcon width={16} height={16} />}</span>
            <span class="list-main">
              <span class="list-title">{allPicked ? m.deselectAll : m.selectAll}</span>
            </span>
            <span class="badge">{selectable.length}</span>
          </button>
        )}
        <ul class="list">
          {visible.map((p) => {
            const on = picked.has(p.id);
            return (
              <li key={p.id}>
                <button class={`list-row check-row ${on ? 'on' : ''}`} onClick={() => toggle(p.id)} aria-pressed={on}>
                  <span class="checkbox" aria-hidden="true">{on && <CheckIcon width={16} height={16} />}</span>
                  <span class="list-main">
                    <span class="list-title">{displayName(p)}</span>
                    {p.position && <span class="list-sub">{p.position}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        </>
      )}
    </Sheet>
  );
}
