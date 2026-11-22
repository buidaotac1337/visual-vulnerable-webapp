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
    window.localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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

  it('supports 0.5x (1200ms) and 2x (300ms) playback speeds', () => {
    const { result } = renderHook(() => useTracePlayback(600));

    act(() => {
      result.current.setSpeed('0.5x');
      result.current.startTrace(SAMPLE_TRACE);
    });
    expect(window.localStorage.getItem('vvwa.traceSpeed')).toBe('0.5x');

    act(() => vi.advanceTimersByTime(600));
    expect(result.current.activeIndex).toBe(0);

    act(() => vi.advanceTimersByTime(600));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.setSpeed('2x'));
    expect(window.localStorage.getItem('vvwa.traceSpeed')).toBe('2x');

    act(() => vi.advanceTimersByTime(300));
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.status).toBe('completed');
  });

  it('pauses on step 1 in manual mode and pauses active playback when switching to manual', () => {
    const { result } = renderHook(() => useTracePlayback(600));

    act(() => {
      result.current.setSpeed('manual');
      result.current.startTrace(SAMPLE_TRACE);
    });
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('paused');

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('paused');

    act(() => result.current.startTrace([SAMPLE_TRACE[0] as TraceStep]));
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('completed');

    act(() => {
      result.current.setSpeed('1x');
      result.current.startTrace(SAMPLE_TRACE);
    });
    expect(result.current.status).toBe('playing');

    act(() => result.current.setSpeed('manual'));
    expect(result.current.status).toBe('paused');
    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.activeIndex).toBe(0);
  });

  it('toggles play/pause cleanly across playing, paused, completed, and manual states', () => {
    const { result } = renderHook(() => useTracePlayback(600));

    act(() => result.current.togglePlayPause());
    expect(result.current.status).toBe('idle');

    act(() => result.current.startTrace(SAMPLE_TRACE));
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.togglePlayPause());
    expect(result.current.status).toBe('paused');
    act(() => vi.advanceTimersByTime(1200));
    expect(result.current.activeIndex).toBe(1);

    act(() => result.current.togglePlayPause());
    expect(result.current.status).toBe('playing');
    act(() => vi.advanceTimersByTime(600));
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.status).toBe('completed');

    act(() => result.current.togglePlayPause());
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('playing');

    act(() => result.current.setSpeed('manual'));
    expect(result.current.status).toBe('paused');
    act(() => result.current.togglePlayPause());
    expect(result.current.speed).toBe('1x');
    expect(window.localStorage.getItem('vvwa.traceSpeed')).toBe('1x');
    expect(result.current.status).toBe('playing');

    act(() => result.current.pause());
    expect(result.current.status).toBe('paused');
    act(() => result.current.jumpToStep(2));
    act(() => result.current.togglePlayPause());
    expect(result.current.activeIndex).toBe(0);
    expect(result.current.status).toBe('playing');
  });

  it('clamps jumpToStep and switches manual mode to 1x on replay', () => {
    const { result } = renderHook(() => useTracePlayback(600));

    act(() => result.current.jumpToStep(1));
    expect(result.current.activeIndex).toBe(-1);

    act(() => {
      result.current.setSpeed('manual');
      result.current.startTrace(SAMPLE_TRACE);
    });
    act(() => result.current.jumpToStep(99));
    expect(result.current.activeIndex).toBe(2);
    expect(result.current.status).toBe('paused');

    act(() => result.current.jumpToStep(-5));
    expect(result.current.activeIndex).toBe(0);

    act(() => result.current.replay());
    expect(result.current.speed).toBe('1x');
    expect(result.current.status).toBe('playing');
  });

  it('validates stored traceSpeed and falls back cleanly when localStorage throws', () => {
    window.localStorage.setItem('vvwa.traceSpeed', 'invalid-speed');
    const invalid = renderHook(() => useTracePlayback());
    expect(invalid.result.current.speed).toBe('1x');

    window.localStorage.setItem('vvwa.traceSpeed', '0.5x');
    const valid = renderHook(() => useTracePlayback());
    expect(valid.result.current.speed).toBe('0.5x');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const fallback = renderHook(() => useTracePlayback());
    expect(fallback.result.current.speed).toBe('1x');
    act(() => fallback.result.current.setSpeed('2x'));
    expect(fallback.result.current.speed).toBe('2x');
  });
});
