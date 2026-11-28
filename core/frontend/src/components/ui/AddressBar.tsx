import type { FormEvent, JSX } from 'react';
import { Globe } from 'lucide-react';

import { PrimaryButton } from './PrimaryButton';

export interface AddressBarProps {
  /** HTML id for the inline URL input. */
  id: string;
  /** Accessible label for the inline URL input. */
  ariaLabel: string;
  /** Static monospace URL prefix rendered before the editable input. */
  prefix: string;
  /** Controlled input value. */
  value: string;
  /** Called with the updated input string on change. */
  onChange: (value: string) => void;
  /** Called when the user submits a valid address bar form. */
  onSubmit: () => void;
  /** Submit button label when idle. */
  submitLabel: string;
  /** Submit button label while isBusy is true. */
  busyLabel?: string;
  /** Native input type (defaults to 'text'). */
  type?: 'text' | 'number';
  /** Disables the input when true. */
  disabled?: boolean;
  /** Disables submission and switches button label to busyLabel. */
  isBusy?: boolean;
  /** Additional submit disable condition (e.g. empty or invalid value). */
  submitDisabled?: boolean;
  /** Incremented on sample payload selection to trigger the vvwa-input-flash animation. */
  flashSeq?: number;
  /** Optional placeholder text inside the address input. */
  placeholder?: string;
  /** Extra classes on the inline <input> (defaults to 'min-w-0 flex-1'). */
  inputClassName?: string;
}

/**
 * Simulated browser URL bar form with a fixed monospace prefix and submit button.
 *
 * @param props - Prefix, input value/handlers, submit label, and optional busy/flash state.
 * @returns Rendered form combining the address input and primary submit button.
 */
export function AddressBar({
  id,
  ariaLabel,
  prefix,
  value,
  onChange,
  onSubmit,
  submitLabel,
  busyLabel,
  type,
  disabled,
  isBusy,
  submitDisabled,
  flashSeq,
  placeholder,
  inputClassName,
}: AddressBarProps): JSX.Element {
  const flashClass = flashSeq && flashSeq > 0 ? 'vvwa-input-flash' : '';
  const blocked = Boolean(disabled || isBusy || submitDisabled);

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (!blocked) {
      onSubmit();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-large border border-input bg-surface-sunken px-3 py-2 text-xs text-subtlest focus-within:border-focused font-mono"
      >
        <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="shrink-0">{prefix}</span>
        <input
          key={`${id}-${String(flashSeq ?? 0)}`}
          id={id}
          type={type ?? 'text'}
          aria-label={ariaLabel}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => onChange(event.target.value)}
          className={[
            'bg-transparent text-default focus:outline-none',
            inputClassName ?? 'min-w-0 flex-1',
            flashClass,
          ]
            .filter(Boolean)
            .join(' ')}
        />
      </label>
      <PrimaryButton
        type="submit"
        disabled={Boolean(submitDisabled || disabled)}
        isBusy={isBusy}
        busyLabel={busyLabel}
      >
        {submitLabel}
      </PrimaryButton>
    </form>
  );
}
