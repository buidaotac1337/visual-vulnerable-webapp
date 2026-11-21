import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWorkspaceLayout } from '@/hooks';

describe('useWorkspaceLayout', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('defaults, clamps splitPercent to 30..70, and resets collapsed state on floating', () => {
    const { result } = renderHook(() => useWorkspaceLayout());
    expect(result.current.layoutMode).toBe('split');
    expect(result.current.splitPercent).toBe(50);
    expect(result.current.isFloatingCollapsed).toBe(false);

    act(() => result.current.setSplitPercent(15));
    expect(result.current.splitPercent).toBe(30);
    expect(window.localStorage.getItem('vvwa.splitPercent')).toBe('30');

    act(() => result.current.setSplitPercent(92));
    expect(result.current.splitPercent).toBe(70);
    act(() => result.current.resetSplit());
    expect(result.current.splitPercent).toBe(50);

    act(() => result.current.setLayoutMode('floating'));
    act(() => result.current.toggleFloatingCollapsed());
    expect(result.current.isFloatingCollapsed).toBe(true);

    act(() => result.current.setLayoutMode('code-focus'));
    expect(window.localStorage.getItem('vvwa.layoutMode')).toBe('code-focus');
    act(() => result.current.setLayoutMode('floating'));
    expect(result.current.isFloatingCollapsed).toBe(false);
  });

  it('validates stored values and falls back cleanly when localStorage throws', () => {
    window.localStorage.setItem('vvwa.layoutMode', 'invalid-mode');
    window.localStorage.setItem('vvwa.splitPercent', 'not-a-number');
    const first = renderHook(() => useWorkspaceLayout());
    expect(first.result.current.layoutMode).toBe('split');
    expect(first.result.current.splitPercent).toBe(50);

    window.localStorage.setItem('vvwa.layoutMode', 'floating');
    window.localStorage.setItem('vvwa.splitPercent', '85');
    const second = renderHook(() => useWorkspaceLayout());
    expect(second.result.current.layoutMode).toBe('floating');
    expect(second.result.current.splitPercent).toBe(70);

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const fallback = renderHook(() => useWorkspaceLayout());
    expect(fallback.result.current.layoutMode).toBe('split');
    expect(fallback.result.current.splitPercent).toBe(50);
    act(() => fallback.result.current.setLayoutMode('code-focus'));
    expect(fallback.result.current.layoutMode).toBe('code-focus');
  });
});
