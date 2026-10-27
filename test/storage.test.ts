import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { migrateLegacyChecks, readDayChecks, writeStored } from '../src/storage.ts';

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
      removeItem: (key: string) => savedValues.delete(key),
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

  it('migrates old marks into date keys without overriding newer daily choices', () => {
    writeStored('rhythm-checks', {
      '2026-10-28|water@08:00': true,
      '2026-10-29|walk@20:00': true,
    });
    writeStored('2026-10-28', { 'water@08:00': false });

    assert.equal(migrateLegacyChecks(), true);
    assert.deepEqual(readDayChecks('2026-10-28'), { 'water@08:00': false });
    assert.deepEqual(readDayChecks('2026-10-29'), { 'walk@20:00': true });
    assert.equal(savedValues.has('rhythm-checks'), false);
    assert.equal(migrateLegacyChecks(), true);
  });

  it('keeps the original data when migration cannot save a day', () => {
    writeStored('rhythm-checks', { '2026-10-28|water@08:00': true });
    failWrites = true;

    assert.equal(migrateLegacyChecks(), false);
    assert.equal(savedValues.has('rhythm-checks'), true);

    failWrites = false;
    assert.equal(migrateLegacyChecks(), true);
    assert.deepEqual(readDayChecks('2026-10-28'), { 'water@08:00': true });
  });
});
