import type { CheckboxStates } from './types.ts';

export const STORAGE_KEYS = {
  config: 'rhythm-config',
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

