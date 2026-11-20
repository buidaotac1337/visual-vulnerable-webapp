import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useTracePlayback } from '@/hooks';
import type { TraceStep } from '@/types';

const SAMPLE_TRACE: TraceStep[] = [
  { step: 1, layer: 'frontend', tag: 'fe', status: 'info', title: 'Step 1', detail: 'd1' },
  { step: 2, layer: 'backend', tag: 'be', status: 'danger', title: 'Step 2', detail: 'd2' },
  { step: 3, layer: 'database', tag: 'db', status: 'danger', title: 'Step 3', detail: 'd3' },
];

describe('useTracePlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('advances every 600ms and supports pause, prev, next, replay, and jumpToLayer', () => {
    const { result } = renderHook(() => useTracePlayback(600));

    act(() => {
      result.current.startTrace(SAMPLE_TRACE);
    });
    expect(result.current.status).toBe('playing');
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.activeIndex).toBe(1);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.status).toBe('completed');

    act(() => {
      result.current.prevStep();
    });
    expect(result.current.activeIndex).toBe(1);
    expect(result.current.status).toBe('paused');

    act(() => {
      result.current.nextStep();
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.jumpToLayer('frontend');
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('paused');

    act(() => {
      result.current.replay();
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('playing');
  });
});
