import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { BottomNav } from './components/BottomNav';
import { InstallHint } from './components/InstallHint';
import { UpdatePrompt } from './components/UpdatePrompt';
import { isInstallHintDismissed, setInstallHintDismissed } from './lib/install';
import { isStandalone } from './lib/platform';
import { segments, useHashPath } from './lib/router';
import { HomeScreen } from './screens/Home';
import { PeopleScreen } from './screens/people/People';
import { FollowupScreen } from './screens/Followup';
import { ArchiveScreen, MeetingsScreen } from './screens/placeholders';
import { TaskPage } from './screens/TaskPage';
import { SeriesWizard } from './screens/series/SeriesWizard';
import { SettingsScreen } from './screens/settings/Settings';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // فحص التحديثات كل ساعة وعند الرجوع للتطبيق

export function App() {
  const path = useHashPath();
  const segs = segments(path);
  const seg = segs[0] ?? '';
  // الشاشات اللي بملء الشاشة (معالجات) من غير الشريط السفلي
  const fullscreen = seg === 'series';

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady],
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
  // رسالة «جاهز بدون إنترنت» معلومة بس — بتختفي لوحدها. (حالة offlineReady نفسها بتفضل للإعدادات)
  const [offlineToast, setOfflineToast] = useState(false);
  useEffect(() => {
    if (!offlineReady) return;
    setOfflineToast(true);
    const timer = setTimeout(() => setOfflineToast(false), 4000);
    return () => clearTimeout(timer);
  }, [offlineReady]);

  // تمرير لأعلى عند تغيير الشاشة
  useEffect(() => window.scrollTo(0, 0), [path]);

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
    case 'task':
      screen = <TaskPage key={segs[1]} id={segs[1] ?? ''} />;
      break;
    case 'archive':
      screen = <ArchiveScreen />;
      break;
    case 'settings':
      screen =
        segs[1] === 'people' ? <PeopleScreen /> : <SettingsScreen offlineReady={offlineReady} onShowInstall={reopenInstall} />;
      break;
    case 'series':
      screen = <SeriesWizard key={segs[1]} id={segs[1] === 'new' ? undefined : segs[1]} />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <div class={`app ${fullscreen ? 'fullscreen' : ''}`}>
      {showInstall && seg === '' && (
        <div class="install-wrap">
          <InstallHint onDismiss={dismissInstall} />
        </div>
      )}
      {screen}
      <UpdatePrompt
        needRefresh={needRefresh}
        offlineReady={offlineToast}
        onUpdate={() => void updateServiceWorker(true)}
        onClose={() => {
          setNeedRefresh(false);
          setOfflineToast(false);
        }}
      />
      {!fullscreen && <BottomNav active={seg === 'task' ? 'followup' : seg} />}
    </div>
  );
}
