import type { JSX } from 'react';
import { ChevronLeft, ChevronRight, Shield } from 'lucide-react';

import { UI_LABELS } from '@/lib';

import { Tooltip } from '../ui';

import { normalizeControlsProps, resolvePlayButtonState } from './traceControlState';
import type { TraceControlsProps } from './traceControlState';
import { TraceSpeedSwitch } from './TraceSpeedSwitch';
import { TraceStepPills } from './TraceStepPills';

export type { TraceControlsProps };

const STEP_BTN_CLASS =
  'inline-flex cursor-pointer items-center gap-1 rounded-medium border border-default bg-neutral px-2.5 py-1 text-xs font-medium text-default hover:bg-neutral-hovered disabled:cursor-not-allowed disabled:opacity-40';
const KEYCAP_CLASS =
  'rounded-small border border-default bg-neutral px-1.5 py-0.5 text-xs text-default';

/**
 * Render trace playback progress bar, Prev / Play-Pause-Replay / Next controls,
 * speed switch, step scrubber pills, keyboard hints, and Safety Pattern summary
 * anchored at the bottom of the Dark IDE Inspector surface.
 *
 * @param props - Playback position, speed, steps, callbacks, and safetyPattern summary.
 * @returns Rendered footer panel for CodeInspector.
 */
export function TraceControls(props: TraceControlsProps): JSX.Element {
  const { totalSteps, activeIndex, status, safetyPattern, onPrev, onNext } = props;
  const ctrl = normalizeControlsProps(props);
  const playState = resolvePlayButtonState(status, ctrl.hasTrace, activeIndex, totalSteps);
  const PlayIcon = playState.Icon;

  return (
    <div className="flex shrink-0 flex-col border-t border-default bg-surface-sunken">
      <div
        role="progressbar"
        aria-label="Tiến độ phát trace"
        aria-valuemin={0}
        aria-valuemax={totalSteps}
        aria-valuenow={ctrl.currentStep}
        className="h-1 w-full bg-neutral"
      >
        <div
          className="h-full bg-brand-bold transition-[width] duration-200"
          style={{ width: `${String(ctrl.progressPercent)}%` }}
        />
      </div>

      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip tip={UI_LABELS.prevStep.tip} side="top" align="start">
              <button
                type="button"
                disabled={!ctrl.hasTrace || activeIndex <= 0}
                onClick={onPrev}
                className={STEP_BTN_CLASS}
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{UI_LABELS.prevStep.text}</span>
              </button>
            </Tooltip>

            <Tooltip tip={playState.tip} side="top" align="start">
              <button
                type="button"
                disabled={!ctrl.hasTrace}
                onClick={ctrl.onTogglePlayPause}
                className="inline-flex cursor-pointer items-center gap-1 rounded-medium border border-brand bg-brand-subtlest-hovered px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand-subtlest-hovered disabled:cursor-not-allowed disabled:opacity-40"
              >
                <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{playState.label}</span>
              </button>
            </Tooltip>

            <Tooltip tip={UI_LABELS.nextStep.tip} side="top">
              <button
                type="button"
                disabled={!ctrl.hasTrace || activeIndex >= totalSteps - 1}
                onClick={onNext}
                className={STEP_BTN_CLASS}
              >
                <span>{UI_LABELS.nextStep.text}</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </Tooltip>

            <span className="ml-1 text-xs font-medium text-subtle">
              {ctrl.hasTrace
                ? `Bước ${ctrl.currentStep} / ${totalSteps}`
                : 'Chưa có trace thực thi'}
            </span>
          </div>

          <TraceSpeedSwitch speed={ctrl.speed} onChange={ctrl.onChangeSpeed} />
        </div>

        {ctrl.hasTrace && ctrl.steps.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="hidden items-center gap-1 text-xs text-subtle sm:inline-flex">
              <kbd className={KEYCAP_CLASS}>←</kbd>
              <kbd className={KEYCAP_CLASS}>→</kbd>
              <span>bước ·</span>
              <kbd className={KEYCAP_CLASS}>Space</kbd>
              <span>phát/dừng</span>
            </span>
            <TraceStepPills
              steps={ctrl.steps}
              activeIndex={activeIndex}
              onJumpToStep={ctrl.onJumpToStep}
            />
          </div>
        )}

        {safetyPattern && (
          <div className="flex items-start gap-2 rounded-large border border-success-subtle bg-success px-3 py-2 text-xs text-success-bolder">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden="true" />
            <p className="leading-relaxed">
              <strong className="font-semibold text-success">Safety Pattern: </strong>
              {safetyPattern}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
