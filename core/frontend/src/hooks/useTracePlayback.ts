import { useCallback, useEffect, useRef, useState } from 'react';

import { findNextStepIndexForLayer } from '@/lib';
import type { PlaybackStatus, TraceLayer, TracePlaybackSpeed, TraceStep } from '@/types';

import { readStorage, writeStorage } from './storage';

/** Default step-by-step live trace animation cadence (ms) per docs/user-guide.md. */
const TRACE_STEP_INTERVAL_MS = 600;
const TRACE_SPEED_STORAGE_KEY = 'vvwa.traceSpeed';
const DEFAULT_SPEED: TracePlaybackSpeed = '1x';

/** Public state and controls returned by useTracePlayback. */
export interface TracePlaybackController {
  trace: readonly TraceStep[];
  activeIndex: number;
  activeStep: TraceStep | null;
  status: PlaybackStatus;
  speed: TracePlaybackSpeed;
  startTrace: (steps: readonly TraceStep[]) => void;
  clearTrace: () => void;
  replay: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  setSpeed: (nextSpeed: TracePlaybackSpeed) => void;
  prevStep: () => void;
  nextStep: () => void;
  jumpToStep: (index: number) => void;
  jumpToLayer: (layer: TraceLayer) => void;
}

function isTracePlaybackSpeed(value: string | null): value is TracePlaybackSpeed {
  return value === 'manual' || value === '0.5x' || value === '1x' || value === '2x';
}

function loadInitialTraceSpeed(): TracePlaybackSpeed {
  const stored = readStorage(TRACE_SPEED_STORAGE_KEY);
  return isTracePlaybackSpeed(stored) ? stored : DEFAULT_SPEED;
}

function resolveStepDelayMs(speed: TracePlaybackSpeed, intervalMs: number): number | null {
  switch (speed) {
    case 'manual':
      return null;
    case '0.5x':
      return intervalMs * 2;
    case '1x':
      return intervalMs;
    case '2x':
      return Math.round(intervalMs * 0.5);
  }
}

/**
 * Manage live execution trace step-by-step playback, speed persistence, pause/resume,
 * replay, step scrubbing, and pipeline layer jumps.
 *
 * @param intervalMs - Optional baseline step duration override at `1x` (defaults to 600ms).
 * @returns TracePlaybackController state and action callbacks.
 */
export function useTracePlayback(intervalMs = TRACE_STEP_INTERVAL_MS): TracePlaybackController {
  const [trace, setTrace] = useState<readonly TraceStep[]>([]);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [status, setStatus] = useState<PlaybackStatus>('idle');
  const [speed, setSpeedState] = useState<TracePlaybackSpeed>(loadInitialTraceSpeed);
  const speedRef = useRef<TracePlaybackSpeed>(speed);
  speedRef.current = speed;

  const stepDelayMs = resolveStepDelayMs(speed, intervalMs);

  useEffect(() => {
    if (status !== 'playing' || trace.length === 0 || stepDelayMs === null) {
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
    }, stepDelayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, [status, activeIndex, trace.length, stepDelayMs]);

  const persistSpeed = useCallback((nextSpeed: TracePlaybackSpeed): void => {
    speedRef.current = nextSpeed;
    setSpeedState(nextSpeed);
    writeStorage(TRACE_SPEED_STORAGE_KEY, nextSpeed);
  }, []);

  const setSpeed = useCallback(
    (nextSpeed: TracePlaybackSpeed): void => {
      persistSpeed(nextSpeed);
      if (nextSpeed === 'manual') {
        setStatus((prev) => (prev === 'playing' ? 'paused' : prev));
      }
    },
    [persistSpeed],
  );

  const startTrace = useCallback((steps: readonly TraceStep[]): void => {
    setTrace(steps);
    if (steps.length === 0) {
      setActiveIndex(-1);
      setStatus('idle');
      return;
    }
    setActiveIndex(0);
    if (steps.length === 1) {
      setStatus('completed');
      return;
    }
    setStatus(speedRef.current === 'manual' ? 'paused' : 'playing');
  }, []);

  const clearTrace = useCallback((): void => {
    setTrace([]);
    setActiveIndex(-1);
    setStatus('idle');
  }, []);

  const pause = useCallback((): void => {
    setStatus((prev) => (prev === 'playing' ? 'paused' : prev));
  }, []);

  const replay = useCallback((): void => {
    if (trace.length === 0) {
      return;
    }
    if (speedRef.current === 'manual') {
      persistSpeed('1x');
    }
    setActiveIndex(0);
    setStatus(trace.length === 1 ? 'completed' : 'playing');
  }, [trace.length, persistSpeed]);

  const togglePlayPause = useCallback((): void => {
    if (trace.length === 0) {
      return;
    }
    if (status === 'playing') {
      setStatus('paused');
      return;
    }
    if (speedRef.current === 'manual') {
      persistSpeed('1x');
    }
    if (status === 'completed' || activeIndex >= trace.length - 1) {
      setActiveIndex(0);
      setStatus(trace.length === 1 ? 'completed' : 'playing');
      return;
    }
    setStatus('playing');
  }, [trace.length, status, activeIndex, persistSpeed]);

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

  const jumpToStep = useCallback(
    (index: number): void => {
      if (trace.length === 0 || !Number.isFinite(index)) {
        return;
      }
      const clamped = Math.min(trace.length - 1, Math.max(0, Math.trunc(index)));
      setStatus('paused');
      setActiveIndex(clamped);
    },
    [trace.length],
  );

  const jumpToLayer = useCallback(
    (layer: TraceLayer): void => {
      const targetIndex = findNextStepIndexForLayer(trace, layer, activeIndex);
      if (targetIndex < 0) {
        return;
      }
      setStatus('paused');
      setActiveIndex(targetIndex);
    },
    [trace, activeIndex],
  );

  const activeStep = activeIndex >= 0 ? (trace[activeIndex] ?? null) : null;

  return {
    trace,
    activeIndex,
    activeStep,
    status,
    speed,
    startTrace,
    clearTrace,
    replay,
    pause,
    togglePlayPause,
    setSpeed,
    prevStep,
    nextStep,
    jumpToStep,
    jumpToLayer,
  };
}
