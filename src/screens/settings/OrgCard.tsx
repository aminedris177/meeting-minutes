import { useEffect, useRef, useState } from 'preact/hooks';
import { TextField } from '../../components/fields';
import { useLive } from '../../db/live';
import { getOrg, saveOrgLogo, saveOrgName } from '../../db/repos/org';
import { t } from '../../i18n';
import { resizeImage, useObjectUrl } from '../../lib/image';

export function OrgCard() {
  const m = t().org;
  const org = useLive(() => getOrg(), []);
  const [name, setName] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoUrl = useObjectUrl(org?.logo);
  const loaded = useRef(false);
  // المستخدم كتب حاجة؟ — ساعتها القيمة المحمّلة متكتبش فوق كلامه
  const typed = useRef(false);

  // عبّي الاسم مرة واحدة أول ما البيانات تيجي
  useEffect(() => {
    if (org && !loaded.current) {
      loaded.current = true;
      if (!typed.current) setName(org.name);
    }
  }, [org]);

  const flash = () => {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const commitName = async () => {
    const current = org ?? (await getOrg());
    if (name.trim() === current.name) return;
    await saveOrgName(name);
    flash();
  };

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await saveOrgLogo(await resizeImage(file));
      flash();
    } catch {
      alert(m.logoError);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <section class="card">
      <div class="card-title-row">
        <h2>{m.title}</h2>
        {savedFlash && <span class="saved">{m.saved} ✓</span>}
      </div>
      <TextField label={m.name} value={name} onInput={(v) => ((typed.current = true), setName(v))} onBlur={commitName} placeholder={m.namePlaceholder} />

      <div class="field">
        <span class="label">{m.logo}</span>
        <div class="logo-row">
          <div class="logo-box">{logoUrl ? <img src={logoUrl} alt={m.logo} /> : <span class="muted">{m.noLogo}</span>}</div>
          <div class="logo-actions">
            <button class="btn sm" disabled={busy} onClick={() => fileRef.current?.click()}>
              {org?.logo ? m.changeLogo : m.chooseLogo}
            </button>
            {org?.logo && (
              <button class="btn ghost sm" disabled={busy} onClick={() => void saveOrgLogo(undefined)}>
                {m.removeLogo}
              </button>
            )}
          </div>
        </div>
        <small class="hint">{m.logoHint}</small>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => void pickLogo(e.currentTarget.files?.[0])} />
      </div>
    </section>
  );
}
