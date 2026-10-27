export interface DosePhase {
  fromDay: number;
  toDay: number | null;
  doses: Record<string, string>;
}

export interface ScheduleRule {
  id: string;
  name: string;
  dose: string;
  times: string[];
  months: number;
  note?: string;
  warning?: string;
  phases?: DosePhase[];
}

export interface ScheduleConfig {
  startDate: string;
  months: number;
  timeZone: string;
  note?: string;
  rules: ScheduleRule[];
}

export interface ScheduleEntry extends ScheduleRule {
  time: string;
  key: string;
}

export type CheckboxStates = Record<string, boolean>;
