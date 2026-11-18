// تنبيه التثبيت:
// - آيفون غير مثبّت: خطوات «إضافة إلى الشاشة الرئيسية» (ضرورية لحماية البيانات).
// - أندرويد/Chrome: زرار «تثبيت التطبيق» لو المتصفح عرض إمكانية التثبيت.
import { t } from '../i18n';
import { promptInstall, useCanPromptInstall } from '../lib/install';
import { isIOS } from '../lib/platform';
import { AddSquareIcon, IOSShareIcon } from './icons';

export function InstallHint({ onDismiss }: { onDismiss: () => void }) {
  const canPrompt = useCanPromptInstall();
  const m = t().install;

  if (isIOS()) {
    return (
      <section class="card install-hint" role="alert">
        <h2>{m.iosTitle}</h2>
        <p>{m.iosBody}</p>
        <ol class="install-steps">
          <li>
            <span class="step-icon"><IOSShareIcon /></span>
            <span>
              {m.iosStep1} <small>{m.iosStep1Hint}</small>
            </span>
          </li>
          <li>
            <span class="step-icon"><AddSquareIcon /></span>
            <span>{m.iosStep2}</span>
          </li>
          <li>
            <span class="step-icon step-num">3</span>
            <span>{m.iosStep3}</span>
          </li>
        </ol>
        <div class="actions">
          <button class="btn ghost" onClick={onDismiss}>{m.later}</button>
        </div>
      </section>
    );
  }

  if (!canPrompt) return null;

  return (
    <section class="card install-hint">
      <h2>{m.androidTitle}</h2>
      <p>{m.androidBody}</p>
      <div class="actions">
        <button class="btn primary" onClick={() => void promptInstall()}>{m.installButton}</button>
        <button class="btn ghost" onClick={onDismiss}>{m.later}</button>
      </div>
    </section>
  );
}
