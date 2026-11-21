import type { JSX } from 'react';

export interface TextFieldProps {
  /** HTML id linking the label and input. */
  id: string;
  /** Visible label rendered above the input. */
  label: string;
  /** Controlled input value. */
  value: string | number;
  /** Called with the updated input string on change. */
  onChange: (value: string) => void;
  /** Native input type (defaults to 'text'). */
  type?: 'text' | 'number' | 'password' | 'email';
  /** Optional placeholder text. */
  placeholder?: string;
  /** Disables editing when true. */
  disabled?: boolean;
  /** Use monospace font and disable autocomplete/spellcheck for code or payload inputs. */
  mono?: boolean;
  /** Incremented on sample payload selection to trigger the vvwa-input-flash animation. */
  flashSeq?: number;
  /** Minimum value for numeric inputs. */
  min?: number;
  /** Maximum value for numeric inputs. */
  max?: number;
  /** Extra classes on the field wrapper. */
  className?: string;
  /** Extra classes on the <input> element. */
  inputClassName?: string;
}

const BASE_INPUT_CLASS =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500';
const MONO_STYLE = { fontFamily: 'var(--font-mono)' } as const;

/**
 * Accessible labeled form input with optional monospace mode and sample-payload flash feedback.
 *
 * @param props - Field id, label, value, change callback, and optional formatting flags.
 * @returns Rendered label + input pair inside a flex column.
 */
export function TextField({
  id,
  label,
  value,
  onChange,
  type,
  placeholder,
  disabled,
  mono,
  flashSeq,
  min,
  max,
  className,
  inputClassName,
}: TextFieldProps): JSX.Element {
  const flashClass = flashSeq && flashSeq > 0 ? 'vvwa-input-flash' : '';
  const monoProps = mono ? { autoComplete: 'off', spellCheck: false, style: MONO_STYLE } : {};

  return (
    <div className={['flex flex-col gap-1', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="text-xs font-medium text-slate-700">
        {label}
      </label>
      <input
        key={`${id}-${String(flashSeq ?? 0)}`}
        id={id}
        type={type ?? 'text'}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
        className={[BASE_INPUT_CLASS, flashClass, inputClassName].filter(Boolean).join(' ')}
        {...monoProps}
      />
    </div>
  );
}
