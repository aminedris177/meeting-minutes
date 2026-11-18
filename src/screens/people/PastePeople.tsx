// إضافة أشخاص من قائمة ملصوقة: اسم في كل سطر، واللقب بيتعرف لوحده.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { addPeopleBulk, existingNameKeys } from '../../db/repos/people';
import { nameKey, parseNameList, TITLES, type Title } from '../../domain/names';
import { fmt, t } from '../../i18n';

interface Row {
  title: Title;
  name: string;
  position: string;
  status: 'new' | 'exists' | 'duplicate';
}

export function PastePeople({ onClose }: { onClose: () => void }) {
  const m = t().people;
  const [text, setText] = useState('');
  const [existing, setExisting] = useState<Set<string>>(new Set());
  // تعديلات اللقب اليدوية في المعاينة (بالترتيب)
  const [titleOverrides, setTitleOverrides] = useState<Record<number, Title>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void existingNameKeys().then(setExisting);
  }, []);

  const rows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    return parseNameList(text).map((p, i) => {
      const key = nameKey(p.name);
      const status = existing.has(key) ? 'exists' : seen.has(key) ? 'duplicate' : 'new';
      seen.add(key);
      return { ...p, title: titleOverrides[i] ?? p.title, status };
    });
  }, [text, existing, titleOverrides]);

  const toAdd = rows.filter((r) => r.status === 'new');

  const add = async () => {
    if (!toAdd.length || busy) return;
    setBusy(true);
    try {
      const res = await addPeopleBulk(toAdd.map((r) => ({ name: r.name, title: r.title, position: r.position, email: '' })));
      if (res.skipped.length) alert(fmt(m.pasteDone, { added: res.added.length, skipped: res.skipped.length }));
      onClose();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={m.pasteTitle}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={add} disabled={busy || toAdd.length === 0}>
            {fmt(m.pasteAdd, { n: toAdd.length })}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      <p class="muted small">{m.pasteHint}</p>
      <textarea
        class="paste-area"
        rows={6}
        value={text}
        placeholder={m.pastePlaceholder}
        onInput={(e) => {
          setText(e.currentTarget.value);
          setTitleOverrides({});
        }}
        autoFocus
      />

      {rows.length > 0 && (
        <>
          <h3 class="preview-heading">{fmt(m.pastePreview, { n: rows.length })}</h3>
          <ul class="list paste-preview">
            {rows.map((r, i) => (
              <li key={i} class={r.status === 'new' ? '' : 'skip'}>
                <select
                  class="title-select"
                  value={r.title}
                  disabled={r.status !== 'new'}
                  aria-label={m.title_}
                  onChange={(e) => setTitleOverrides({ ...titleOverrides, [i]: e.currentTarget.value as Title })}
                >
                  {TITLES.map((v) => (
                    <option value={v}>{v || m.noTitle}</option>
                  ))}
                </select>
                <span class="list-main">
                  <span class="list-title">{r.name}</span>
                  {r.position && <span class="list-sub">{r.position}</span>}
                </span>
                {r.status !== 'new' && (
                  <span class="badge muted-badge">{r.status === 'exists' ? m.pasteExists : m.pasteDuplicate}</span>
                )}
              </li>
            ))}
          </ul>
          {toAdd.length === 0 && <p class="muted small">{m.pasteNone}</p>}
        </>
      )}
    </Sheet>
  );
}
