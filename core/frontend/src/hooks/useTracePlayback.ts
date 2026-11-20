import { useCallback, useEffect, useState } from 'react';

import { findFirstStepIndexForLayer } from '@/lib';
import type { PlaybackStatus, TraceLayer, TraceStep } from '@/types';

/** Default step-by-step live trace animation cadence (ms) per docs/02-trace-and-snippet-spec.md. */
const TRACE_STEP_INTERVAL_MS = 600;

/** Public state and controls returned by useTracePlayback. */
export interface TracePlaybackController {
  trace: readonly TraceStep[];
  activeIndex: number;
  activeStep: TraceStep | null;
  status: PlaybackStatus;
  startTrace: (steps: readonly TraceStep[]) => void;
  clearTrace: () => void;
  replay: () => void;
  prevStep: () => void;
  nextStep: () => void;
  jumpToLayer: (layer: TraceLayer) => void;
}

/**
 * Manage live execution trace step-by-step playback (600ms/step), replay, and node jumps.
 *
 * @param intervalMs - Optional step duration override (defaults to 600ms).
 * @returns TracePlaybackController state and action callbacks.
 */
export function useTracePlayback(intervalMs = TRACE_STEP_INTERVAL_MS): TracePlaybackController {
  const [trace, setTrace] = useState<readonly TraceStep[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [status, setStatus] = useState<PlaybackStatus>('idle');

  useEffect(() => {
    if (status !== 'playing' || trace.length === 0) {
      return undefined;
    }
    if (activeIndex >= trace.length - 1) {
      setStatus('completed');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      const next = activeIndex + 1;
      if (next >= trace.length - 1) {
        setActiveIndex(trace.length - 1);
        setStatus('completed');
        return;
      }
      setActiveIndex(next);
    }, intervalMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [status, activeIndex, trace.length, intervalMs]);

  const startTrace = useCallback((steps: readonly TraceStep[]): void => {
    setTrace(steps);
    if (steps.length === 0) {
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }
    setActiveIndex(0);
    setStatus(steps.length === 1 ? 'completed' : 'playing');
  }, []);

  const clearTrace = useCallback((): void => {
    setTrace([]);
    setActiveIndex(-1);
    setStatus('idle');
  }, []);

  const replay = useCallback((): void => {
    if (trace.length === 0) {
      return;
    }
    setActiveIndex(0);
    setStatus(trace.length === 1 ? 'completed' : 'playing');
  }, [trace.length]);

  const prevStep = useCallback((): void => {
    if (trace.length === 0) {
      return;
    }
    setStatus('paused');
    setActiveIndex((prev) => Math.max(0, prev - 1));
  }, [trace.length]);

  const nextStep = useCallback((): void => {
    if (trace.length === 0) {
      return;
    }
    setStatus('paused');
    setActiveIndex((prev) => Math.min(trace.length - 1, prev + 1));
  }, [trace.length]);

  const jumpToLayer = useCallback(
    (layer: TraceLayer): void => {
      const targetIndex = findFirstStepIndexForLayer(trace, layer);
      if (targetIndex < 0) {
        return;
      }
      setStatus('paused');
      setActiveIndex(targetIndex);
    },
    [trace],
  );

  const activeStep = activeIndex >= 0 ? (trace[activeIndex] ?? null) : null;

  return {
    trace,
    activeIndex,
    activeStep,
    status,
    startTrace,
    clearTrace,
    replay,
    prevStep,
    nextStep,
    jumpToLayer,
  };
}
