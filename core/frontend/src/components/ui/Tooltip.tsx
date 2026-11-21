import { cloneElement, useEffect, useId, useState } from 'react';
import type { JSX, ReactElement } from 'react';

type TooltipTrigger = ReactElement<{ 'aria-describedby'?: string }>;

interface TooltipProps {
  /** Explanation shown on hover or keyboard focus. */
  tip: string;
  /** The single focusable element the tooltip describes. */
  children: TooltipTrigger;
  /** Show above (for controls at the bottom of a panel) or below the trigger. */
  side?: 'top' | 'bottom';
  /** Anchor to the trigger's centre, or to its end for controls near the right edge. */
  align?: 'center' | 'end';
}

const SIDE_CLASS = { top: 'bottom-full mb-1.5', bottom: 'top-full mt-1.5' } as const;
const ALIGN_CLASS = { center: 'left-1/2 -translate-x-1/2', end: 'right-0' } as const;

/**
 * Accessible tooltip (WAI-ARIA tooltip pattern) for workspace controls.
 *
 * Opens on hover and on keyboard focus, closes on Escape, blur, or pointer leave, and
 * links itself to the trigger with aria-describedby so screen readers read the tip too.
 * Always rendered (hidden when closed) so the description is available before opening.
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

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute z-50 w-max max-w-64 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-normal leading-snug text-white shadow-lg ${SIDE_CLASS[side]} ${ALIGN_CLASS[align]} ${open ? '' : 'hidden'}`}
      >
        {tip}
      </span>
    </span>
  );
}
