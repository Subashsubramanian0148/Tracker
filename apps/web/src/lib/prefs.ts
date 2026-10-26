/**
 * Non-sensitive UI preferences only (selected team, date range). Storage can be
 * unavailable (private mode, quota, policy), so every access is guarded.
 */
const PREFIX = 'di.pref.';

export function readPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Ignore: preferences are a convenience.
  }
}
