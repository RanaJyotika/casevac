/**
 * Prepare Evacuation (client screen 9) — form model, validation, storage.
 *
 * The final step of an evacuation record. Opens after Handover Details (8).
 * Records when the casualty was evacuated, whether a medical officer (MO) and
 * nursing assistant (NA) assisted, the patient's condition during evacuation
 * (triage colour, pre-filled from the latest triage) and the mode of
 * evacuation. Saving completes the record: it is then handed over and read
 * only.
 *
 * Status of an evacuation by the last step saved:
 *   assessment / interventions → Awaiting pickup
 *   handover details (8)       → In transit
 *   prepare evacuation (9)     → Handed over (read only)
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TriageCategory } from '../../types';
import {
  getPatientHistoryStore,
  type PatientHistoryStore,
} from '../patients/historyStore';
import { combine, type KeyValueStorage } from './assessment';
import type { YesNo } from './interventions';

/* --------------------------------- Model --------------------------------- */

export const MODES = [
  { value: 'AMBULANCE', label: 'Ambulance', meaning: 'Ground' },
  { value: 'HELICOPTER', label: 'Helicopter', meaning: 'Air' },
  { value: 'STRETCHER', label: 'Stretcher', meaning: 'Manual / on-site' },
] as const;
export type EvacuationMode = (typeof MODES)[number]['value'];

export const MODE_LABEL = Object.fromEntries(
  MODES.map(m => [m.value, `${m.label} (${m.meaning})`]),
) as Record<EvacuationMode, string>;

/** What the screen edits. */
export interface EvacuationForm {
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:mm */
  time: string | null;
  assistedByMo: YesNo | null;
  assistedByNa: YesNo | null;
  /** Patient condition during evacuation, as a triage colour. */
  condition: TriageCategory | null;
  conditionNotes: string;
  mode: EvacuationMode | null;
}

export interface EvacuationRecord {
  id: string;
  assessmentId: string;
  handoverId: string | null;
  patientKeys: string[];
  patientLabel: string;
  recordedAt: string;
  recordedBy: string;
  /** ISO-8601 from the date + time of evacuation. */
  evacuatedAt: string;
  assistedByMo: boolean;
  assistedByNa: boolean;
  condition: TriageCategory;
  conditionNotes: string;
  mode: EvacuationMode;
}

/* ------------------------------ Validation ------------------------------ */

export type EvacuationErrors = Partial<Record<keyof EvacuationForm, string>>;

export type EvacuationValidation =
  | {
      ok: true;
      value: Pick<
        EvacuationRecord,
        | 'evacuatedAt'
        | 'assistedByMo'
        | 'assistedByNa'
        | 'condition'
        | 'conditionNotes'
        | 'mode'
      >;
    }
  | { ok: false; errors: EvacuationErrors };

export function validateEvacuation(
  form: EvacuationForm,
  now: Date = new Date(),
): EvacuationValidation {
  const errors: EvacuationErrors = {};
  if (!form.date) {
    errors.date = 'Select the date of evacuation.';
  }
  if (!form.time) {
    errors.time = 'Select the time of evacuation.';
  }
  const at = combine(form.date, form.time);
  if (at && at.getTime() > now.getTime() + 60_000) {
    errors.time = 'Date and time of evacuation cannot be in the future.';
  }
  if (!form.assistedByMo) {
    errors.assistedByMo = 'Answer whether a medical officer assisted.';
  }
  if (!form.assistedByNa) {
    errors.assistedByNa = 'Answer whether a nursing assistant assisted.';
  }
  if (!form.condition) {
    errors.condition = 'Select the patient’s condition during evacuation.';
  }
  if (!form.mode) {
    errors.mode = 'Select the mode of evacuation.';
  }
  if (
    Object.keys(errors).length ||
    !at ||
    !form.assistedByMo ||
    !form.assistedByNa ||
    !form.condition ||
    !form.mode
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      evacuatedAt: at.toISOString(),
      assistedByMo: form.assistedByMo === 'YES',
      assistedByNa: form.assistedByNa === 'YES',
      condition: form.condition,
      conditionNotes: form.conditionNotes.trim(),
      mode: form.mode,
    },
  };
}

/** One-line summary for the patient's history list. */
export function summariseEvacuation(r: EvacuationRecord): string {
  const assisted = [r.assistedByMo && 'MO', r.assistedByNa && 'NA'].filter(
    Boolean,
  );
  return [
    `Evacuated by ${MODE_LABEL[r.mode]}`,
    `condition ${r.condition}`,
    assisted.length ? `assisted by ${assisted.join(' + ')}` : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/* -------------------------------- Storage -------------------------------- */

const STORAGE_KEY = 'casevac.evacuations.v1';

/** History title once the evacuation record is complete. */
export const HANDED_OVER_TITLE = 'Evacuation — handed over';

const MODE_VALUES = new Set<string>(MODES.map(m => m.value));
const TRIAGE = new Set<string>(['RED', 'YELLOW', 'GREEN', 'BLACK']);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Brings a stored record up to the current shape; null if unusable. */
export function normaliseEvacuation(raw: unknown): EvacuationRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, any>;
  if (
    typeof r.id !== 'string' ||
    typeof r.assessmentId !== 'string' ||
    !MODE_VALUES.has(r.mode) ||
    !TRIAGE.has(r.condition)
  ) {
    return null;
  }
  return {
    id: r.id,
    assessmentId: r.assessmentId,
    handoverId: typeof r.handoverId === 'string' ? r.handoverId : null,
    patientKeys: Array.isArray(r.patientKeys)
      ? r.patientKeys.filter((k: unknown) => typeof k === 'string')
      : [],
    patientLabel: str(r.patientLabel),
    recordedAt: str(r.recordedAt),
    recordedBy: str(r.recordedBy),
    evacuatedAt: str(r.evacuatedAt),
    assistedByMo: r.assistedByMo === true,
    assistedByNa: r.assistedByNa === true,
    condition: r.condition as TriageCategory,
    conditionNotes: str(r.conditionNotes),
    mode: r.mode as EvacuationMode,
  };
}

function newId(): string {
  return `EVC-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    Math.random() * 1e6,
  )
    .toString(36)
    .toUpperCase()}`;
}

export class EvacuationStore {
  constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly history: PatientHistoryStore = getPatientHistoryStore(),
  ) {}

  async list(): Promise<EvacuationRecord[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .map(normaliseEvacuation)
            .filter((r): r is EvacuationRecord => r !== null)
        : [];
    } catch {
      return [];
    }
  }

  async findByAssessment(
    assessmentId: string,
  ): Promise<EvacuationRecord | null> {
    const matches = (await this.list()).filter(
      r => r.assessmentId === assessmentId,
    );
    return matches.length ? matches[matches.length - 1] : null;
  }

  /** Adds records received from another tablet (original IDs kept). */
  async importRecords(records: unknown[]): Promise<number> {
    const all = await this.list();
    const ids = new Set(all.map(r => r.id));
    const add = records
      .map(normaliseEvacuation)
      .filter((r): r is EvacuationRecord => r !== null && !ids.has(r.id));
    if (add.length) {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, ...add]));
    }
    return add.length;
  }

  /** Saves the final step and marks the evacuation handed over. */
  async save(
    data: Extract<EvacuationValidation, { ok: true }>['value'],
    meta: {
      assessmentId: string;
      handoverId: string | null;
      patientKeys: string[];
      patientLabel: string;
      recordedBy: string;
    },
  ): Promise<EvacuationRecord> {
    const record: EvacuationRecord = {
      id: newId(),
      recordedAt: new Date().toISOString(),
      ...meta,
      ...data,
    };
    const all = await this.list();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, record]));

    // Same history entry as the rest of the evacuation.
    const existing = await this.history.get(record.assessmentId);
    await this.history.upsert({
      id: record.assessmentId,
      patientKeys: Array.from(
        new Set([...(existing?.patientKeys ?? []), ...record.patientKeys]),
      ),
      at: existing?.at ?? record.recordedAt,
      title: HANDED_OVER_TITLE,
      detail: [summariseEvacuation(record), existing?.detail]
        .filter(Boolean)
        .join(' · '),
      recordedBy: existing?.recordedBy ?? record.recordedBy,
    });
    return record;
  }
}

let defaultStore: EvacuationStore | null = null;
export function getEvacuationStore(): EvacuationStore {
  defaultStore ??= new EvacuationStore();
  return defaultStore;
}
