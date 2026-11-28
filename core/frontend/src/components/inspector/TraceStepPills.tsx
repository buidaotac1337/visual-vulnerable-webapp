import type { JSX } from 'react';

import { statusToneClasses } from '@/lib';
import type { TraceStatus, TraceStep } from '@/types';

import { Tooltip } from '../ui';

/** Props for clickable per-step trace scrubber pills. */
export interface TraceStepPillsProps {
  steps: readonly TraceStep[];
  activeIndex: number;
  onJumpToStep: (index: number) => void;
}

/** Pill dot and border colours come from the status tone (lib/tones.ts, ADR-0012). */
function pillStatusStyle(status: TraceStatus): { dot: string; border: string } {
  const classes = statusToneClasses(status);
  return { dot: classes.bgBold, border: classes.borderSubtle };
}

/**
 * Render clickable step-number scrubber pills with semantic status dots so students
 * can inspect any trace step directly without stepping linearly from the start.
 *
 * @param props - Trace steps, active step index, and step-jump callback.
 * @returns Step pill bar, or null when no steps are available.
 */
export function TraceStepPills({
  steps,
  activeIndex,
  onJumpToStep,
}: TraceStepPillsProps): JSX.Element | null {
  if (steps.length === 0) {
    return null;
  }

  return (
    <div role="group" aria-label="Các bước trace" className="flex flex-wrap items-center gap-1">
      {steps.map((step, index) => {
        const isActive = index === activeIndex;
        const style = pillStatusStyle(step.status);
        const label = `Bước ${String(step.step)}: ${step.title}`;
        return (
          <Tooltip
            key={`${String(step.step)}-${step.tag}-${String(index)}`}
            tip={step.title}
            side="bottom"
            align="end"
          >
            <button
              type="button"
              aria-current={isActive ? 'step' : undefined}
              aria-label={label}
              onClick={() => onJumpToStep(index)}
              className={`inline-flex cursor-pointer items-center gap-1 rounded-medium border px-2 py-0.5 text-xs transition-colors duration-150 ${
                isActive
                  ? 'border-bold bg-neutral-bold font-semibold text-inverse'
                  : `${style.border} bg-surface font-medium text-subtle hover:bg-neutral-hovered hover:text-default`
              }`}
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                aria-hidden="true"
              />
              <span>{step.step}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
