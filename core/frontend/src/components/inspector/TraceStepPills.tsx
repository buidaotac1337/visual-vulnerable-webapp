import type { JSX } from 'react';

import type { TraceStatus, TraceStep } from '@/types';

import { Tooltip } from '../ui';

/** Props for clickable per-step trace scrubber pills. */
export interface TraceStepPillsProps {
  steps: readonly TraceStep[];
  activeIndex: number;
  onJumpToStep: (index: number) => void;
}

const PILL_STATUS_STYLES: Record<TraceStatus, { dot: string; border: string }> = {
  info: { dot: 'bg-info-400', border: 'border-info-500/45' },
  warning: { dot: 'bg-warning-400', border: 'border-warning-500/50' },
  danger: { dot: 'bg-danger-400', border: 'border-danger-500/50' },
  safe: { dot: 'bg-safe-400', border: 'border-safe-500/50' },
};

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
        const style = PILL_STATUS_STYLES[step.status];
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
              className={`inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-0.5 text-xs transition-colors duration-150 ${
                isActive
                  ? 'border-slate-200 bg-slate-100 font-semibold text-slate-900'
                  : `${style.border} bg-slate-900/70 font-medium text-slate-300 hover:bg-slate-800 hover:text-white`
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
