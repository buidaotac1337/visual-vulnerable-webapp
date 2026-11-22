import { useEffect, useRef, useState } from 'react';
import type { JSX, KeyboardEvent, PointerEvent, RefObject } from 'react';

const MIN_SPLIT_PERCENT = 30;
const MAX_SPLIT_PERCENT = 70;
const SPLIT_KEYBOARD_STEP = 5;

interface SplitDividerProps {
  splitPercent: number;
  containerRef: RefObject<HTMLElement | null>;
  onChangeSplit: (nextPercent: number) => void;
  onResetSplit: () => void;
}

function clampSplit(value: number): number {
  return Math.min(MAX_SPLIT_PERCENT, Math.max(MIN_SPLIT_PERCENT, value));
}

function computeSplitPercentFromRect(rect: DOMRect | null, clientX: number): number | null {
  if (!rect || rect.width <= 0 || !Number.isFinite(clientX)) {
    return null;
  }
  const raw = Math.round(((clientX - rect.left) / rect.width) * 100);
  return clampSplit(raw);
}

/**
 * Draggable and keyboard-accessible vertical split handle between MiniShop Sandbox and
 * Code & Trace Inspector in `split` mode on `lg+` viewports.
 *
 * @param props - Current split ratio, container ref for drag bounds, and update/reset handlers.
 * @returns Accessible vertical separator element hidden below `lg`.
 */
export function SplitDivider({
  splitPercent,
  containerRef,
  onChangeSplit,
  onResetSplit,
}: SplitDividerProps): JSX.Element {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const cleanupDragRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cleanupDragRef.current?.(), []);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    event.preventDefault();
    cleanupDragRef.current?.();

    const divider = event.currentTarget;
    const container = containerRef.current ?? divider.parentElement;
    // Measure container once on pointerdown to avoid forced synchronous layout per pointermove.
    const cachedRect = container ? container.getBoundingClientRect() : null;
    let lastEmitted = Math.round(splitPercent);

    try {
      divider.setPointerCapture?.(event.pointerId);
    } catch {
      // JSDOM or synthetic pointer events may omit pointer capture.
    }

    const onPointerMove = (moveEvent: globalThis.PointerEvent): void => {
      const next = computeSplitPercentFromRect(cachedRect, moveEvent.clientX);
      if (next !== null && next !== lastEmitted) {
        lastEmitted = next;
        onChangeSplit(next);
      }
    };

    const stopDrag = (): void => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      cleanupDragRef.current = null;
      setIsDragging(false);
    };

    cleanupDragRef.current = stopDrag;
    setIsDragging(true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        onChangeSplit(clampSplit(splitPercent - SPLIT_KEYBOARD_STEP));
        break;
      case 'ArrowRight':
        event.preventDefault();
        onChangeSplit(clampSplit(splitPercent + SPLIT_KEYBOARD_STEP));
        break;
      case 'Home':
      case 'End':
        event.preventDefault();
        onResetSplit();
        break;
      default:
        break;
    }
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Điều chỉnh tỷ lệ chiều rộng hai cột"
      aria-valuenow={Math.round(splitPercent)}
      aria-valuemin={MIN_SPLIT_PERCENT}
      aria-valuemax={MAX_SPLIT_PERCENT}
      tabIndex={0}
      onPointerDown={handlePointerDown}
      onDoubleClick={onResetSplit}
      onKeyDown={handleKeyDown}
      className={`group hidden w-1.5 shrink-0 cursor-col-resize select-none items-center justify-center transition-colors focus-visible:bg-brand-500 focus-visible:outline-none lg:flex ${
        isDragging ? 'bg-brand-500' : 'bg-slate-200 hover:bg-brand-400'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-8 w-0.5 rounded-full transition-colors ${
          isDragging ? 'bg-white' : 'bg-slate-400 group-hover:bg-white group-focus-visible:bg-white'
        }`}
      />
    </div>
  );
}
