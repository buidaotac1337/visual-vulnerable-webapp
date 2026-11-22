/**
 * Read a persisted string preference from `localStorage` safely.
 *
 * @param key - Storage key to look up.
 * @returns Stored string value, or `null` when unavailable or throwing.
 */
export function readStorage(key: string): string | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Persist a string preference to `localStorage`, ignoring restricted-environment errors.
 *
 * @param key - Storage key to write.
 * @param value - String value to store.
 */
export function writeStorage(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore persistence errors in private browsing or restricted test environments.
  }
}
