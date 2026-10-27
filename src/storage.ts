import type { CheckboxStates } from './types.ts';

export const STORAGE_KEYS = {
  config: 'rhythm-config',
  checks: 'rhythm-checks',
};

export function readStored<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => T,
): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : validate(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function validateChecks(value: unknown): CheckboxStates {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid checkbox data');
  }

  return Object.fromEntries(
    Object.entries(value).filter(([, checked]) => typeof checked === 'boolean'),
  );
}

/** Each date owns one object: { "water@08:00": true, ... }. */
export function readDayChecks(date: string): CheckboxStates {
  return readStored(date, {}, validateChecks);
}

/** Preserve old marks, while letting existing per-day values take precedence. */
export function migrateLegacyChecks(): boolean {
  try {
    const legacyJson = localStorage.getItem(STORAGE_KEYS.checks);
    if (legacyJson === null) return true;
    const legacyChecks = validateChecks(JSON.parse(legacyJson));
    const days = Object.entries(legacyChecks).reduce((days, [key, checked]) => {
      const separator = key.indexOf('|');
      const date = key.slice(0, separator);
      const entryKey = key.slice(separator + 1);
      if (separator < 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !entryKey) return days;
      const checks = days.get(date) ?? {};
      checks[entryKey] = checked;
      days.set(date, checks);
      return days;
    }, new Map<string, CheckboxStates>());

    const migrated = Array.from(days).every(([date, checks]) =>
      writeStored(date, { ...checks, ...readDayChecks(date) }),
    );
    // Keep the original intact if a storage write fails, so the next load can retry.
    if (migrated) localStorage.removeItem(STORAGE_KEYS.checks);
    return migrated;
  } catch {
    return false;
  }
}
