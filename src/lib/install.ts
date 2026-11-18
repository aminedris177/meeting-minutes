// حدث التثبيت على أندرويد/Chrome (beforeinstallprompt) — بيتلقط بدري في main.tsx.
import { useEffect, useState } from 'preact/hooks';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

export function useCanPromptInstall(): boolean {
  const [can, setCan] = useState(deferred !== null);
  useEffect(() => {
    const l = () => setCan(deferred !== null);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return can;
}

export async function promptInstall(): Promise<void> {
  if (!deferred) return;
  await deferred.prompt();
  await deferred.userChoice;
  deferred = null;
  notify();
}

// إخفاء التنبيه للجلسة الحالية فقط — بيرجع يظهر في كل فتحة لحد ما يتثبّت.
const DISMISS_KEY = 'install-hint-dismissed';

export function isInstallHintDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function setInstallHintDismissed(v: boolean): void {
  try {
    if (v) sessionStorage.setItem(DISMISS_KEY, '1');
    else sessionStorage.removeItem(DISMISS_KEY);
  } catch {
    /* ignore */
  }
}
