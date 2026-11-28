import { useLayoutEffect, useRef, useState } from 'react';
import type { JSX } from 'react';

import type { TraceStep } from '@/types';

import {
  PACKET_STRIP_CLASSES,
  PIPELINE_STATUS_LABELS,
  STATUS_PILL_CLASSES,
} from './pipelineStyles';

interface PipelinePacketStripProps {
  step: TraceStep;
  hopRoute: string;
  onOpenText: (anchorEl: HTMLElement, heading: string, body: string, isCode?: boolean) => void;
  onScheduleClose: () => void;
}

/**
 * Render Tier 2 of FlowPipeline: the Live Data Packet Strip showing the active hop route,
 * step title, semantic badge, and single-line truncated detail with hover popover when clipped.
 *
 * @param props - Active trace step, formatted hop route, and popover handlers.
 * @returns Rendered live data packet strip.
 */
export function PipelinePacketStrip({
  step,
  hopRoute,
  onOpenText,
  onScheduleClose,
}: PipelinePacketStripProps): JSX.Element {
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);

  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) {
      return undefined;
    }
    const measure = (): void => {
      setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [step.detail, step.step]);

  const heading = `Bước ${String(step.step)} · ${hopRoute} — ${step.title}`;
  const openFullDetail = (anchorEl: HTMLElement): void => {
    const el = textRef.current;
    if (el && el.scrollWidth > el.clientWidth + 1) {
      onOpenText(anchorEl, heading, step.detail, true);
    }
  };

  return (
    <div
      aria-live="polite"
      className={`mx-3.5 mb-2.5 flex flex-col gap-1.5 rounded-large border px-2.5 py-2 transition-colors ${PACKET_STRIP_CLASSES[step.status]}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold text-default">
          <span className="shrink-0 rounded-small border border-default bg-surface-raised px-1.5 py-0.5 text-micro font-semibold text-subtle font-mono">
            {hopRoute}
          </span>
          <span className="truncate">{step.title}</span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-micro font-bold tracking-wide ${STATUS_PILL_CLASSES[step.status]}`}
        >
          {PIPELINE_STATUS_LABELS[step.status]}
        </span>
      </div>

      <div
        tabIndex={isTruncated ? 0 : undefined}
        onMouseEnter={(event) => openFullDetail(event.currentTarget)}
        onFocus={(event) => openFullDetail(event.currentTarget)}
        onMouseLeave={onScheduleClose}
        onBlur={onScheduleClose}
        className={`flex min-w-0 items-center gap-2 rounded-medium border border-default bg-surface-raised px-2 py-1.5 ${
          isTruncated
            ? 'cursor-help hover:border-brand focus-visible:border-brand focus-visible:outline-none'
            : ''
        }`}
      >
        <p
          ref={textRef}
          className="m-0 min-w-0 flex-1 truncate text-xs leading-snug text-default font-mono"
        >
          {step.detail}
        </p>
        {isTruncated && (
          <span
            aria-hidden="true"
            className="shrink-0 rounded-small border border-brand-subtle bg-brand-subtlest px-1.5 py-0.5 text-micro font-medium leading-none text-brand"
          >
            Rê xem đủ
          </span>
        )}
      </div>
    </div>
  );
}
