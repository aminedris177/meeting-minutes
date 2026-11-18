// راوتر بسيط بالـ hash (#/followup) — مناسب لـ GitHub Pages اللي مبيدعمش SPA fallback.
import { useEffect, useState } from 'preact/hooks';

export function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useHashPath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onChange = () => setPath(currentPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/** أول جزء في المسار: "/followup/12" → "followup" */
export function topSegment(path: string): string {
  return path.split('/').filter(Boolean)[0] ?? '';
}
