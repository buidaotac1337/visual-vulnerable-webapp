import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { PipelineWireDetailMode, PipelineWireKey } from '@/types';

const CLOSE_DELAY_MS = 160;

/** Active popover target discriminated union (interactive wire payload vs truncated text). */
export type PopoverTarget =
  | {
      kind: 'wire';
      anchorEl: HTMLElement;
      wireKey: PipelineWireKey;
    }
  | {
      kind: 'text';
      anchorEl: HTMLElement;
      heading: string;
      body: string;
      isCode: boolean;
    };

/** Controller managing FlowPipeline's hoverable portal popover and wire detail mode. */
export interface PipelinePopoverController {
  target: PopoverTarget | null;
  wireDetailMode: PipelineWireDetailMode;
  popoverRef: RefObject<HTMLDivElement | null>;
  setWireDetailMode: (mode: PipelineWireDetailMode) => void;
  openWire: (anchorEl: HTMLElement, wireKey: PipelineWireKey) => void;
  openText: (anchorEl: HTMLElement, heading: string, body: string, isCode?: boolean) => void;
  scheduleClose: () => void;
  cancelClose: () => void;
  closeNow: () => void;
  onPopoverEnter: () => void;
  onPopoverLeave: () => void;
  onAnchorBlur: (relatedTarget: EventTarget | null) => void;
  onPopoverFocusOut: (relatedTarget: EventTarget | null) => void;
}

/**
 * Manage hover/focus/blur/Escape lifecycle and compact/full preference for the FlowPipeline
 * portal popover without losing focus or closing prematurely during auto-play.
 *
 * @param resetKey - Context key (lab + mode) that closes stale popovers when changed.
 * @returns PipelinePopoverController consumed by FlowPipeline subcomponents.
 */
export function usePipelinePopover(resetKey: string): PipelinePopoverController {
  const [target, setTarget] = useState<PopoverTarget | null>(null);
  const [wireDetailMode, setWireDetailModeState] = useState<PipelineWireDetailMode>('compact');
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const hoveringPopoverRef = useRef<boolean>(false);
  const anchorRef = useRef<HTMLElement | null>(null);

  const cancelClose = useCallback((): void => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const closeNow = useCallback((): void => {
    cancelClose();
    hoveringPopoverRef.current = false;
    anchorRef.current = null;
    setTarget(null);
  }, [cancelClose]);

  const scheduleClose = useCallback((): void => {
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      const pop = popoverRef.current;
      const isHovered = hoveringPopoverRef.current || Boolean(pop && pop.matches(':hover'));
      if (!isHovered) {
        anchorRef.current = null;
        setTarget(null);
      }
    }, CLOSE_DELAY_MS);
  }, [cancelClose]);

  const openWire = useCallback(
    (anchorEl: HTMLElement, wireKey: PipelineWireKey): void => {
      cancelClose();
      anchorRef.current = anchorEl;
      setTarget({ kind: 'wire', anchorEl, wireKey });
    },
    [cancelClose],
  );

  const openText = useCallback(
    (anchorEl: HTMLElement, heading: string, body: string, isCode = true): void => {
      cancelClose();
      anchorRef.current = anchorEl;
      setTarget({ kind: 'text', anchorEl, heading, body, isCode });
    },
    [cancelClose],
  );

  const setWireDetailMode = useCallback(
    (mode: PipelineWireDetailMode): void => {
      cancelClose();
      setWireDetailModeState(mode);
    },
    [cancelClose],
  );

  const onPopoverEnter = useCallback((): void => {
    hoveringPopoverRef.current = true;
    cancelClose();
  }, [cancelClose]);

  const onPopoverLeave = useCallback((): void => {
    hoveringPopoverRef.current = false;
    scheduleClose();
  }, [scheduleClose]);

  const onAnchorBlur = useCallback(
    (relatedTarget: EventTarget | null): void => {
      const pop = popoverRef.current;
      if (pop && relatedTarget instanceof Node && pop.contains(relatedTarget)) {
        return;
      }
      scheduleClose();
    },
    [scheduleClose],
  );

  const onPopoverFocusOut = useCallback(
    (relatedTarget: EventTarget | null): void => {
      if (hoveringPopoverRef.current) {
        return;
      }
      const pop = popoverRef.current;
      const movedInside = relatedTarget instanceof Node && Boolean(pop?.contains(relatedTarget));
      const movedToAnchor = relatedTarget !== null && relatedTarget === anchorRef.current;
      if (!movedInside && !movedToAnchor) {
        scheduleClose();
      }
    },
    [scheduleClose],
  );

  useEffect(() => {
    closeNow();
  }, [resetKey, closeNow]);

  useEffect(() => {
    if (!target) {
      return undefined;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        closeNow();
      }
    };
    const onResize = (): void => closeNow();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
    };
  }, [target, closeNow]);

  useEffect(() => cancelClose, [cancelClose]);

  return {
    target,
    wireDetailMode,
    popoverRef,
    setWireDetailMode,
    openWire,
    openText,
    scheduleClose,
    cancelClose,
    closeNow,
    onPopoverEnter,
    onPopoverLeave,
    onAnchorBlur,
    onPopoverFocusOut,
  };
}
