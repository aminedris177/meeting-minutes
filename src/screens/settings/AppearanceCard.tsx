// الإعدادات ← المظهر (فاتح/داكن/حسب الموبايل) وحجم الخط.
import { Segmented } from '../../components/fields';
import { t } from '../../i18n';
import { setTextSize, setTheme, TEXT_SIZES, THEMES, useAppearance, type TextSize, type Theme } from '../../lib/appearance';

export function AppearanceCard() {
  const m = t().settings;
  const { theme, size } = useAppearance();
  return (
    <section class="card">
      <h2>{m.appearance}</h2>
      <p class="muted small">{m.appearanceHint}</p>
      <Segmented<Theme> value={theme} options={THEMES.map((v) => ({ value: v, label: m.themeNames[v] }))} onChange={setTheme} />
      <p class="field-label" style={{ margin: "12px 0 6px", fontWeight: 600, fontSize: "0.92rem" }}>{m.textSize}</p>
      <Segmented<TextSize> value={size} options={TEXT_SIZES.map((v) => ({ value: v, label: m.textSizeNames[v] }))} onChange={setTextSize} />
    </section>
  );
}
