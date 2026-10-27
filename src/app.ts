import type { ScheduleEntry, CheckboxStates } from './types.ts';
import {
  parseDate,
  addDays,
  addMonths,
  getEntries,
  getDayNumber,
  validateConfig,
} from './schedule.ts';
import { STORAGE_KEYS, readStored, writeStored, validateChecks } from './storage.ts';

type ButtonId = 'prevMonth' | 'nextMonth' | 'prevDay' | 'nextDay';
function getElement(id: 'configEditor'): HTMLTextAreaElement;
function getElement(id: 'progress'): HTMLProgressElement;
function getElement(id: 'editor'): HTMLDialogElement;
function getElement(id: ButtonId): HTMLButtonElement;
function getElement(id: string): HTMLElement;
function getElement(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element: ${id}`);
  return element;
}
const configResponse = await fetch(`${import.meta.env.BASE_URL}config.json`);
if (!configResponse.ok) throw new Error('Не вдалося завантажити config.json');
const defaultConfig = validateConfig(await configResponse.json());
let config = readStored(STORAGE_KEYS.config, defaultConfig, validateConfig);
const checks: CheckboxStates = readStored(STORAGE_KEYS.checks, {}, validateChecks);
let selectedDate = clampDate(getToday());
let visibleMonth = firstOfMonth(selectedDate);

function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string | null,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (text) element.textContent = text;
  if (className) element.className = className;
  return element;
}

function firstOfMonth(date: string) {
  return `${date.slice(0, 7)}-01`;
}

function getToday() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  return ['year', 'month', 'day']
    .map((type) => parts.find((part) => part.type === type)!.value)
    .join('-');
}

function endDate() {
  return addDays(addMonths(config.startDate, config.months), -1);
}

function clampDate(date: string) {
  if (date < config.startDate) return config.startDate;
  if (date > endDate()) return endDate();
  return date;
}

function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('uk-UA', { ...options, timeZone: 'UTC' }).format(
    parseDate(date),
  );
}

function selectDate(date: string) {
  selectedDate = clampDate(date);
  visibleMonth = firstOfMonth(selectedDate);
  render();
}

function renderCalendar() {
  const fullDate: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  getElement('range').textContent =
    `${formatDate(config.startDate, fullDate)} — ${formatDate(endDate(), fullDate)}`;
  getElement('month').textContent = formatDate(visibleMonth, {
    month: 'long',
    year: 'numeric',
  });

  const calendar = getElement('calendar');
  const weekdayOffset = (parseDate(visibleMonth).getUTCDay() + 6) % 7;
  const daysInMonth = parseDate(addDays(addMonths(visibleMonth, 1), -1)).getUTCDate();
  const emptyCells = Array.from({ length: weekdayOffset }, () => createElement('span'));
  const dayButtons = Array.from({ length: daysInMonth }, (_, index) => {
    const date = addDays(visibleMonth, index);
    const button = createElement('button', String(index + 1));
    button.disabled = date < config.startDate || date > endDate();
    button.classList.toggle('selected', date === selectedDate);
    button.classList.toggle('current', date === getToday());
    button.setAttribute('aria-label', formatDate(date, fullDate));
    button.setAttribute('aria-pressed', String(date === selectedDate));
    button.addEventListener('click', () => selectDate(date));
    return button;
  });
  calendar.replaceChildren(...emptyCells, ...dayButtons);

  getElement('prevMonth').disabled =
    addMonths(visibleMonth, -1).slice(0, 7) < config.startDate.slice(0, 7);
  getElement('nextMonth').disabled =
    addMonths(visibleMonth, 1).slice(0, 7) > endDate().slice(0, 7);
  getElement('prevDay').disabled = selectedDate <= config.startDate;
  getElement('nextDay').disabled = selectedDate >= endDate();
}

function checkboxKey(entry: ScheduleEntry) {
  // Keep the existing format so previously saved checkmarks still work.
  return `${selectedDate}|${entry.key}`;
}

function renderProgress(dayEntries: ScheduleEntry[]) {
  const completed = dayEntries.filter((entry) => checks[checkboxKey(entry)]).length;
  const percent = dayEntries.length
    ? Math.round((completed / dayEntries.length) * 100)
    : 0;
  getElement('progressText').textContent =
    `${completed} із ${dayEntries.length} відмічено`;
  getElement('percent').textContent = `${percent}%`;
  getElement('progress').value = percent;
}

function createEntryRow(entry: ScheduleEntry) {
  const key = checkboxKey(entry);
  const row = createElement('div', null, `row${checks[key] ? ' done' : ''}`);
  const checkbox = createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = Boolean(checks[key]);
  checkbox.id = `check-${entry.key}`;
  checkbox.setAttribute('aria-label', `Відмітити: ${entry.name} ${entry.dose}`);
  checkbox.addEventListener('change', () => {
    checks[key] = checkbox.checked;
    if (!writeStored(STORAGE_KEYS.checks, checks)) {
      alert('Браузер не дозволив зберегти відмітки. Вони діють до закриття сторінки.');
    }
    render();
  });

  const content = createElement('div', null, 'text');
  const label = createElement('label', entry.name, 'name');
  label.htmlFor = checkbox.id;
  content.append(label, createElement('div', entry.dose, 'dose dosage'));
  if (entry.note) content.append(createElement('div', entry.note, 'dose'));
  if (entry.warning) {
    const details = createElement('details');
    details.append(
      createElement('summary', 'Примітка'),
      createElement('p', entry.warning),
    );
    content.append(details);
  }
  row.append(checkbox, content);
  return row;
}

function renderGroups(dayEntries: ScheduleEntry[]) {
  const container = getElement('groups');
  container.replaceChildren();

  // Append walking after all other entries, without changing its configured time.
  const orderedEntries = [
    ...dayEntries
      .filter((entry) => entry.id !== 'walk')
      .sort((a, b) => a.time.localeCompare(b.time)),
    ...dayEntries
      .filter((entry) => entry.id === 'walk')
      .sort((a, b) => a.time.localeCompare(b.time)),
  ];
  const groups = orderedEntries.reduce((groups, entry) => {
    const groupKey = `${entry.id === 'walk' ? 'walk' : 'routine'}-${entry.time}`;
    const groupEntries = groups.get(groupKey) ?? [];
    groupEntries.push(entry);
    groups.set(groupKey, groupEntries);
    return groups;
  }, new Map<string, ScheduleEntry[]>());

  const groupElements = Array.from(groups.values(), (groupEntries) => {
    const time = groupEntries[0].time;
    const period = time < '12:00' ? 'morning' : time >= '22:00' ? 'night' : 'evening';
    const titles = { morning: '☀ Ранок', night: '☾ Перед сном', evening: '☽ Вечір' };
    const group = createElement('section', null, `group ${period}`);
    const heading = createElement('div', null, 'grouphead');
    heading.append(createElement('strong', titles[period]), createElement('span', time));
    group.append(heading, ...groupEntries.map(createEntryRow));
    return group;
  });
  container.replaceChildren(...groupElements);
  if (!dayEntries.length) {
    container.append(createElement('p', 'На цей день записів немає.', 'empty'));
  }
}

function render() {
  renderCalendar();
  const dayNumber = getDayNumber(config.startDate, selectedDate);
  getElement('daynum').textContent =
    `ДЕНЬ ${dayNumber} · ${formatDate(selectedDate, { weekday: 'long' })}`;
  getElement('dateTitle').textContent = formatDate(selectedDate, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const dayEntries = getEntries(config, selectedDate);
  renderProgress(dayEntries);
  renderGroups(dayEntries);
}

function openConfigEditor() {
  getElement('configEditor').value = JSON.stringify(config, null, 2);
  getElement('configNote').textContent = config.note || '';
  getElement('configError').textContent = '';
  getElement('editor').showModal();
}

function saveConfig() {
  try {
    const updatedConfig = validateConfig(JSON.parse(getElement('configEditor').value));
    if (!writeStored(STORAGE_KEYS.config, updatedConfig)) {
      throw new Error('Браузер не дозволив зберегти конфіг');
    }
    config = updatedConfig;
    getElement('editor').close();
    selectDate(selectedDate);
  } catch (error) {
    getElement('configError').textContent =
      error instanceof Error ? error.message : String(error);
  }
}

function downloadConfig() {
  try {
    const updatedConfig = validateConfig(JSON.parse(getElement('configEditor').value));
    const file = new Blob([JSON.stringify(updatedConfig, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(file);
    const link = createElement('a');
    link.href = url;
    link.download = 'config.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    getElement('configError').textContent =
      error instanceof Error ? error.message : String(error);
  }
}

getElement('prevDay').addEventListener('click', () =>
  selectDate(addDays(selectedDate, -1)),
);
getElement('nextDay').addEventListener('click', () =>
  selectDate(addDays(selectedDate, 1)),
);
([
  ['prevMonth', -1],
  ['nextMonth', 1],
] as const).forEach(([id, direction]) => {
  getElement(id).addEventListener('click', () => {
    visibleMonth = addMonths(visibleMonth, direction);
    render();
  });
});
getElement('today').addEventListener('click', () => selectDate(getToday()));
getElement('settings').addEventListener('click', openConfigEditor);
getElement('closeEditor').addEventListener('click', () => getElement('editor').close());
getElement('save').addEventListener('click', saveConfig);
getElement('download').addEventListener('click', downloadConfig);
getElement('reset').addEventListener('click', () => {
  getElement('configEditor').value = JSON.stringify(defaultConfig, null, 2);
});

render();
let previousToday = getToday();
setInterval(() => {
  const today = getToday();
  if (today === previousToday) return;
  if (selectedDate === clampDate(previousToday)) {
    selectedDate = clampDate(today);
    visibleMonth = firstOfMonth(selectedDate);
  }
  previousToday = today;
  render();
}, 60000);
