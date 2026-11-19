// نموذج إضافة/تعديل شخص — بيتستخدم في دليل الأشخاص وفي معالج السلسلة.
import { useState } from 'preact/hooks';
import { Sheet } from '../../components/Sheet';
import { Segmented, TextField, Toggle } from '../../components/fields';
import { TrashIcon } from '../../components/icons';
import { addPerson, titleLabel, updatePerson, type PersonInput } from '../../db/repos/people';
import type { Person } from '../../db/types';
import { normalizeTitle, splitTitle, TITLES } from '../../domain/names';
import { fmt, t } from '../../i18n';

interface Props {
  person?: Person;
  onClose: () => void;
  onSaved?: (p: Person) => void;
  onRemove?: (p: Person) => void;
}

export function PersonForm({ person, onClose, onSaved, onRemove }: Props) {
  const m = t().people;
  const [form, setForm] = useState<PersonInput>({
    name: person?.name ?? '',
    title: normalizeTitle(person?.title ?? ''),
    position: person?.position ?? '',
    email: person?.email ?? '',
  });
  const [active, setActive] = useState(person?.active ?? true);
  const [triedSave, setTriedSave] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof PersonInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const nameError = triedSave && !form.name.trim() ? m.nameRequired : false;

  // لو اللقب اتكتب جوه الاسم («م/ فلان»)، انقله لخانة اللقب
  const extractTitle = () =>
    setForm((f) => {
      const { title, name } = splitTitle(f.name);
      return title ? { ...f, title, name } : f;
    });

  // اختيارات اللقب: الثابتة + لقب قديم غير معروف لو موجود
  const titleOptions = [...TITLES, ...(form.title && !(TITLES as readonly string[]).includes(form.title) ? [form.title] : [])].map((v) => ({
    value: v,
    label: v ? titleLabel(v) : m.noTitle,
  }));

  const save = async () => {
    setTriedSave(true);
    if (!form.name.trim() || busy) return;
    setBusy(true);
    // لو اللقب لسه جوه الاسم وقت الحفظ
    const split = splitTitle(form.name);
    const final = split.title && !form.title ? { ...form, title: split.title, name: split.name } : form;
    try {
      if (person) {
        await updatePerson(person.id, { ...final, active });
        onSaved?.({ ...person, ...final, active });
      } else {
        // مهم: الحفظ منفصل عن onSaved?.() — لأن ?.() بيتجاهل الـ argument كله لو onSaved مش موجود
        const added = await addPerson(final);
        onSaved?.(added);
      }
      onClose();
    } catch (e) {
      alert(fmt(t().common.error, { msg: String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      title={person ? m.edit : m.add}
      onClose={onClose}
      footer={
        <>
          <button class="btn primary grow" onClick={save} disabled={busy}>
            {t().common.save}
          </button>
          <button class="btn ghost" onClick={onClose}>
            {t().common.cancel}
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField label={m.name} value={form.name} onInput={set('name')} onBlur={extractTitle} error={nameError} autoFocus={!person} />
        <div class="field">
          <span class="label">{m.title_}</span>
          <Segmented value={form.title} options={titleOptions} onChange={set('title')} />
        </div>
        <TextField label={m.position} value={form.position} onInput={set('position')} />
        <TextField label={m.email} value={form.email} onInput={set('email')} type="email" inputMode="email" dir="ltr" autoCapitalize="none" />
        {person && <Toggle label={m.active} checked={active} onChange={setActive} />}
        {/* زرار submit مخفي علشان «Go» في كيبورد الموبايل يحفظ */}
        <button type="submit" hidden />
      </form>
      {person && onRemove && (
        <button class="btn danger-ghost full" onClick={() => onRemove(person)}>
          <TrashIcon width={18} height={18} /> {m.remove}
        </button>
      )}
    </Sheet>
  );
}
