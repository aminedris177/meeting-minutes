import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { resetScroll } from './lib/scroll';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import { BottomNav } from './components/BottomNav';
import { InstallHint } from './components/InstallHint';
import { LockScreen } from './components/LockScreen';
import { useLive } from './db/live';
import { getPin, isSessionUnlocked, setSessionUnlocked } from './lib/pin';
import { useLang } from './lib/lang';
import { useBadgeSync } from './lib/alerts';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Tour } from './components/Tour';
import { isInstallHintDismissed, setInstallHintDismissed } from './lib/install';
import { isStandalone } from './lib/platform';
import { segments, useHashPath } from './lib/router';
import { HelpScreen } from './screens/Help';
import { HomeScreen } from './screens/Home';
import { PeopleScreen } from './screens/people/People';
import { FollowupScreen } from './screens/Followup';
import { ArchiveScreen } from './screens/Archive';
import { MeetingScreen } from './screens/meeting/MeetingScreen';
import { MeetingsScreen } from './screens/Meetings';
import { SeriesPage } from './screens/series/SeriesPage';
import { TaskPage } from './screens/TaskPage';
import { ReportScreen } from './screens/Report';
import { SeriesWizard } from './screens/series/SeriesWizard';
import { SettingsScreen } from './screens/settings/Settings';
import { ExportedFilesScreen } from './screens/settings/ExportedFiles';

const UPDATE_CHECK_MS = 60 * 60 * 1000; // فحص التحديثات كل ساعة وعند الرجوع للتطبيق

export function App() {
  // تغيير اللغة بيعيد رسم كل الشاشات (key على العنصر الرئيسي)
  const lang = useLang();
  // رقم المتأخر على أيقونة التطبيق
  useBadgeSync();
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
  // (على الآيفون لازم نوقف التمرير اللي لسه شغال، وإلا الشاشة الجديدة تتفتح في نص صفحة فاضية)
  useLayoutEffect(() => resetScroll(), [path]);

  // قفل الـ PIN: بيتطلب لما التطبيق يتفتح من جديد بس. بعد الفتح بيفضل مفتوح طول ما التطبيق شغال
  // (إعادة التحميل/سحب الشاشة/الخروج والرجوع مش بيقفلوه) — الحالة في sessionStorage.
  // null = مفيش PIN، undefined = لسه بيحمّل
  const pin = useLive(async () => (await getPin()) ?? null, []);
  const [unlocked, setUnlocked] = useState(isSessionUnlocked);
  // لسه بيقرا الإعداد: متعرضش البيانات لحظة قبل القفل
  if (pin === undefined) return <div class="app" />;
  if (pin && !unlocked) {
    return (
      <LockScreen
        stored={pin}
        onUnlock={() => {
          setSessionUnlocked(true);
          setUnlocked(true);
        }}
      />
    );
  }

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
        segs[1] === 'people' ? (
          <PeopleScreen />
        ) : segs[1] === 'files' ? (
          <ExportedFilesScreen />
        ) : (
          <SettingsScreen offlineReady={offlineReady} onShowInstall={reopenInstall} />
        );
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
    case 'report':
      screen = <ReportScreen />;
      break;
    case 'help':
      screen = <HelpScreen section={segs[1]} />;
      break;
    default:
      screen = <HomeScreen />;
  }

  return (
    <div key={lang} class={`app ${fullscreen ? 'fullscreen' : ''}`}>
      {showInstall && seg === '' && (
        <div class="install-wrap">
          <InstallHint onDismiss={dismissInstall} />
        </div>
      )}
      {screen}
      <Tour />
      <UpdatePrompt
        needRefresh={needRefresh}
        offlineReady={offlineToast}
        onUpdate={() => void updateServiceWorker(true)}
        onClose={() => {
          setNeedRefresh(false);
          setOfflineToast(false);
        }}
      />
      {!fullscreen && <BottomNav active={seg === 'task' || seg === 'report' ? 'followup' : seg === 'series' ? '' : seg} />}
    </div>
  );
}
