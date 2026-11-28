import { useCallback, useEffect, useMemo, useState } from 'react';

import { readStorage, writeStorage } from './storage';

/** Colour mode a person picks; `auto` follows the operating system setting. */
export type ColorModePreference = 'light' | 'dark' | 'auto';

/** Colour mode actually applied through the `data-color-mode` attribute. */
export type ResolvedColorMode = 'light' | 'dark';

/** `localStorage` key; the pre-paint script in index.html reads the same key (ADR-0012). */
export const COLOR_MODE_STORAGE_KEY = 'vvwa.colorMode';

/** Preference used until one is saved; index.html's pre-paint script uses the same default. */
export const DEFAULT_COLOR_MODE: ColorModePreference = 'light';

const DARK_SCHEME_QUERY = '(prefers-color-scheme: dark)';

/** State and setter returned by useColorMode. */
export interface ColorModeController {
  preference: ColorModePreference;
  resolved: ResolvedColorMode;
  setPreference: (next: ColorModePreference) => void;
}

function isColorModePreference(value: string | null): value is ColorModePreference {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(DARK_SCHEME_QUERY).matches
    : false;
}

/**
 * Resolve a saved preference to the colour mode that should be applied.
 *
 * @param preference - Saved preference (`auto` follows the system).
 * @param prefersDark - Whether the operating system currently prefers a dark scheme.
 * @returns `light` or `dark`.
 */
export function resolveColorMode(
  preference: ColorModePreference,
  prefersDark: boolean,
): ResolvedColorMode {
  if (preference === 'auto') {
    return prefersDark ? 'dark' : 'light';
  }
  return preference;
}

/**
 * Keep `<html data-color-mode>` in sync with the saved light/dark/auto preference,
 * following system changes while the preference is `auto`.
 *
 * @returns ColorModeController with the preference, applied mode, and a persisting setter.
 */
export function useColorMode(): ColorModeController {
  const [preference, setPreferenceState] = useState<ColorModePreference>(() => {
    const stored = readStorage(COLOR_MODE_STORAGE_KEY);
    return isColorModePreference(stored) ? stored : DEFAULT_COLOR_MODE;
  });
  const [prefersDark, setPrefersDark] = useState<boolean>(systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const query = window.matchMedia(DARK_SCHEME_QUERY);
    const onChange = (event: MediaQueryListEvent): void => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const resolved = resolveColorMode(preference, prefersDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ColorModePreference): void => {
    setPreferenceState(next);
    writeStorage(COLOR_MODE_STORAGE_KEY, next);
  }, []);

  return useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference],
  );
}
