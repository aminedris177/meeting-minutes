import { useEffect, useState } from 'preact/hooks';
import { Screen } from '../../components/Screen';
import { ChevronIcon, HelpIcon, PeopleIcon } from '../../components/icons';
import { useLive } from '../../db/live';
import { db } from '../../db/schema';
import { fmt, t } from '../../i18n';
import { formatDate } from '../../lib/dates';
import { formatBytes, getPersistState, getStorageUsage, isStandalone, type PersistState } from '../../lib/platform';
import { BackupCard } from './BackupCard';
import { LanguageCard } from './LanguageCard';
import { AppearanceCard } from './AppearanceCard';
import { OrgCard } from './OrgCard';
import { PinCard } from './PinCard';
import { BadgeCard } from './BadgeCard';
import { listFiles } from '../../db/files';

interface Props {
  offlineReady: boolean;
  onShowInstall: () => void;
}

export function SettingsScreen({ offlineReady, onShowInstall }: Props) {
  const m = t().settings;
  const [persist, setPersist] = useState<PersistState | null>(null);
  const [usage, setUsage] = useState<string>('');
  const standalone = isStandalone();
  const peopleCount = useLive(() => db.people.filter((p) => p.active).count(), []);
  const exported = useLive(async () => {
    const fs = await listFiles();
    return { n: fs.length, size: fs.reduce((s, f) => s + f.size, 0) };
  }, []);
  const counts = useLive(async () => ({ tasks: await db.tasks.count(), updates: await db.taskUpdates.count(), meetings: await db.meetings.count() }), []);

  useEffect(() => {
    void getPersistState().then(setPersist);
    void getStorageUsage().then((u) => u && setUsage(`${formatBytes(u.usage)} / ${formatBytes(u.quota)}`));
  }, []);

  const persistText =
    persist === 'persisted' ? m.storagePersisted : persist === 'not-persisted' ? m.storageNotPersisted : persist ? m.storageUnknown : '…';

  return (
    <Screen title={m.title}>
      {/* اسم المطوّر — بالإنجليزي في اللغتين، أول الإعدادات */}
      <p class="credit" dir="ltr">© 2026 Eng. Amin Edris</p>
      <a class="card nav-card" href="#/help">
        <HelpIcon />
        <span class="list-main">
          <span class="list-title">{t().help.open}</span>
          <span class="list-sub">{t().help.openHint}</span>
        </span>
        <ChevronIcon />
      </a>
      <LanguageCard />
      <AppearanceCard />
      <OrgCard />

      <a class="card nav-card" href="#/settings/people">
        <PeopleIcon />
        <span class="list-main">
          <span class="list-title">{m.peopleLink}</span>
          {peopleCount !== undefined && <span class="list-sub">{fmt(t().people.count, { n: peopleCount })}</span>}
        </span>
        <ChevronIcon />
      </a>

      <BackupCard />
      <a class="card nav-card" href="#/settings/files">
        <span class="list-main">
          <span class="list-title">{t().exported.title}</span>
          {exported && <span class="list-sub">{fmt(t().exported.navHint, { n: exported.n, size: formatBytes(exported.size) })}</span>}
        </span>
        <ChevronIcon />
      </a>
      <PinCard />
      <BadgeCard />

      <section class="card">
        <h2>{m.storage}</h2>
        <p class={persist === 'not-persisted' ? 'warn' : ''}>{persistText}</p>
        {usage && (
          <p class="muted">
            {m.storageUsage}: <span dir="ltr">{usage}</span>
          </p>
        )}
        {counts && <p class="muted">{fmt(m.dataCounts, counts)}</p>}
        <p class="muted">
          {m.displayMode}: {standalone ? m.installed : m.inBrowser}
        </p>
        {!standalone && (
          <button class="btn ghost" onClick={onShowInstall}>
            {t().install.show}
          </button>
        )}
      </section>

      <section class="card">
        <h2>{m.about}</h2>
        <p class="muted">
          {m.version}: <span dir="ltr">{__APP_VERSION__}</span>
          <br />
          {m.build}: <span dir="ltr">{__BUILD_ID__} · {formatDate(__BUILD_DATE__)}</span>
        </p>
        <p class="muted">{offlineReady || navigator.serviceWorker?.controller ? m.offlineReady : m.offlineNotReady}</p>
      </section>
    </Screen>
  );
}
