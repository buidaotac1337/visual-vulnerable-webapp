import type { JSX } from 'react';

import { formatHopRoute } from '@/lib';
import type { TraceStep } from '@/types';

import { JOURNEY_ACTIVE_CLASSES, SOLID_DOT_CLASSES } from './pipelineStyles';

interface PipelineJourneyListProps {
  trace: readonly TraceStep[];
  activeIndex: number;
  isOpen: boolean;
  onToggle: () => void;
  onSelectStep: (index: number) => void;
  onOpenText: (anchorEl: HTMLElement, heading: string, body: string, isCode?: boolean) => void;
  onScheduleClose: () => void;
}

interface JourneyRowProps {
  step: TraceStep;
  prevStep: TraceStep | null;
  index: number;
  activeIndex: number;
  onSelectStep: (index: number) => void;
  onOpenText: (anchorEl: HTMLElement, heading: string, body: string, isCode?: boolean) => void;
  onScheduleClose: () => void;
}

function JourneyRow({
  step,
  prevStep,
  index,
  activeIndex,
  onSelectStep,
  onOpenText,
  onScheduleClose,
}: JourneyRowProps): JSX.Element {
  const isActive = index === activeIndex;
  const isSeen = index < activeIndex;
  const hopLabel = formatHopRoute(prevStep, step);
  const stepNum = String(step.step).padStart(2, '0');
  const heading = `Bước ${String(step.step)} · ${hopLabel} — ${step.title}`;
  const dotClass = isActive || isSeen ? SOLID_DOT_CLASSES[step.status] : 'bg-neutral-pressed';
  const rowClass = isActive
    ? JOURNEY_ACTIVE_CLASSES[step.status]
    : 'border-transparent border-l-transparent hover:bg-neutral-subtle-hovered';

  return (
    <li>
      <button
        type="button"
        aria-current={isActive ? 'step' : undefined}
        onClick={() => onSelectStep(index)}
        className={`grid w-full cursor-pointer grid-cols-[42px_minmax(0,1fr)] items-start gap-2 rounded-large border border-l-[3px] px-2 py-1.5 text-left transition-colors ${rowClass}`}
      >
        <span className="flex items-center gap-1.5 pt-0.5 text-micro font-semibold text-subtlest font-mono">
          <span>{stepNum}</span>
          <span
            className={`h-[7px] w-[7px] shrink-0 rounded-full ${dotClass}`}
            aria-hidden="true"
          />
        </span>

        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-micro font-semibold text-subtle font-mono">{hopLabel}</span>
            <span
              className={`text-xs ${
                isActive || isSeen ? 'font-semibold text-default' : 'font-medium text-subtlest'
              }`}
            >
              {step.title}
            </span>
          </span>

          <span
            onMouseEnter={(event) => {
              const target = event.currentTarget;
              if (target.scrollWidth > target.clientWidth + 1) {
                onOpenText(target, heading, step.detail, true);
              }
            }}
            onMouseLeave={onScheduleClose}
            className={`block truncate text-body-small ${isActive ? 'text-default' : 'text-subtle'} font-mono`}
          >
            {step.detail}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * Render Tier 3 of FlowPipeline: an expandable chronological Full Data Journey timeline
 * collapsed by default to keep Sandbox forms compact, with click-to-jump and hover detail.
 *
 * @param props - Trace steps, active index, open state, and selection/popover callbacks.
 * @returns Rendered collapsible journey panel.
 */
export function PipelineJourneyList({
  trace,
  activeIndex,
  isOpen,
  onToggle,
  onSelectStep,
  onOpenText,
  onScheduleClose,
}: PipelineJourneyListProps): JSX.Element {
  return (
    <div className="border-t border-default">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-xs font-semibold text-subtle transition-colors hover:bg-neutral-subtle-hovered hover:text-default"
      >
        <span>Hành trình dữ liệu đầy đủ ({String(trace.length)} bước)</span>
        <span className="font-medium text-brand">{isOpen ? 'Ẩn bớt' : 'Mở rộng'}</span>
      </button>

      {isOpen && (
        <div className="border-t border-default bg-surface-sunken px-3.5 py-2.5">
          <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
            {trace.map((step, index) => (
              <JourneyRow
                key={`${String(step.step)}-${step.tag}`}
                step={step}
                prevStep={index > 0 ? (trace[index - 1] ?? null) : null}
                index={index}
                activeIndex={activeIndex}
                onSelectStep={onSelectStep}
                onOpenText={onOpenText}
                onScheduleClose={onScheduleClose}
              />
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
