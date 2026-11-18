import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { BottomNav } from './components/BottomNav';
import { InstallHint } from './components/InstallHint';
import { UpdatePrompt } from './components/UpdatePrompt';
import { isInstallHintDismissed, setInstallHintDismissed } from './lib/install';
import { isStandalone } from './lib/platform';
import { topSegment, useHashPath } from './lib/router';
import { ArchiveScreen, FollowupScreen, HomeScreen, MeetingsScreen } from './screens/placeholders';
import { SettingsScreen } from './screens/Settings';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // فحص التحديثات كل ساعة وعند الرجوع للتطبيق

export function App() {
  const path = useHashPath();
  const seg = topSegment(path);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => {
        if (navigator.onLine) void reg.update();
      };
      setInterval(check, UPDATE_CHECK_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check();
      });
    },
  });

  const [showInstall, setShowInstall] = useState(() => !isStandalone() && !isInstallHintDismissed());

  // تمرير لأعلى عند تغيير الشاشة
  useEffect(() => window.scrollTo(0, 0), [seg]);

  const dismissInstall = () => {
    setInstallHintDismissed(true);
    setShowInstall(false);
  };
  const reopenInstall = () => {
    setInstallHintDismissed(false);
    setShowInstall(true);
    window.location.hash = '/';
  };

  let screen;
  switch (seg) {
    case 'meetings':
      screen = <MeetingsScreen />;
      break;
    case 'followup':
      screen = <FollowupScreen />;
      break;
    case 'archive':
      screen = <ArchiveScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen offlineReady={offlineReady} onShowInstall={reopenInstall} />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <div class="app">
      {showInstall && seg === '' && (
        <div class="install-wrap">
          <InstallHint onDismiss={dismissInstall} />
        </div>
      )}
      {screen}
      <UpdatePrompt
        needRefresh={needRefresh}
        offlineReady={offlineReady}
        onUpdate={() => void updateServiceWorker(true)}
        onClose={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      />
      <BottomNav active={seg} />
    </div>
  );
}
