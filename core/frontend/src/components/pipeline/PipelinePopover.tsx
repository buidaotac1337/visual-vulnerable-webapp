import { useLayoutEffect, useState } from 'react';
import type { JSX, RefObject } from 'react';
import { createPortal } from 'react-dom';

import type { PipelineWireDetailMode, PipelineWireKey, PipelineWirePayload } from '@/types';

import { POPOVER_DOT_CLASSES } from './pipelineStyles';
import type { PopoverTarget } from './usePipelinePopover';

const VIEWPORT_PAD_PX = 8;
const ANCHOR_GAP_PX = 6;

interface PipelinePopoverProps {
  target: PopoverTarget | null;
  wirePayloads: Record<PipelineWireKey, PipelineWirePayload>;
  activeIndex: number;
  wireDetailMode: PipelineWireDetailMode;
  popoverRef: RefObject<HTMLDivElement | null>;
  onChangeWireDetailMode: (mode: PipelineWireDetailMode) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocusOut: (relatedTarget: EventTarget | null) => void;
}

interface Coords {
  left: number;
  top: number;
}

function formatWireFootNote(stepIndex: number | null, activeIndex: number): string {
  if (stepIndex === null) {
    return 'Chặng này không ghi dữ liệu trong lượt chạy hiện tại.';
  }
  const stepNum = String(stepIndex + 1);
  if (stepIndex <= activeIndex) {
    return `Liên quan Bước ${stepNum} · Bấm vào mũi tên để nhảy tới bước này.`;
  }
  return `Sẽ chạy ở Bước ${stepNum} · Bấm vào mũi tên để nhảy thẳng tới.`;
}

function computeAnchoredCoords(anchorEl: HTMLElement, popEl: HTMLElement): Coords {
  const rect = anchorEl.getBoundingClientRect();
  const popRect = popEl.getBoundingClientRect();
  let left = rect.left;
  if (left + popRect.width > window.innerWidth - VIEWPORT_PAD_PX) {
    left = window.innerWidth - popRect.width - VIEWPORT_PAD_PX;
  }
  left = Math.max(VIEWPORT_PAD_PX, left);

  let top = rect.bottom + ANCHOR_GAP_PX;
  if (top + popRect.height > window.innerHeight - VIEWPORT_PAD_PX) {
    top = Math.max(VIEWPORT_PAD_PX, rect.top - popRect.height - ANCHOR_GAP_PX);
  }
  return { left: Math.round(left), top: Math.round(top) };
}

function clampCoords(prev: Coords, popEl: HTMLElement): Coords {
  const popRect = popEl.getBoundingClientRect();
  let nextLeft = prev.left;
  let nextTop = prev.top;
  if (popRect.right > window.innerWidth - VIEWPORT_PAD_PX) {
    nextLeft = Math.max(
      VIEWPORT_PAD_PX,
      Math.round(window.innerWidth - popRect.width - VIEWPORT_PAD_PX),
    );
  }
  if (popRect.bottom > window.innerHeight - VIEWPORT_PAD_PX) {
    nextTop = Math.max(
      VIEWPORT_PAD_PX,
      Math.round(window.innerHeight - popRect.height - VIEWPORT_PAD_PX),
    );
  }
  return nextLeft === prev.left && nextTop === prev.top ? prev : { left: nextLeft, top: nextTop };
}

interface WirePopoverBodyProps {
  payload: PipelineWirePayload;
  activeIndex: number;
  wireDetailMode: PipelineWireDetailMode;
  onChangeMode: (mode: PipelineWireDetailMode) => void;
}

function WirePopoverBody({
  payload,
  activeIndex,
  wireDetailMode,
  onChangeMode,
}: WirePopoverBodyProps): JSX.Element {
  const isFull = wireDetailMode === 'full';
  const bodyText = isFull ? payload.full : payload.compact;

  return (
    <>
      <div className="flex items-center justify-between gap-2.5 text-body-small font-semibold text-subtle">
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${POPOVER_DOT_CLASSES[payload.status]}`}
            aria-hidden="true"
          />
          <span className="truncate">{payload.label}</span>
        </span>
        <div
          role="radiogroup"
          aria-label="Chế độ xem gói tin mũi tên"
          className="inline-flex shrink-0 items-center gap-0.5 rounded-medium border border-default bg-neutral p-0.5"
        >
          <button
            type="button"
            role="radio"
            aria-checked={!isFull}
            onClick={(event) => {
              event.stopPropagation();
              onChangeMode('compact');
            }}
            className={`cursor-pointer rounded-small px-1.5 py-0.5 text-micro transition-colors ${
              !isFull
                ? 'bg-neutral-bold font-semibold text-inverse'
                : 'font-medium text-subtle hover:text-default'
            }`}
          >
            Thu gọn
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={isFull}
            onClick={(event) => {
              event.stopPropagation();
              onChangeMode('full');
            }}
            className={`cursor-pointer rounded-small px-1.5 py-0.5 text-micro transition-colors ${
              isFull
                ? 'bg-neutral-bold font-semibold text-inverse'
                : 'font-medium text-subtle hover:text-default'
            }`}
          >
            Đầy đủ
          </button>
        </div>
      </div>

      <p className="m-0 max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-default font-mono">
        {bodyText}
      </p>

      <div className="text-micro text-subtle">
        {formatWireFootNote(payload.stepIndex, activeIndex)}
      </div>
    </>
  );
}

function targetIdentityKey(target: PopoverTarget | null): string {
  if (!target) {
    return '';
  }
  return target.kind === 'wire'
    ? `wire:${target.wireKey}`
    : `text:${target.heading}:${target.body}`;
}

/**
 * Render FlowPipeline's hoverable portal popover for both directional wire payloads
 * (with fixed width and Thu gọn / Đầy đủ switch) and truncated detail text.
 *
 * @param props - Active target, wire payloads, detail mode, and pointer/focus handlers.
 * @returns Portal-mounted popover element, or null when closed.
 */
export function PipelinePopover({
  target,
  wirePayloads,
  activeIndex,
  wireDetailMode,
  popoverRef,
  onChangeWireDetailMode,
  onMouseEnter,
  onMouseLeave,
  onFocusOut,
}: PipelinePopoverProps): JSX.Element | null {
  const [coords, setCoords] = useState<Coords>({ left: VIEWPORT_PAD_PX, top: VIEWPORT_PAD_PX });
  const anchorEl = target?.anchorEl ?? null;
  const targetIdentity = targetIdentityKey(target);

  useLayoutEffect(() => {
    const popEl = popoverRef.current;
    if (anchorEl && popEl) {
      setCoords(computeAnchoredCoords(anchorEl, popEl));
    }
  }, [anchorEl, targetIdentity, popoverRef]);

  useLayoutEffect(() => {
    const popEl = popoverRef.current;
    if (target?.kind === 'wire' && popEl) {
      setCoords((prev) => clampCoords(prev, popEl));
    }
  }, [wireDetailMode, target, popoverRef]);

  if (!target || typeof document === 'undefined') {
    return null;
  }

  const isWire = target.kind === 'wire';
  const widthClass = isWire
    ? 'w-[min(480px,calc(100vw-16px))]'
    : 'max-w-[min(520px,calc(100vw-16px))]';

  return createPortal(
    <div
      ref={popoverRef}
      // Packet code reads like the Inspector: the popover is always a dark surface (ADR-0012).
      data-color-mode="dark"
      role={isWire ? 'dialog' : 'tooltip'}
      aria-label={isWire ? wirePayloads[target.wireKey].label : target.heading}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onBlur={(event) => onFocusOut(event.relatedTarget)}
      style={{ left: `${String(coords.left)}px`, top: `${String(coords.top)}px` }}
      className={`pointer-events-auto fixed z-[60] flex flex-col gap-1.5 rounded-large border border-default bg-surface px-3 py-2.5 text-default shadow-overlay ${widthClass}`}
    >
      {isWire ? (
        <WirePopoverBody
          payload={wirePayloads[target.wireKey]}
          activeIndex={activeIndex}
          wireDetailMode={wireDetailMode}
          onChangeMode={onChangeWireDetailMode}
        />
      ) : (
        <>
          <div className="text-body-small font-semibold text-subtle">{target.heading}</div>
          <p
            className={`m-0 max-h-64 overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-default ${
              target.isCode ? 'font-mono' : ''
            }`}
          >
            {target.body}
          </p>
        </>
      )}
    </div>,
    document.body,
  );
}
