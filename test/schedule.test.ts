import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { addMonths, getEntries, validateConfig } from '../src/schedule.ts';

const configurationFile = new URL('../public/config.json', import.meta.url);
const configurationJson = JSON.parse(readFileSync(configurationFile, 'utf8'));
const calendarConfig = validateConfig(configurationJson);

function getGlucophageDoses(date: string) {
  return getEntries(calendarConfig, date)
    .filter((entry) => entry.id === 'glucose')
    .map((entry) => ({ time: entry.time, dose: entry.dose }));
}

function isMedicationScheduled(medicationId: string, date: string): boolean {
  return getEntries(calendarConfig, date).some((entry) => entry.id === medicationId);
}

describe('Default calendar configuration', () => {
  it('accepts the configuration shipped with the application', () => {
    assert.doesNotThrow(() => validateConfig(configurationJson));
  });

  it('keeps the original chromium record and its explanatory note', () => {
    const chromiumRule = calendarConfig.rules.find((rule) => rule.id === 'chromium');

    assert.ok(chromiumRule, 'The default schedule should include chromium');
    assert.match(chromiumRule.dose, /200 мг/);
    assert.ok(chromiumRule.warning, 'The source-dose discrepancy should be documented');
  });
});

describe('Six-month calendar boundaries', () => {
  it('ends on April 28, 2027, with the end date excluded', () => {
    assert.equal(addMonths(calendarConfig.startDate, 6), '2027-04-28');
  });

  it('has no entries before the first day', () => {
    assert.deepEqual(getEntries(calendarConfig, '2026-10-27'), []);
  });

  it('still has entries on the final included day', () => {
    assert.ok(getEntries(calendarConfig, '2027-04-27').length > 0);
  });

  it('has no entries on the exclusive end date', () => {
    assert.deepEqual(getEntries(calendarConfig, '2027-04-28'), []);
  });
});

describe('Glucophage dose transitions', () => {
  it('keeps half a tablet in the evening through the end of week one', () => {
    assert.deepEqual(getGlucophageDoses('2026-11-03'), [
      { time: '20:00', dose: '½ таблетки' },
    ]);
  });

  it('switches to one evening tablet at the start of week two', () => {
    assert.deepEqual(getGlucophageDoses('2026-11-04'), [
      { time: '20:00', dose: '1 таблетка' },
    ]);
  });

  it('keeps the evening-only dose through the end of week three', () => {
    assert.deepEqual(getGlucophageDoses('2026-11-17'), [
      { time: '20:00', dose: '1 таблетка' },
    ]);
  });

  it('adds half a morning tablet at the start of week four', () => {
    assert.deepEqual(getGlucophageDoses('2026-11-18'), [
      { time: '08:00', dose: '½ таблетки' },
      { time: '20:00', dose: '1 таблетка' },
    ]);
  });

  it('keeps half a morning tablet through the end of week five', () => {
    assert.deepEqual(getGlucophageDoses('2026-12-01'), [
      { time: '08:00', dose: '½ таблетки' },
      { time: '20:00', dose: '1 таблетка' },
    ]);
  });

  it('switches to one tablet morning and evening after week five', () => {
    assert.deepEqual(getGlucophageDoses('2026-12-02'), [
      { time: '08:00', dose: '1 таблетка' },
      { time: '20:00', dose: '1 таблетка' },
    ]);
  });
});

describe('Medication course end dates', () => {
  it('includes Creon on its last day and removes it after one calendar month', () => {
    assert.equal(isMedicationScheduled('creon', '2026-11-27'), true);
    assert.equal(isMedicationScheduled('creon', '2026-11-28'), false);
  });

  it('includes Thioctacid on its last day and removes it after two calendar months', () => {
    assert.equal(isMedicationScheduled('thio', '2026-12-27'), true);
    assert.equal(isMedicationScheduled('thio', '2026-12-28'), false);
  });
});

describe('Calendar-month arithmetic', () => {
  it('uses the last day of February when the original day is January 31', () => {
    assert.equal(addMonths('2027-01-31', 1), '2027-02-28');
  });
});

describe('Invalid configuration input', () => {
  it('rejects a missing configuration', () => {
    assert.throws(() => validateConfig(null), /Некоректний конфіг/);
  });

  it('rejects dates that do not exist', () => {
    const invalidConfig = { ...calendarConfig, startDate: '2026-02-30' };

    assert.throws(() => validateConfig(invalidConfig), /Некоректна дата початку/);
  });

  it('rejects duplicate rule IDs', () => {
    const duplicateRule = calendarConfig.rules[0];
    const invalidConfig = {
      ...calendarConfig,
      rules: [...calendarConfig.rules, duplicateRule],
    };

    assert.throws(() => validateConfig(invalidConfig), /id мають бути унікальні/);
  });
});
