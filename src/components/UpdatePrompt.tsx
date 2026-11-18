// شريط «تحديث متاح»: النسخة الجديدة متتفعّلش إلا بموافقة المستخدم.
import { t } from '../i18n';
import { RefreshIcon } from './icons';

interface Props {
  needRefresh: boolean;
  offlineReady: boolean;
  onUpdate: () => void;
  onClose: () => void;
}

export function UpdatePrompt({ needRefresh, offlineReady, onUpdate, onClose }: Props) {
  const m = t().update;
  if (!needRefresh && !offlineReady) return null;

  return (
    <div class="toast" role="status">
      {needRefresh ? (
        <>
          <RefreshIcon />
          <span class="toast-text">{m.available}</span>
          <button class="btn primary sm" onClick={onUpdate}>{m.apply}</button>
          <button class="btn ghost sm" onClick={onClose}>{m.dismiss}</button>
        </>
      ) : (
        <>
          <span class="toast-text">{m.offlineReady}</span>
          <button class="btn ghost sm" onClick={onClose}>{m.ok}</button>
        </>
      )}
    </div>
  );
}
