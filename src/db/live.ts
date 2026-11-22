// hook لقراءة بيانات Dexie وتحديث الشاشة تلقائياً لما البيانات تتغير.
import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** undefined = لسه بيحمّل */
export function useLive<T>(query: () => Promise<T> | T, deps: unknown[]): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    let sub: { unsubscribe: () => void } | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    const start = () => {
      sub = liveQuery(query).subscribe({
        next: setValue,
        error: (e) => {
          console.error('liveQuery failed', e);
          // محاولة تانية بعد لحظة بدل ما الشاشة تفضل فاضية
          if (tries++ < 3) retry = setTimeout(start, 300 * tries);
        },
      });
    };
    start();
    return () => {
      clearTimeout(retry);
      sub?.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
