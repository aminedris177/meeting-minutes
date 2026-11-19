// حقول بحفظ تلقائي: بتحفظ بعد ما الكتابة تقف لحظة، وعند الخروج من الحقل، وعند قفل الشاشة.
import { useEffect, useRef, useState } from 'preact/hooks';

const DELAY = 600;

interface Props {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  id?: string;
  class?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}

export function AutoField({ value, onSave, multiline, rows = 2, placeholder, id, class: cls, autoFocus, ariaLabel }: Props) {
  const [local, setLocal] = useState(value);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const focused = useRef(false);
  const saveRef = useRef(onSave);
  saveRef.current = onSave;

  // لو القيمة اتغيرت من برّه (والحقل مش في إيد المستخدم) — حدّث العرض
  useEffect(() => {
    if (!focused.current && pending.current === null) setLocal(value);
  }, [value]);

  const flush = () => {
    clearTimeout(timer.current);
    if (pending.current !== null) {
      const v = pending.current;
      pending.current = null;
      void saveRef.current(v);
    }
  };

  useEffect(() => flush, []);

  const onInput = (v: string) => {
    setLocal(v);
    pending.current = v;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DELAY);
  };

  const common = {
    id,
    class: cls,
    value: local,
    placeholder,
    autoFocus,
    'aria-label': ariaLabel,
    onFocus: () => (focused.current = true),
    onBlur: () => {
      focused.current = false;
      flush();
    },
  };

  return multiline ? (
    <textarea {...common} rows={rows} onInput={(e) => onInput(e.currentTarget.value)} />
  ) : (
    <input {...common} autoComplete="off" onInput={(e) => onInput(e.currentTarget.value)} />
  );
}
