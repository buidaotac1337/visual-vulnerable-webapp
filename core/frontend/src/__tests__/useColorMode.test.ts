import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COLOR_MODE_STORAGE_KEY, resolveColorMode, useColorMode } from '@/hooks';

type ChangeListener = (event: MediaQueryListEvent) => void;

function stubSystemScheme(prefersDark: boolean): { emit: (dark: boolean) => void } {
  let listener: ChangeListener | null = null;
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: prefersDark,
      addEventListener: (_type: string, next: ChangeListener) => {
        listener = next;
      },
      removeEventListener: () => {
        listener = null;
      },
    })),
  );
  return {
    emit: (dark: boolean) => listener?.({ matches: dark } as MediaQueryListEvent),
  };
}

describe('useColorMode (ADR-0012)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-color-mode');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves auto from the system scheme and keeps explicit choices', () => {
    expect(resolveColorMode('auto', true)).toBe('dark');
    expect(resolveColorMode('auto', false)).toBe('light');
    expect(resolveColorMode('dark', false)).toBe('dark');
    expect(resolveColorMode('light', true)).toBe('light');
  });

  it('defaults to the system scheme, applies data-color-mode, and persists a new preference', () => {
    stubSystemScheme(true);
    const { result } = renderHook(() => useColorMode());

    expect(result.current.preference).toBe('auto');
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');

    act(() => result.current.setPreference('light'));

    expect(result.current.resolved).toBe('light');
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('light');
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('light');
  });

  it('follows system changes while the preference is auto and ignores invalid storage', () => {
    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'auto');
    const system = stubSystemScheme(false);
    const { result } = renderHook(() => useColorMode());
    expect(result.current.resolved).toBe('light');

    act(() => system.emit(true));
    expect(result.current.resolved).toBe('dark');
    expect(document.documentElement.getAttribute('data-color-mode')).toBe('dark');

    window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, 'sepia');
    const { result: fresh } = renderHook(() => useColorMode());
    expect(fresh.current.preference).toBe('auto');
  });
});
