/**
 * Initial Casualty Assessment (screen 4) — form model, validation, storage.
 *
 * Saved on this tablet with the patient's keys, and summarised as an entry in
 * the patient's previous history (screen 3). Every field except the
 * consciousness question is optional: an incomplete assessment recorded now is
 * worth more than a complete one recorded late. Numbers are range-checked to
 * catch typos, not to judge clinically.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TriageCategory } from '../../types';
import {
  getPatientHistoryStore,
  type PatientHistoryStore,
} from '../patients/historyStore';

/* --------------------------------- Model --------------------------------- */

export const MOI_OPTIONS = [
  'Blast / IED',
  'Gunshot',
  'Fragmentation',
  'Burn',
  'Fall',
  'Vehicle accident',
  'Crush',
  'Other',
] as const;
export type Mechanism = (typeof MOI_OPTIONS)[number];

export const MARCH_ITEMS = [
  { key: 'M', label: 'Massive Haemorrhage' },
  { key: 'A', label: 'Airway' },
  { key: 'R', label: 'Respiration' },
  { key: 'C', label: 'Circulation' },
  { key: 'H', label: 'Hypothermia / Head Injury' },
] as const;
export type MarchKey = (typeof MARCH_ITEMS)[number]['key'];

export type SystemicExam = 'RECORDABLE' | 'NOT_RECORDABLE';

/** What the screen edits — text as typed, converted on save. */
export interface AssessmentForm {
  conscious: 'YES' | 'NO' | null;
  /** YYYY-MM-DD */
  occurredDate: string | null;
  /** HH:mm (24 h internally; shown as 12 h with AM/PM) */
  occurredTime: string | null;
  injuryTime: string | null;
  /** Every mechanism that applies (multi-select). */
  mechanisms: Mechanism[];
  mechanismOther: string;
  injuryCount: string;
  status: TriageCategory | null;
  march: Record<MarchKey, boolean>;
  additionalInjury: string;
  hr: string;
  rr: string;
  bpSys: string;
  bpDia: string;
  spo2: string;
  temp: string;
  systemicExam: SystemicExam | null;
  rs: string;
  cvs: string;
  pa: string;
  cns: string;
  additionalInfo: string;
}

export const EMPTY_ASSESSMENT: AssessmentForm = {
  conscious: null,
  occurredDate: null,
  occurredTime: null,
  injuryTime: null,
  mechanisms: [],
  mechanismOther: '',
  injuryCount: '',
  status: null,
  march: { M: false, A: false, R: false, C: false, H: false },
  additionalInjury: '',
  hr: '',
  rr: '',
  bpSys: '',
  bpDia: '',
  spo2: '',
  temp: '',
  systemicExam: null,
  rs: '',
  cvs: '',
  pa: '',
  cns: '',
  additionalInfo: '',
};

/** Saved record. */
export interface InitialAssessment {
  id: string;
  /** Keys the patient is known by (UUID, PAT-…, TEMP-…). */
  patientKeys: string[];
  patientLabel: string;
  recordedAt: string;
  recordedBy: string;
  conscious: boolean;
  incident: {
    /** ISO-8601, from date + time of occurrence; null if not given. */
    occurredAt: string | null;
    /** HH:mm or null. */
    injuryTime: string | null;
    /** Every mechanism selected; "Other" is replaced by its description. */
    mechanisms: string[];
    injuryCount: number | null;
    status: TriageCategory | null;
  };
  march: { checked: MarchKey[]; additionalInjury: string };
  vitals: {
    hr: number | null;
    rr: number | null;
    bpSys: number | null;
    bpDia: number | null;
    spo2: number | null;
    temp: number | null;
    systemicExam: SystemicExam | null;
    rs: string;
    cvs: string;
    pa: string;
    cns: string;
  };
  additionalInfo: string;
}

/* ------------------------------ Formatting ------------------------------ */

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

export const pad2 = (n: number) => String(n).padStart(2, '0');

export function toDateValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function toTimeValue(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "13 Nov 2026" */
export function formatDateLabel(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "2:05 PM" from "14:05" */
export function formatTime12(value: string): string {
  const [h, m] = value.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad2(m)} ${suffix}`;
}

/** Local Date from YYYY-MM-DD + HH:mm (either may be missing). */
export function combine(date: string | null, time: string | null): Date | null {
  if (!date) {
    return null;
  }
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time ?? '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/* ------------------------------ Validation ------------------------------ */

export type AssessmentErrors = Partial<Record<keyof AssessmentForm, string>>;

function number(
  errors: AssessmentErrors,
  key: keyof AssessmentForm,
  raw: string,
  {
    min,
    max,
    decimals = 0,
    label,
  }: { min: number; max: number; decimals?: number; label: string },
): number | null {
  const text = raw.trim();
  if (!text) {
    return null;
  }
  const pattern = decimals ? /^\d{1,3}([.,]\d{1,2})?$/ : /^\d{1,3}$/;
  const value = Number(text.replace(',', '.'));
  if (
    !pattern.test(text) ||
    Number.isNaN(value) ||
    value < min ||
    value > max
  ) {
    errors[key] = `${label}: enter ${
      decimals ? 'a number' : 'a whole number'
    } from ${min} to ${max}.`;
    return null;
  }
  return value;
}

export type AssessmentValidation =
  | {
      ok: true;
      value: Omit<
        InitialAssessment,
        'id' | 'patientKeys' | 'patientLabel' | 'recordedAt' | 'recordedBy'
      >;
    }
  | { ok: false; errors: AssessmentErrors };

export function validateAssessment(
  form: AssessmentForm,
  now: Date = new Date(),
): AssessmentValidation {
  const errors: AssessmentErrors = {};
  if (!form.conscious) {
    errors.conscious =
      'Answer whether the casualty is conscious and able to provide details.';
  }

  const occurred = combine(form.occurredDate, form.occurredTime);
  if (!form.occurredDate && form.occurredTime) {
    errors.occurredDate = 'Select the date of occurrence for this time.';
  } else if (occurred && occurred.getTime() > now.getTime() + 60_000) {
    errors.occurredDate =
      'Date and time of occurrence cannot be in the future.';
  }

  if (form.mechanisms.includes('Other') && !form.mechanismOther.trim()) {
    errors.mechanismOther = 'Describe the mechanism of injury.';
  }
  const injuryCount = number(errors, 'injuryCount', form.injuryCount, {
    min: 0,
    max: 99,
    label: 'Number of injuries',
  });

  const hr = number(errors, 'hr', form.hr, { min: 0, max: 300, label: 'HR' });
  const rr = number(errors, 'rr', form.rr, { min: 0, max: 80, label: 'RR' });
  const bpSys = number(errors, 'bpSys', form.bpSys, {
    min: 0,
    max: 300,
    label: 'BP systolic',
  });
  const bpDia = number(errors, 'bpDia', form.bpDia, {
    min: 0,
    max: 200,
    label: 'BP diastolic',
  });
  if (!errors.bpSys && !errors.bpDia && (bpSys === null) !== (bpDia === null)) {
    errors.bpSys = 'Enter both systolic and diastolic, or leave BP blank.';
  }
  const spo2 = number(errors, 'spo2', form.spo2, {
    min: 0,
    max: 100,
    label: 'SpO₂',
  });
  const temp = number(errors, 'temp', form.temp, {
    min: 25,
    max: 45,
    decimals: 1,
    label: 'Temperature',
  });

  if (Object.keys(errors).length) {
    return { ok: false, errors };
  }
  const recordable = form.systemicExam === 'RECORDABLE';
  return {
    ok: true,
    value: {
      conscious: form.conscious === 'YES',
      incident: {
        occurredAt: occurred ? occurred.toISOString() : null,
        injuryTime: form.injuryTime,
        // Kept in the order of MOI_OPTIONS, whatever order they were tapped.
        mechanisms: MOI_OPTIONS.filter(o => form.mechanisms.includes(o)).map(
          o => (o === 'Other' ? form.mechanismOther.trim() : o),
        ),
        injuryCount,
        status: form.status,
      },
      march: {
        checked: (Object.keys(form.march) as MarchKey[]).filter(
          k => form.march[k],
        ),
        additionalInjury: form.additionalInjury.trim(),
      },
      vitals: {
        hr,
        rr,
        bpSys,
        bpDia,
        spo2,
        temp,
        systemicExam: form.systemicExam,
        rs: recordable ? form.rs.trim() : '',
        cvs: recordable ? form.cvs.trim() : '',
        pa: recordable ? form.pa.trim() : '',
        cns: recordable ? form.cns.trim() : '',
      },
      additionalInfo: form.additionalInfo.trim(),
    },
  };
}

/** One-line summary for the patient's history list. */
export function summarise(a: InitialAssessment): string {
  const parts: string[] = [];
  if (a.incident.status) {
    parts.push(a.incident.status);
  }
  if (a.incident.mechanisms.length) {
    parts.push(a.incident.mechanisms.join(', '));
  }
  if (a.incident.injuryCount !== null) {
    parts.push(
      `${a.incident.injuryCount} ${
        a.incident.injuryCount === 1 ? 'injury' : 'injuries'
      }`,
    );
  }
  if (a.march.checked.length) {
    parts.push(`MARCH: ${a.march.checked.join(', ')}`);
  }
  const v = a.vitals;
  if (v.hr !== null) {
    parts.push(`HR ${v.hr}`);
  }
  if (v.bpSys !== null && v.bpDia !== null) {
    parts.push(`BP ${v.bpSys}/${v.bpDia}`);
  }
  if (v.spo2 !== null) {
    parts.push(`SpO₂ ${v.spo2}%`);
  }
  parts.push(a.conscious ? 'Conscious' : 'Not able to give details');
  return parts.join(' · ');
}

/* -------------------------------- Storage -------------------------------- */

const STORAGE_KEY = 'casevac.assessments.v1';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function newId(): string {
  return `ASM-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    Math.random() * 1e6,
  )
    .toString(36)
    .toUpperCase()}`;
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v ? v : null;
const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

/**
 * Brings a stored record up to the current shape. Records saved by earlier
 * builds (e.g. a single `incident.mechanism` instead of `mechanisms`) or with
 * missing fields must still open — a missing value reads as not recorded,
 * never as something invented.
 */
export function normaliseAssessment(raw: unknown): InitialAssessment | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, any>;
  if (typeof r.id !== 'string') {
    return null;
  }
  const incident = (r.incident ?? {}) as Record<string, any>;
  const march = (r.march ?? {}) as Record<string, any>;
  const vitals = (r.vitals ?? {}) as Record<string, any>;
  const mechanisms: string[] = Array.isArray(incident.mechanisms)
    ? incident.mechanisms.filter((m: unknown) => typeof m === 'string' && m)
    : typeof incident.mechanism === 'string' && incident.mechanism
    ? [incident.mechanism]
    : [];
  const validKeys = new Set<string>(MARCH_ITEMS.map(i => i.key));
  const status = ['RED', 'YELLOW', 'GREEN', 'BLACK'].includes(incident.status)
    ? (incident.status as TriageCategory)
    : null;
  const se =
    vitals.systemicExam === 'RECORDABLE' ||
    vitals.systemicExam === 'NOT_RECORDABLE'
      ? (vitals.systemicExam as SystemicExam)
      : null;
  return {
    id: r.id,
    patientKeys: Array.isArray(r.patientKeys)
      ? r.patientKeys.filter((k: unknown) => typeof k === 'string')
      : [],
    patientLabel: str(r.patientLabel),
    recordedAt: str(r.recordedAt),
    recordedBy: str(r.recordedBy),
    conscious: r.conscious === true,
    incident: {
      occurredAt: strOrNull(incident.occurredAt),
      injuryTime: strOrNull(incident.injuryTime),
      mechanisms,
      injuryCount: numOrNull(incident.injuryCount),
      status,
    },
    march: {
      checked: Array.isArray(march.checked)
        ? (march.checked.filter((k: unknown) =>
            validKeys.has(k as string),
          ) as MarchKey[])
        : [],
      additionalInjury: str(march.additionalInjury),
    },
    vitals: {
      hr: numOrNull(vitals.hr),
      rr: numOrNull(vitals.rr),
      bpSys: numOrNull(vitals.bpSys),
      bpDia: numOrNull(vitals.bpDia),
      spo2: numOrNull(vitals.spo2),
      temp: numOrNull(vitals.temp),
      systemicExam: se,
      rs: str(vitals.rs),
      cvs: str(vitals.cvs),
      pa: str(vitals.pa),
      cns: str(vitals.cns),
    },
    additionalInfo: str(r.additionalInfo),
  };
}

export class AssessmentStore {
  constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly history: PatientHistoryStore = getPatientHistoryStore(),
  ) {}

  async list(): Promise<InitialAssessment[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .map(normaliseAssessment)
            .filter((a): a is InitialAssessment => a !== null)
        : [];
    } catch {
      return [];
    }
  }

  /**
   * Adds records received from another tablet, keeping their original IDs.
   * Records already on this tablet are left as they are.
   */
  async importRecords(records: unknown[]): Promise<number> {
    const all = await this.list();
    const ids = new Set(all.map(r => r.id));
    const add = records
      .map(normaliseAssessment)
      .filter((r): r is InitialAssessment => r !== null && !ids.has(r.id));
    if (add.length) {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, ...add]));
    }
    return add.length;
  }

  /** The saved assessment behind a history entry (same id), if any. */
  async get(id: string): Promise<InitialAssessment | null> {
    return (await this.list()).find(a => a.id === id) ?? null;
  }

  /** Saves the assessment and adds it to the patient's history. */
  async save(
    data: Extract<AssessmentValidation, { ok: true }>['value'],
    meta: { patientKeys: string[]; patientLabel: string; recordedBy: string },
  ): Promise<InitialAssessment> {
    const record: InitialAssessment = {
      id: newId(),
      recordedAt: new Date().toISOString(),
      ...meta,
      ...data,
    };
    const all = await this.list();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, record]));
    await this.history.add({
      id: record.id,
      patientKeys: record.patientKeys,
      at: record.recordedAt,
      title: 'Initial casualty assessment',
      detail: summarise(record),
      recordedBy: record.recordedBy,
    });
    return record;
  }
}

let defaultStore: AssessmentStore | null = null;
export function getAssessmentStore(): AssessmentStore {
  defaultStore ??= new AssessmentStore();
  return defaultStore;
}
