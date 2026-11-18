// ورقة سفلية (bottom sheet) للنماذج والاختيارات.
import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n';
import { CloseIcon } from './icons';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
}

export function Sheet({ title, onClose, children, footer }: Props) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header class="sheet-header">
          <h2>{title}</h2>
          <button class="icon-btn" onClick={onClose} aria-label={t().common.close}>
            <CloseIcon />
          </button>
        </header>
        <div class="sheet-body">{children}</div>
        {footer && <footer class="sheet-footer">{footer}</footer>}
      </div>
    </div>
  );
}
