// حقول الإدخال المشتركة.
import type { ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { t } from '../i18n';
import { formatDate, type ISODate } from '../lib/dates';

interface TextFieldProps {
  label: string;
  value: string;
  onInput: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  hint?: ComponentChildren;
  error?: string | false;
  type?: 'text' | 'email' | 'number';
  inputMode?: 'text' | 'email' | 'numeric';
  dir?: 'rtl' | 'ltr' | 'auto';
  maxLength?: number;
  autoFocus?: boolean;
  list?: string;
  autoCapitalize?: 'characters' | 'none' | 'off' | 'on' | 'sentences' | 'words';
}

export function TextField(p: TextFieldProps) {
  const id = useId();
  return (
    <div class={`field ${p.error ? 'has-error' : ''}`}>
      <label for={id}>{p.label}</label>
      <input
        id={id}
        type={p.type ?? 'text'}
        inputMode={p.inputMode}
        value={p.value}
        placeholder={p.placeholder}
        dir={p.dir}
        maxLength={p.maxLength}
        autoFocus={p.autoFocus}
        list={p.list}
        autoCapitalize={p.autoCapitalize}
        autoComplete="off"
        onInput={(e) => p.onInput(e.currentTarget.value)}
        onBlur={p.onBlur}
      />
      {p.error ? <small class="error">{p.error}</small> : p.hint ? <small class="hint">{p.hint}</small> : null}
    </div>
  );
}

interface DateFieldProps {
  label: string;
  value: ISODate | undefined;
  onChange: (v: ISODate | undefined) => void;
  hint?: ComponentChildren;
  clearable?: boolean;
}

/**
 * تاريخ: بيتعرض dd/mm/yyyy دايماً، والاختيار بمنتقي التاريخ الأصلي للموبايل
 * (input شفاف فوق الزرار).
 */
export function DateField({ label, value, onChange, hint, clearable = true }: DateFieldProps) {
  const id = useId();
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <div class="date-row">
        <div class="date-display">
          <span dir="ltr" class={value ? '' : 'placeholder'}>
            {value ? formatDate(value) : 'dd/mm/yyyy'}
          </span>
          <input
            id={id}
            type="date"
            class="date-native"
            value={value ?? ''}
            aria-label={label}
            onInput={(e) => onChange(e.currentTarget.value || undefined)}
            onChange={(e) => onChange(e.currentTarget.value || undefined)}
          />
        </div>
        {clearable && value && (
          <button type="button" class="btn ghost sm" onClick={() => onChange(undefined)}>
            {t().common.clear}
          </button>
        )}
      </div>
      {hint && <small class="hint">{hint}</small>}
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

export function Toggle({ label, checked, onChange, hint }: ToggleProps) {
  return (
    <label class="toggle">
      <span class="toggle-text">
        <span>{label}</span>
        {hint && <small class="hint">{hint}</small>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.currentTarget.checked)} />
      <span class="switch" aria-hidden="true" />
    </label>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ value, options, onChange }: SegmentedProps<T>) {
  return (
    <div class="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === o.value}
          class={value === o.value ? 'on' : ''}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <label class="color-field" for={id}>
      <input id={id} type="color" value={value} onInput={(e) => onChange(e.currentTarget.value.toUpperCase())} />
      <span>{label}</span>
      <code dir="ltr">{value}</code>
    </label>
  );
}
