import type { ScheduleConfig, ScheduleEntry, ScheduleRule } from './types.ts';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Use UTC for date-only arithmetic to avoid daylight-saving offsets.
export function parseDate(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

export function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, amount: number) {
  const result = parseDate(date);
  result.setUTCDate(result.getUTCDate() + amount);
  return toDateString(result);
}

export function addMonths(date: string, amount: number) {
  const result = parseDate(date);
  const originalDay = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + amount);
  const lastDayOfMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(originalDay, lastDayOfMonth));
  return toDateString(result);
}

export function getDayNumber(startDate: string, date: string) {
  return (
    Math.round(
      (parseDate(date).getTime() - parseDate(startDate).getTime()) / MILLISECONDS_PER_DAY,
    ) + 1
  );
}

export function getEntries(config: ScheduleConfig, date: string): ScheduleEntry[] {
  const calendarEnd = addMonths(config.startDate, config.months);
  if (date < config.startDate || date >= calendarEnd) return [];

  const dayNumber = getDayNumber(config.startDate, date);
  return config.rules.flatMap((rule) => {
    if (date >= addMonths(config.startDate, rule.months)) return [];

    const phase = rule.phases?.find(
      (phase) =>
        dayNumber >= phase.fromDay && (phase.toDay === null || dayNumber <= phase.toDay),
    );

    return rule.times.flatMap((time) => {
      const dose = rule.phases ? phase?.doses[time] : rule.dose;
      if (!dose) return [];
      return [{ ...rule, time, dose, key: `${rule.id}@${time}` }];
    });
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePhases(phases: unknown, times: string[], name: string): void {
  if (!Array.isArray(phases) || !phases.length) throw new Error('Порожні фази');
  phases.reduce((expectedStart: number, phase: unknown, index: number) => {
    if (!isRecord(phase)) throw new Error(`Некоректні фази у ${name}`);
    const validStart =
      typeof phase.fromDay === 'number' &&
      Number.isInteger(phase.fromDay) &&
      phase.fromDay === expectedStart;
    const validEnd =
      phase.toDay === null
        ? index === phases.length - 1
        : typeof phase.toDay === 'number' &&
          Number.isInteger(phase.toDay) &&
          typeof phase.fromDay === 'number' &&
          phase.toDay >= phase.fromDay;
    const validDoses =
      isRecord(phase.doses) &&
      Object.entries(phase.doses).every(
        ([time, dose]) => times.includes(time) && typeof dose === 'string',
      );
    if (!validStart || !validEnd || !validDoses) {
      throw new Error(`Некоректні фази у ${name}`);
    }
    return typeof phase.toDay === 'number' ? phase.toDay + 1 : expectedStart;
  }, 1);
}

function validateRule(rule: unknown, usedIds: Set<string>): asserts rule is ScheduleRule {
  if (
    !isRecord(rule) ||
    typeof rule.id !== 'string' ||
    !rule.id ||
    usedIds.has(rule.id) ||
    typeof rule.name !== 'string' ||
    typeof rule.dose !== 'string'
  ) {
    throw new Error('Перевірте id, name, dose; id мають бути унікальні');
  }
  usedIds.add(rule.id);
  if (
    typeof rule.months !== 'number' ||
    !Number.isInteger(rule.months) ||
    rule.months < 1 ||
    !Array.isArray(rule.times) ||
    !rule.times.length ||
    new Set(rule.times).size !== rule.times.length ||
    !rule.times.every(
      (time): time is string => typeof time === 'string' && TIME_PATTERN.test(time),
    )
  ) {
    throw new Error(`Перевірте months та times у ${rule.name}`);
  }
  ['note', 'warning'].forEach((field) => {
    if (rule[field] !== undefined && typeof rule[field] !== 'string') {
      throw new Error(`Некоректне поле ${field} у ${rule.name}`);
    }
  });
  if (rule.phases !== undefined) validatePhases(rule.phases, rule.times, rule.name);
}

export function validateConfig(value: unknown): ScheduleConfig {
  if (!isRecord(value)) throw new Error('Некоректний конфіг');
  const startDate = value.startDate;
  if (
    typeof startDate !== 'string' ||
    !DATE_PATTERN.test(startDate) ||
    Number.isNaN(parseDate(startDate).getTime()) ||
    toDateString(parseDate(startDate)) !== startDate
  ) {
    throw new Error('Некоректна дата початку');
  }
  if (
    typeof value.months !== 'number' ||
    !Number.isInteger(value.months) ||
    value.months < 1 ||
    value.months > 24
  ) {
    throw new Error('Тривалість: від 1 до 24 місяців');
  }
  if (typeof value.timeZone !== 'string') throw new Error('Некоректний часовий пояс');
  new Intl.DateTimeFormat('uk', { timeZone: value.timeZone });
  if (!Array.isArray(value.rules) || !value.rules.length)
    throw new Error('Потрібен масив rules');
  const usedIds = new Set<string>();
  value.rules.forEach((rule) => validateRule(rule, usedIds));
  if (value.note !== undefined && typeof value.note !== 'string')
    throw new Error('Некоректна примітка');
  // The runtime checks above validate all fields before crossing the JSON boundary.
  return value as unknown as ScheduleConfig;
}
