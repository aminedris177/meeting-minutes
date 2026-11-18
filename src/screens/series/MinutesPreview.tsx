// معاينة رأس المحضر: اللوجو واسم الجهة، وشريط العنوان، وصف بيانات الاجتماع، وأول جدول الحضور.
// نفس ترتيب المحضر الفعلي في التصدير، بألوان السلسلة.
import { useLive } from '../../db/live';
import { getOrg } from '../../db/repos/org';
import type { SeriesColors } from '../../db/types';
import { CREAM_COLOR, LIGHT_COLOR } from '../../domain/series';
import { t } from '../../i18n';
import { formatDate, type ISODate } from '../../lib/dates';
import { useObjectUrl } from '../../lib/image';

interface Props {
  seriesName: string;
  colors: SeriesColors;
  firstDate?: ISODate;
  nextDate?: ISODate;
  memberNames: string[];
}

export function MinutesPreview({ seriesName, colors, firstDate, nextDate, memberNames }: Props) {
  const m = t().series;
  const org = useLive(() => getOrg(), []);
  const logoUrl = useObjectUrl(org?.logo);
  const names = memberNames.slice(0, 2);

  return (
    <figure class="mp" aria-label={m.colorsPreview}>
      <div class="mp-top">
        {logoUrl ? <img class="mp-logo" src={logoUrl} alt="" /> : <span class="mp-logo empty" aria-hidden="true" />}
        <span class={`mp-org ${org?.name ? '' : 'placeholder'}`}>{org?.name || m.previewOrgPlaceholder}</span>
      </div>
      <div class="mp-band" style={{ background: colors.primary }}>
        <strong>{m.previewTitle}</strong>
        <span>{seriesName.trim() || '…'}</span>
      </div>
      <div class="mp-info">
        <span style={{ background: LIGHT_COLOR }}>
          {m.previewNumber}: <b dir="ltr">1</b>
        </span>
        <span style={{ background: LIGHT_COLOR }}>
          {m.previewDate}: <b dir="ltr">{firstDate ? formatDate(firstDate) : '—'}</b>
        </span>
        <span style={{ background: LIGHT_COLOR }}>
          {m.previewNext}: <b dir="ltr">{nextDate ? formatDate(nextDate) : '—'}</b>
        </span>
      </div>
      <div class="mp-section" style={{ color: colors.primary }}>
        {m.previewAttendees}
      </div>
      <table class="mp-table">
        <thead>
          <tr style={{ background: colors.secondary }}>
            <th>{m.previewIdx}</th>
            <th>{m.previewName}</th>
            <th>{m.previewPresent}</th>
          </tr>
        </thead>
        <tbody>
          {(names.length ? names : ['…', '…']).map((n, i) => (
            <tr style={{ background: i % 2 ? CREAM_COLOR : '#fff' }}>
              <td>{i + 1}</td>
              <td>{n}</td>
              <td>☑</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!org?.name && !org?.logo && (
        <figcaption class="muted small">
          {m.previewNoOrg} <a href="#/settings">{t().home.setupOrgAction}</a>
        </figcaption>
      )}
    </figure>
  );
}
