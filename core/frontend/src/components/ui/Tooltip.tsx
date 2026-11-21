import { cloneElement, useEffect, useId, useState } from 'react';
import type { JSX, ReactElement } from 'react';

type TooltipTrigger = ReactElement<{ 'aria-describedby'?: string; disabled?: boolean }>;

interface TooltipProps {
  /** Explanation shown on hover or keyboard focus. */
  tip: string;
  /** The single focusable element the tooltip describes. */
  children: TooltipTrigger;
  /** Show above (for controls at the bottom of a panel) or below the trigger. */
  side?: 'top' | 'bottom';
  /** Anchor to the trigger's start (left), centre, or end (right) to avoid clipping near edges. */
  align?: 'start' | 'center' | 'end';
}

const SIDE_CLASS = { top: 'bottom-full pb-1.5', bottom: 'top-full pt-1.5' } as const;
const ALIGN_CLASS = {
  start: 'left-0',
  center: 'left-1/2 -translate-x-1/2',
  end: 'right-0',
} as const;

/**
 * Accessible tooltip (WAI-ARIA tooltip pattern) for workspace controls.
 *
 * Opens on hover and on keyboard focus, closes on Escape, blur, pointer leave, or when the
 * trigger transitions to disabled, and links itself to the trigger with aria-describedby so
 * screen readers read the tip too. Always rendered (hidden when closed) so the description is
 * available before opening, and padded seamlessly (WCAG 1.4.13) so hovering onto the tooltip
 * keeps it open.
 *
 * @param props - Tip text, trigger element, and placement.
 * @returns The trigger wrapped with its tooltip.
 */
export function Tooltip({
  tip,
  children,
  side = 'bottom',
  align = 'center',
}: TooltipProps): JSX.Element {
  const id = useId();
  const [open, setOpen] = useState(false);
  const isDisabled = Boolean(children.props.disabled);
  const [prevDisabled, setPrevDisabled] = useState(isDisabled);

  if (isDisabled !== prevDisabled) {
    setPrevDisabled(isDisabled);
    if (isDisabled) {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        event.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const existingDescribedBy = children.props['aria-describedby']?.trim();
  const describedBy = existingDescribedBy ? `${existingDescribedBy} ${id}` : id;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span
        className={`absolute z-50 w-max max-w-64 ${SIDE_CLASS[side]} ${ALIGN_CLASS[align]} ${open ? '' : 'hidden'}`}
      >
        <span
          role="tooltip"
          id={id}
          className={`block rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-left text-xs font-normal leading-snug text-white shadow-lg ${open ? '' : 'hidden'}`}
        >
          {tip}
        </span>
      </span>
    </span>
  );
}
