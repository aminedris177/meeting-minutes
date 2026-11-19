// الإعدادات ← اللغة: العربية (RTL) أو English (LTR). بتأثر على الواجهة والمحاضر والملفات المصدّرة.
import { Segmented } from '../../components/fields';
import { getLang, LANGS, t, type Lang } from '../../i18n';
import { applyLanguage } from '../../lib/lang';

export function LanguageCard() {
  const m = t().settings;
  return (
    <section class="card">
      <h2>{m.language}</h2>
      <p class="muted small">{m.languageHint}</p>
      <Segmented<Lang>
        value={getLang()}
        options={LANGS.map((l) => ({ value: l, label: m.langNames[l] }))}
        onChange={(l) => void applyLanguage(l)}
      />
    </section>
  );
}
