import type { JSX, ReactNode } from 'react';

export interface PrimaryButtonProps {
  /** Button label shown when idle (or always when busyLabel is omitted). */
  children: ReactNode;
  /** Optional leading icon element. */
  icon?: ReactNode;
  /** Disables the button and switches label to busyLabel when true. */
  isBusy?: boolean;
  /** Text displayed while isBusy is true. */
  busyLabel?: string;
  /** Native button type (defaults to 'button'). */
  type?: 'button' | 'submit' | 'reset';
  /** Additional disabled state (combined with isBusy). */
  disabled?: boolean;
  /** Click handler for non-submit buttons. */
  onClick?: () => void;
  /** Optional extra classes (e.g. self-start or self-end). */
  className?: string;
}

const BASE_BUTTON_CLASS =
  'inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-large bg-brand-bold px-4 py-2 text-xs font-semibold text-inverse hover:bg-brand-bold-hovered disabled:cursor-not-allowed disabled:opacity-50';

/**
 * Standard brand-coloured primary action button for MiniShop forms and sandboxes.
 *
 * @param props - Button label, optional icon, busy indicator, and click handler.
 * @returns Rendered primary action button.
 */
export function PrimaryButton({
  children,
  icon,
  isBusy,
  busyLabel,
  type,
  disabled,
  onClick,
  className,
}: PrimaryButtonProps): JSX.Element {
  const label = isBusy && busyLabel ? busyLabel : children;

  return (
    <button
      type={type ?? 'button'}
      disabled={Boolean(disabled || isBusy)}
      onClick={onClick}
      className={[BASE_BUTTON_CLASS, className].filter(Boolean).join(' ')}
    >
      {icon ? (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{label}</span>
    </button>
  );
}
