import type { JSX } from 'react';
import { Bug, Columns2, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import {
  modeTip,
  toneClasses,
  TRACE_OUTCOME_LABELS,
  TRACE_OUTCOME_TONE,
  UI_LABELS,
  WORKSPACE_MODE_TONE,
} from '@/lib';
import type { ModeOutcomes, TraceOutcome, WorkspaceMode } from '@/types';

import { Tooltip } from '../ui';

interface ModeSwitchProps {
  mode: WorkspaceMode;
  hasFrontendSink?: boolean;
  /** Last outcome per mode, drawn as a dot on the Vulnerable and Secure segments. */
  outcomes?: ModeOutcomes;
  onChange: (nextMode: WorkspaceMode) => void;
}

interface SegmentSpec {
  id: WorkspaceMode;
  icon: LucideIcon;
}

const SEGMENTS: readonly SegmentSpec[] = [
  { id: 'vulnerable', icon: Bug },
  { id: 'secure', icon: ShieldCheck },
  { id: 'compare', icon: Columns2 },
];

/** Active segment colours come from the mode's tone (lib/tones.ts, ADR-0012). */
function activeClass(id: WorkspaceMode): string {
  const tone = toneClasses(WORKSPACE_MODE_TONE[id]);
  return `${tone.border} ${tone.bg} ${tone.text}`;
}

function segmentText(id: WorkspaceMode): string {
  return id === 'compare' ? UI_LABELS.compare.text : UI_LABELS[id].text;
}

function segmentTip(id: WorkspaceMode, hasFrontendSink: boolean): string {
  return id === 'compare' ? UI_LABELS.compare.tip : modeTip(id, hasFrontendSink);
}

function OutcomeDot({ outcome }: { outcome: TraceOutcome | undefined }): JSX.Element | null {
  if (!outcome) {
    return null;
  }
  return (
    <>
      <span
        data-testid="mode-outcome-dot"
        data-outcome={outcome}
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${toneClasses(TRACE_OUTCOME_TONE[outcome]).bgBold}`}
        aria-hidden="true"
      />
      <span className="sr-only">(lần chạy gần nhất: {TRACE_OUTCOME_LABELS[outcome]})</span>
    </>
  );
}

/**
 * Render the `Vulnerable · Secure · Song song` segmented control with semantic tokens;
 * the two single-mode segments carry a dot with the last outcome seen in that mode.
 *
 * @param props - Active workspace mode, sink flag, last outcomes, and change callback.
 * @returns Accessible radiogroup segmented control element.
 */
export function ModeSwitch({
  mode,
  hasFrontendSink = false,
  outcomes = {},
  onChange,
}: ModeSwitchProps): JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="Chế độ thực thi bài lab"
      className="inline-flex items-center rounded-large border border-default bg-neutral p-0.5"
    >
      {SEGMENTS.map(({ id, icon: Icon }) => {
        const isActive = mode === id;
        return (
          <Tooltip key={id} tip={segmentTip(id, hasFrontendSink)}>
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onChange(id)}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-medium border px-2.5 py-1 text-xs font-semibold transition-colors duration-150 ${
                isActive
                  ? `${activeClass(id)} shadow-raised`
                  : 'border-transparent bg-transparent text-subtle hover:text-default'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only xl:not-sr-only">{segmentText(id)}</span>
              {id !== 'compare' && <OutcomeDot outcome={outcomes[id]} />}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
