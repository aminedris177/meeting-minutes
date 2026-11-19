import { useEffect, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { BottomNav } from './components/BottomNav';
import { InstallHint } from './components/InstallHint';
import { LockScreen } from './components/LockScreen';
import { useLive } from './db/live';
import { getPin } from './lib/pin';
import { UpdatePrompt } from './components/UpdatePrompt';
import { isInstallHintDismissed, setInstallHintDismissed } from './lib/install';
import { isStandalone } from './lib/platform';
import { segments, useHashPath } from './lib/router';
import { HomeScreen } from './screens/Home';
import { PeopleScreen } from './screens/people/People';
import { FollowupScreen } from './screens/Followup';
import { ArchiveScreen } from './screens/Archive';
import { MeetingScreen } from './screens/meeting/MeetingScreen';
import { MeetingsScreen } from './screens/Meetings';
import { SeriesPage } from './screens/series/SeriesPage';
import { TaskPage } from './screens/TaskPage';
import { SeriesWizard } from './screens/series/SeriesWizard';
import { SettingsScreen } from './screens/settings/Settings';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // فحص التحديثات كل ساعة وعند الرجوع للتطبيق
const RELOCK_MS = 60 * 1000; // القفل يرجع بعد دقيقة في الخلفية

export function App() {
  const path = useHashPath();
  const segs = segments(path);
  const seg = segs[0] ?? '';
  // الشاشات اللي بملء الشاشة (معالجات) من غير الشريط السفلي
  const fullscreen = (seg === 'series' && (segs[1] === 'new' || segs[2] === 'edit')) || seg === 'meeting';

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

  // قفل الـ PIN: عند الفتح، وبعد ما التطبيق يفضل في الخلفية أكتر من دقيقة
  // null = مفيش PIN، undefined = لسه بيحمّل
  const pin = useLive(async () => (await getPin()) ?? null, []);
  const [unlocked, setUnlocked] = useState(false);
  useEffect(() => {
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RELOCK_MS) setUnlocked(false);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  // لسه بيقرا الإعداد: متعرضش البيانات لحظة قبل القفل
  if (pin === undefined) return <div class="app" />;
  if (pin && !unlocked) return <LockScreen stored={pin} onUnlock={() => setUnlocked(true)} />;

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
      screen =
        segs[1] === 'new' ? (
          <SeriesWizard key="new" />
        ) : segs[2] === 'edit' ? (
          <SeriesWizard key={segs[1]} id={segs[1]} />
        ) : (
          <SeriesPage key={segs[1]} id={segs[1] ?? ''} />
        );
      break;
    case 'meeting':
      screen = <MeetingScreen key={segs[1]} id={segs[1] ?? ''} />;
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
      {!fullscreen && <BottomNav active={seg === 'task' ? 'followup' : seg === 'series' ? '' : seg} />}
    </div>
  );
}
