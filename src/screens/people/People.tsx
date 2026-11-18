import { useState } from 'preact/hooks';
import { EmptyState, Screen } from '../../components/Screen';
import { Toggle } from '../../components/fields';
import { PlusIcon } from '../../components/icons';
import { useLive } from '../../db/live';
import { displayName, listPeople, removePerson } from '../../db/repos/people';
import type { Person } from '../../db/types';
import { fmt, t } from '../../i18n';
import { PastePeople } from './PastePeople';
import { PersonForm } from './PersonForm';

export function PeopleScreen() {
  const m = t().people;
  const people = useLive(() => listPeople(), []);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Person | 'new' | null>(null);
  const [pasting, setPasting] = useState(false);

  const q = query.trim();
  const inactiveCount = people?.filter((p) => !p.active).length ?? 0;
  const visible = (people ?? []).filter(
    (p) => (showInactive || p.active) && (!q || p.name.includes(q) || p.position.includes(q) || p.title.includes(q)),
  );

  const remove = async (p: Person) => {
    if (!confirm(fmt(m.confirmRemove, { name: p.name }))) return;
    const result = await removePerson(p.id);
    setEditing(null);
    if (result === 'deactivated') alert(m.deactivated);
  };

  return (
    <Screen
      title={m.title}
      back="#/settings"
      actions={
        <button class="btn ghost sm" onClick={() => setPasting(true)}>
          {m.paste}
        </button>
      }
    >
      <p class="muted">
        {m.subtitle}
        {people && people.length > 0 && ` · ${fmt(m.count, { n: people.filter((p) => p.active).length })}`}
      </p>

      {people && people.length > 0 && (
        <input class="search" type="search" placeholder={m.search} value={query} onInput={(e) => setQuery(e.currentTarget.value)} />
      )}

      {people === undefined ? null : people.length === 0 ? (
        <EmptyState text={m.empty} hint={m.emptyHint}>
          <button class="btn" onClick={() => setPasting(true)}>
            {m.paste}
          </button>
        </EmptyState>
      ) : (
        <ul class="list card flush">
          {visible.map((p) => (
            <li key={p.id}>
              <button class={`list-row ${p.active ? '' : 'inactive'}`} onClick={() => setEditing(p)}>
                <span class="avatar" aria-hidden="true">{p.name.trim().charAt(0)}</span>
                <span class="list-main">
                  <span class="list-title">{displayName(p)}</span>
                  {p.position && <span class="list-sub">{p.position}</span>}
                </span>
                {!p.active && <span class="badge muted-badge">{m.inactive}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {inactiveCount > 0 && <Toggle label={`${m.showInactive} (${inactiveCount})`} checked={showInactive} onChange={setShowInactive} />}

      <button class="fab" onClick={() => setEditing('new')} aria-label={m.add}>
        <PlusIcon /> <span>{m.add}</span>
      </button>

      {editing && (
        <PersonForm person={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} onRemove={remove} />
      )}
      {pasting && <PastePeople onClose={() => setPasting(false)} />}
    </Screen>
  );
}
