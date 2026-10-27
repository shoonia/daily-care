import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { readDayChecks, writeStored } from '../src/storage.ts';

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
let savedValues: Map<string, string>;
let failWrites: boolean;

beforeEach(() => {
  savedValues = new Map();
  failWrites = false;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => savedValues.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error('Storage is full');
        savedValues.set(key, value);
      },
    },
  });
});

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('Daily checkbox storage', () => {
  it('stores each day separately and preserves checked and unchecked values', () => {
    writeStored('2026-10-28', { 'water@08:00': true, 'walk@20:00': false });
    writeStored('2026-10-29', { 'water@08:00': false });

    assert.deepEqual(readDayChecks('2026-10-28'), {
      'water@08:00': true,
      'walk@20:00': false,
    });
    assert.deepEqual(readDayChecks('2026-10-29'), { 'water@08:00': false });
    assert.deepEqual(readDayChecks('2026-10-30'), {});
  });

  it('returns an empty day for malformed stored data', () => {
    savedValues.set('2026-10-28', 'invalid JSON');
    assert.deepEqual(readDayChecks('2026-10-28'), {});
  });

  it('reports a failed save without changing the existing day', () => {
    writeStored('2026-10-28', { 'water@08:00': true });
    failWrites = true;

    assert.equal(writeStored('2026-10-28', { 'water@08:00': false }), false);
    assert.deepEqual(readDayChecks('2026-10-28'), { 'water@08:00': true });
  });
});
