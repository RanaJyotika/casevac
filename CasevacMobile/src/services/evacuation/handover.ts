/**
 * Handover Details (client screen 8) — form model, validation, storage.
 *
 * Opens after Interventions & Triage. Records where and when the handover
 * began, the clinician who received the casualty (picked from the staff list
 * downloaded at sign-in, or entered by hand when they are not on it), and the
 * next course of action. Saving moves the evacuation to "In transit" and
 * opens Prepare Evacuation (9), whose Save completes the record.
 *
 * The receiving clinician is stored as a snapshot, so the record stays
 * complete even if the staff list on the tablet changes later.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { StaffMember } from '../identity/types';
import {
  getPatientHistoryStore,
  type PatientHistoryStore,
} from '../patients/historyStore';
import { combine, type KeyValueStorage } from './assessment';

/* --------------------------------- Model --------------------------------- */

export const PLACES = [
  { value: 'RAP', label: 'RAP', meaning: 'Regimental Aid Post' },
  { value: 'ADS', label: 'ADS', meaning: 'Advanced Dressing Station' },
  { value: 'FSC', label: 'FSC', meaning: 'Forward Surgical Centre' },
] as const;
export type Place = (typeof PLACES)[number]['value'];

export const NEXT_ACTIONS = [
  { value: 'CONTINUE_AT_RAP', label: 'Continue at RAP / MOS' },
  { value: 'EVACUATE_HIGHER', label: 'Evacuate to Higher Medical Facility' },
  { value: 'NEXT_ECHELON', label: 'Handover to Next Echelon' },
  { value: 'OTHER', label: 'Other (specify)' },
] as const;
export type NextAction = (typeof NEXT_ACTIONS)[number]['value'];

export const NEXT_ACTION_LABEL = Object.fromEntries(
  NEXT_ACTIONS.map(a => [a.value, a.label]),
) as Record<NextAction, string>;
export const PLACE_MEANING = Object.fromEntries(
  PLACES.map(p => [p.value, p.meaning]),
) as Record<Place, string>;

/** The clinician who received the casualty, as recorded at handover. */
export interface ReceivingOfficer {
  /** DIRECTORY = picked from the staff list; MANUAL = typed, not verified. */
  source: 'DIRECTORY' | 'MANUAL';
  staffId: string | null;
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  roleLabel: string;
  designation: string;
  dateOfBirth: string | null;
  contactPhone: string;
  photo: string | null;
}

export function officerFromStaff(s: StaffMember): ReceivingOfficer {
  return {
    source: 'DIRECTORY',
    staffId: s.staffId,
    displayId: s.displayId,
    fullName: s.fullName,
    rank: s.rank,
    unit: s.unit,
    roleLabel: s.roleLabel,
    designation: s.designation,
    dateOfBirth: s.dateOfBirth,
    contactPhone: s.contactPhone,
    photo: s.photo,
  };
}

export interface ManualOfficer {
  fullName: string;
  rank: string;
  displayId: string;
  unit: string;
  designation: string;
}

export const EMPTY_MANUAL_OFFICER: ManualOfficer = {
  fullName: '',
  rank: '',
  displayId: '',
  unit: '',
  designation: '',
};

/** What the screen edits. */
export interface HandoverForm {
  place: Place | null;
  /** YYYY-MM-DD */
  date: string | null;
  /** HH:mm */
  time: string | null;
  /** Picked from the staff list. */
  officer: ReceivingOfficer | null;
  /** Typed by hand when the officer is not on the list. */
  manualEntry: boolean;
  manual: ManualOfficer;
  nextAction: NextAction | null;
  nextActionOther: string;
}

export interface HandoverRecord {
  id: string;
  assessmentId: string;
  interventionsId: string | null;
  patientKeys: string[];
  patientLabel: string;
  recordedAt: string;
  recordedBy: string;
  place: Place;
  /** ISO-8601 from the date + time of initiation. */
  initiatedAt: string;
  officer: ReceivingOfficer;
  nextAction: NextAction;
  /** Description when nextAction is OTHER, else empty. */
  nextActionOther: string;
}

/* ------------------------------ Validation ------------------------------ */

export type HandoverErrors = Partial<
  Record<keyof HandoverForm | 'manualName', string>
>;

export type HandoverValidation =
  | {
      ok: true;
      value: Pick<
        HandoverRecord,
        'place' | 'initiatedAt' | 'officer' | 'nextAction' | 'nextActionOther'
      >;
    }
  | { ok: false; errors: HandoverErrors };

export function validateHandover(
  form: HandoverForm,
  now: Date = new Date(),
): HandoverValidation {
  const errors: HandoverErrors = {};
  if (!form.place) {
    errors.place = 'Select the place of initiation.';
  }
  if (!form.date) {
    errors.date = 'Select the date of initiation.';
  }
  if (!form.time) {
    errors.time = 'Select the time of initiation.';
  }
  const initiated = combine(form.date, form.time);
  if (initiated && initiated.getTime() > now.getTime() + 60_000) {
    errors.time = 'Date and time of initiation cannot be in the future.';
  }

  let officer: ReceivingOfficer | null = null;
  if (form.manualEntry) {
    const m = form.manual;
    if (!m.fullName.trim()) {
      errors.manualName = 'Enter the receiving officer’s name.';
    } else {
      officer = {
        source: 'MANUAL',
        staffId: null,
        displayId: m.displayId.trim().toUpperCase(),
        fullName: m.fullName.trim(),
        rank: m.rank.trim(),
        unit: m.unit.trim(),
        roleLabel: '',
        designation: m.designation.trim(),
        dateOfBirth: null,
        contactPhone: '',
        photo: null,
      };
    }
  } else if (form.officer) {
    officer = form.officer;
  } else {
    errors.officer = 'Search and select the officer receiving the casualty.';
  }

  if (!form.nextAction) {
    errors.nextAction = 'Select the next course of action.';
  } else if (form.nextAction === 'OTHER' && !form.nextActionOther.trim()) {
    errors.nextActionOther = 'Describe the next course of action.';
  }

  if (
    Object.keys(errors).length ||
    !form.place ||
    !initiated ||
    !officer ||
    !form.nextAction
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      place: form.place,
      initiatedAt: initiated.toISOString(),
      officer,
      nextAction: form.nextAction,
      nextActionOther:
        form.nextAction === 'OTHER' ? form.nextActionOther.trim() : '',
    },
  };
}

/** "Maj Meera Iyer (MED-00003)" */
export function officerName(o: ReceivingOfficer): string {
  const name = [o.rank, o.fullName].filter(Boolean).join(' ');
  return o.displayId ? `${name} (${o.displayId})` : name;
}

/** One-line summary for the patient's history list. */
export function summariseHandover(r: HandoverRecord): string {
  const next =
    r.nextAction === 'OTHER' ? r.nextActionOther : NEXT_ACTION_LABEL[r.nextAction];
  return `Handed over at ${r.place} to ${officerName(r.officer)} · ${next}`;
}

/* -------------------------------- Storage -------------------------------- */

const STORAGE_KEY = 'casevac.handovers.v1';
const LAST_PLACE_KEY = 'casevac.handover.lastPlace';

/** History title after handover details; Prepare Evacuation (9) completes it. */
export const IN_TRANSIT_TITLE = 'Evacuation — in transit';

const PLACE_VALUES = new Set<string>(PLACES.map(p => p.value));
const ACTION_VALUES = new Set<string>(NEXT_ACTIONS.map(a => a.value));
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v ? v : null;

/** Brings a stored record up to the current shape; null if unusable. */
export function normaliseHandover(raw: unknown): HandoverRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, any>;
  const o = (r.officer ?? {}) as Record<string, any>;
  if (
    typeof r.id !== 'string' ||
    typeof r.assessmentId !== 'string' ||
    !PLACE_VALUES.has(r.place) ||
    !ACTION_VALUES.has(r.nextAction) ||
    !str(o.fullName)
  ) {
    return null;
  }
  return {
    id: r.id,
    assessmentId: r.assessmentId,
    interventionsId: strOrNull(r.interventionsId),
    patientKeys: Array.isArray(r.patientKeys)
      ? r.patientKeys.filter((k: unknown) => typeof k === 'string')
      : [],
    patientLabel: str(r.patientLabel),
    recordedAt: str(r.recordedAt),
    recordedBy: str(r.recordedBy),
    place: r.place as Place,
    initiatedAt: str(r.initiatedAt),
    officer: {
      source: o.source === 'MANUAL' ? 'MANUAL' : 'DIRECTORY',
      staffId: strOrNull(o.staffId),
      displayId: str(o.displayId),
      fullName: str(o.fullName),
      rank: str(o.rank),
      unit: str(o.unit),
      roleLabel: str(o.roleLabel),
      designation: str(o.designation),
      dateOfBirth: strOrNull(o.dateOfBirth),
      contactPhone: str(o.contactPhone),
      photo: strOrNull(o.photo),
    },
    nextAction: r.nextAction as NextAction,
    nextActionOther: str(r.nextActionOther),
  };
}

function newId(): string {
  return `HND-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    Math.random() * 1e6,
  )
    .toString(36)
    .toUpperCase()}`;
}

export class HandoverStore {
  constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly history: PatientHistoryStore = getPatientHistoryStore(),
  ) {}

  async list(): Promise<HandoverRecord[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .map(normaliseHandover)
            .filter((r): r is HandoverRecord => r !== null)
        : [];
    } catch {
      return [];
    }
  }

  async findByAssessment(assessmentId: string): Promise<HandoverRecord | null> {
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
      .map(normaliseHandover)
      .filter((r): r is HandoverRecord => r !== null && !ids.has(r.id));
    if (add.length) {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, ...add]));
    }
    return add.length;
  }

  /** The place this tablet last handed over from (pre-selects the next). */
  async lastPlace(): Promise<Place | null> {
    try {
      const v = await this.storage.getItem(LAST_PLACE_KEY);
      return v && PLACE_VALUES.has(v) ? (v as Place) : null;
    } catch {
      return null;
    }
  }

  /** Saves the handover; the evacuation's history entry shows "in transit". */
  async save(
    data: Extract<HandoverValidation, { ok: true }>['value'],
    meta: {
      assessmentId: string;
      interventionsId: string | null;
      patientKeys: string[];
      patientLabel: string;
      recordedBy: string;
    },
  ): Promise<HandoverRecord> {
    const record: HandoverRecord = {
      id: newId(),
      recordedAt: new Date().toISOString(),
      ...meta,
      ...data,
    };
    const all = await this.list();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, record]));
    try {
      await this.storage.setItem(LAST_PLACE_KEY, record.place);
    } catch {
      // Only a convenience for the next handover.
    }

    // Same history entry as the assessment (one evacuation, one entry).
    const existing = await this.history.get(record.assessmentId);
    await this.history.upsert({
      id: record.assessmentId,
      patientKeys: Array.from(
        new Set([...(existing?.patientKeys ?? []), ...record.patientKeys]),
      ),
      at: existing?.at ?? record.recordedAt,
      title: IN_TRANSIT_TITLE,
      detail: [summariseHandover(record), existing?.detail]
        .filter(Boolean)
        .join(' · '),
      recordedBy: existing?.recordedBy ?? record.recordedBy,
    });
    return record;
  }
}

let defaultStore: HandoverStore | null = null;
export function getHandoverStore(): HandoverStore {
  defaultStore ??= new HandoverStore();
  return defaultStore;
}
