/**
 * Interventions & Triage (client screens 6 + 7, combined) — form model,
 * validation, storage.
 *
 * Opens after the casualty assessment is saved. Records what the medic did
 * (bleeding control, airway, breathing, splinting, oxygen, medication) and
 * the decision taken (triage priority, provisional diagnosis). The triage
 * starts from the status recorded in the assessment; both are kept, so a
 * re-triage after treatment stays visible.
 *
 * Saved on this tablet and summarised in the patient's previous history.
 * Only the triage priority is required — everything else may be left blank:
 * an incomplete record now is worth more than a complete one late.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TriageCategory } from '../../types';
import {
  getPatientHistoryStore,
  type PatientHistoryStore,
} from '../patients/historyStore';
import { formatTime12, type KeyValueStorage } from './assessment';
import {
  describeInjuryCode,
  isInjuryCode,
  sortInjuryCodes,
} from './injuryLocations';

/* --------------------------------- Model --------------------------------- */

export type YesNo = 'YES' | 'NO';
export type YesNoNa = 'YES' | 'NO' | 'NA';

export const BLEEDING_METHODS = [
  'Direct pressure',
  'Tourniquet',
  'Pressure bandage',
  'Wound packing',
  'Other',
] as const;
export type BleedingMethod = (typeof BLEEDING_METHODS)[number];

/** Priority as printed on AFMSF-21: 1 RED · 2 YELLOW · 3 GREEN (BLACK 4). */
export const TRIAGE_PRIORITY: Record<TriageCategory, number> = {
  RED: 1,
  YELLOW: 2,
  GREEN: 3,
  BLACK: 4,
};
export const TRIAGE_ORDER: TriageCategory[] = [
  'RED',
  'YELLOW',
  'GREEN',
  'BLACK',
];

export interface MedicationRow {
  name: string;
  dose: string;
  /** HH:mm or null */
  time: string | null;
}

export const EMPTY_MEDICATION: MedicationRow = {
  name: '',
  dose: '',
  time: null,
};

/** What the screen edits. */
export interface InterventionsForm {
  bleedingControl: YesNo | null;
  bleedingMethods: BleedingMethod[];
  bleedingOther: string;
  /** HH:mm — time the tourniquet was applied. */
  tourniquetTime: string | null;
  airway: YesNo | null;
  breathing: YesNo | null;
  splinting: YesNo | null;
  oxygen: YesNoNa | null;
  medication: YesNo | null;
  medications: MedicationRow[];
  triage: TriageCategory | null;
  /** Location of injury codes from the body diagram, e.g. "THR-F". */
  injuryLocations: string[];
  provisionalDiagnosis: string;
  remarks: string;
}

export function emptyInterventions(
  initialStatus: TriageCategory | null = null,
): InterventionsForm {
  return {
    bleedingControl: null,
    bleedingMethods: [],
    bleedingOther: '',
    tourniquetTime: null,
    airway: null,
    breathing: null,
    splinting: null,
    oxygen: null,
    medication: null,
    medications: [],
    triage: initialStatus,
    injuryLocations: [],
    provisionalDiagnosis: '',
    remarks: '',
  };
}

/** Saved record. Yes/No answers left blank are stored as null. */
export interface InterventionsRecord {
  id: string;
  /** The assessment this follows, when known. */
  assessmentId: string | null;
  patientKeys: string[];
  patientLabel: string;
  recordedAt: string;
  recordedBy: string;
  interventions: {
    bleedingControl: boolean | null;
    /** "Other" is replaced by its description. */
    bleedingMethods: string[];
    tourniquetTime: string | null;
    airway: boolean | null;
    breathing: boolean | null;
    splinting: boolean | null;
    oxygen: YesNoNa | null;
    medicationGiven: boolean | null;
    medications: MedicationRow[];
  };
  triage: {
    /** Status recorded in the assessment, before interventions. */
    initialStatus: TriageCategory | null;
    category: TriageCategory;
    provisionalDiagnosis: string;
  };
  /**
   * Location of injury codes, e.g. "THR-F" = right thigh (front); see
   * injuryLocations.ts. Sent as codes in the handover package; the
   * receiving tablet shows each code with its meaning.
   */
  injuryLocations: string[];
  remarks: string;
}

/* ------------------------------ Validation ------------------------------ */

export type InterventionsErrors = Partial<
  Record<keyof InterventionsForm, string>
> & {
  /** Per medication row, by index. */
  medicationRows?: Record<number, string>;
};

export type InterventionsValidation =
  | {
      ok: true;
      value: Pick<
        InterventionsRecord,
        'interventions' | 'injuryLocations' | 'remarks'
      > & {
        triage: Omit<InterventionsRecord['triage'], 'initialStatus'>;
      };
    }
  | { ok: false; errors: InterventionsErrors };

const yesNo = (v: YesNo | null) => (v === null ? null : v === 'YES');

export function validateInterventions(
  form: InterventionsForm,
): InterventionsValidation {
  const errors: InterventionsErrors = {};
  const bleeding = form.bleedingControl === 'YES';

  if (
    bleeding &&
    form.bleedingMethods.includes('Other') &&
    !form.bleedingOther.trim()
  ) {
    errors.bleedingOther = 'Describe the bleeding-control method.';
  }

  const meds =
    form.medication === 'YES'
      ? form.medications.filter(m => m.name.trim() || m.dose.trim() || m.time)
      : [];
  const rowErrors: Record<number, string> = {};
  if (form.medication === 'YES') {
    form.medications.forEach((m, i) => {
      if (!m.name.trim() && (m.dose.trim() || m.time)) {
        rowErrors[i] = 'Enter the medicine name.';
      }
    });
  }
  if (Object.keys(rowErrors).length) {
    errors.medicationRows = rowErrors;
  }
  if (form.medication === 'YES' && meds.length === 0) {
    errors.medications = 'Enter the medicine given, or answer No.';
  }

  if (!form.triage) {
    errors.triage = 'Select the casualty’s triage priority.';
  }

  if (Object.keys(errors).length || !form.triage) {
    return { ok: false, errors };
  }

  const tourniquet = bleeding && form.bleedingMethods.includes('Tourniquet');
  return {
    ok: true,
    value: {
      interventions: {
        bleedingControl: yesNo(form.bleedingControl),
        bleedingMethods: bleeding
          ? BLEEDING_METHODS.filter(m => form.bleedingMethods.includes(m)).map(
              m => (m === 'Other' ? form.bleedingOther.trim() : m),
            )
          : [],
        tourniquetTime: tourniquet ? form.tourniquetTime : null,
        airway: yesNo(form.airway),
        breathing: yesNo(form.breathing),
        splinting: yesNo(form.splinting),
        oxygen: form.oxygen,
        medicationGiven: yesNo(form.medication),
        medications: meds.map(m => ({
          name: m.name.trim(),
          dose: m.dose.trim(),
          time: m.time,
        })),
      },
      triage: {
        category: form.triage,
        provisionalDiagnosis: form.provisionalDiagnosis.trim(),
      },
      // Drafts saved before this field existed have no list.
      injuryLocations: sortInjuryCodes(
        (form.injuryLocations ?? []).filter(isInjuryCode),
      ),
      remarks: form.remarks.trim(),
    },
  };
}

/** One-line summary for the patient's history list. */
export function summariseInterventions(r: InterventionsRecord): string {
  const parts: string[] = [
    `${r.triage.category} (priority ${TRIAGE_PRIORITY[r.triage.category]})`,
  ];
  const i = r.interventions;
  if (i.bleedingMethods.length) {
    parts.push(
      i.bleedingMethods
        .map(m =>
          m === 'Tourniquet' && i.tourniquetTime
            ? `Tourniquet ${formatTime12(i.tourniquetTime)}`
            : m,
        )
        .join(', '),
    );
  }
  const done = [
    i.airway && 'Airway',
    i.breathing && 'Breathing',
    i.splinting && 'Splint',
    i.oxygen === 'YES' && 'O₂',
  ].filter(Boolean);
  if (done.length) {
    parts.push(done.join(', '));
  }
  if (i.medications.length) {
    parts.push(
      i.medications
        .map(m => (m.dose ? `${m.name} ${m.dose}` : m.name))
        .join(', '),
    );
  }
  if (r.injuryLocations.length) {
    const shown = r.injuryLocations
      .slice(0, 3)
      .map(c => describeInjuryCode(c) ?? c);
    const more = r.injuryLocations.length - shown.length;
    parts.push(
      `Injury: ${shown.join(', ')}${more > 0 ? ` +${more} more` : ''}`,
    );
  }
  if (r.triage.provisionalDiagnosis) {
    parts.push(`Dx: ${r.triage.provisionalDiagnosis}`);
  }
  return parts.join(' · ');
}

/* -------------------------------- Storage -------------------------------- */

const STORAGE_KEY = 'casevac.interventions.v1';

/** History title once an evacuation has both its assessment and triage. */
export const EVACUATION_TITLE = 'Assessment, interventions & triage';
const CATEGORIES = new Set<string>(TRIAGE_ORDER);

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v ? v : null;
const boolOrNull = (v: unknown): boolean | null =>
  typeof v === 'boolean' ? v : null;
const triageOrNull = (v: unknown): TriageCategory | null =>
  typeof v === 'string' && CATEGORIES.has(v) ? (v as TriageCategory) : null;

/** Brings a stored record up to the current shape; null if unusable. */
export function normaliseInterventions(
  raw: unknown,
): InterventionsRecord | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const r = raw as Record<string, any>;
  const triage = (r.triage ?? {}) as Record<string, any>;
  const category = triageOrNull(triage.category);
  if (typeof r.id !== 'string' || !category) {
    return null;
  }
  const i = (r.interventions ?? {}) as Record<string, any>;
  return {
    id: r.id,
    assessmentId: strOrNull(r.assessmentId),
    patientKeys: Array.isArray(r.patientKeys)
      ? r.patientKeys.filter((k: unknown) => typeof k === 'string')
      : [],
    patientLabel: str(r.patientLabel),
    recordedAt: str(r.recordedAt),
    recordedBy: str(r.recordedBy),
    interventions: {
      bleedingControl: boolOrNull(i.bleedingControl),
      bleedingMethods: Array.isArray(i.bleedingMethods)
        ? i.bleedingMethods.filter((m: unknown) => typeof m === 'string' && m)
        : [],
      tourniquetTime: strOrNull(i.tourniquetTime),
      airway: boolOrNull(i.airway),
      breathing: boolOrNull(i.breathing),
      splinting: boolOrNull(i.splinting),
      oxygen: ['YES', 'NO', 'NA'].includes(i.oxygen)
        ? (i.oxygen as YesNoNa)
        : null,
      medicationGiven: boolOrNull(i.medicationGiven),
      medications: Array.isArray(i.medications)
        ? i.medications
            .filter((m: unknown) => m && typeof m === 'object')
            .map((m: Record<string, unknown>) => ({
              name: str(m.name),
              dose: str(m.dose),
              time: strOrNull(m.time),
            }))
            .filter((m: MedicationRow) => m.name)
        : [],
    },
    triage: {
      initialStatus: triageOrNull(triage.initialStatus),
      category,
      provisionalDiagnosis: str(triage.provisionalDiagnosis),
    },
    injuryLocations: Array.isArray(r.injuryLocations)
      ? sortInjuryCodes(r.injuryLocations.filter(isInjuryCode))
      : [],
    remarks: str(r.remarks),
  };
}

function newId(): string {
  return `INT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
    Math.random() * 1e6,
  )
    .toString(36)
    .toUpperCase()}`;
}

export class InterventionsStore {
  constructor(
    private readonly storage: KeyValueStorage = AsyncStorage,
    private readonly history: PatientHistoryStore = getPatientHistoryStore(),
  ) {}

  async list(): Promise<InterventionsRecord[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .map(normaliseInterventions)
            .filter((r): r is InterventionsRecord => r !== null)
        : [];
    } catch {
      return [];
    }
  }

  async get(id: string): Promise<InterventionsRecord | null> {
    return (await this.list()).find(r => r.id === id) ?? null;
  }

  /** Adds records received from another tablet (original IDs kept). */
  async importRecords(records: unknown[]): Promise<number> {
    const all = await this.list();
    const ids = new Set(all.map(r => r.id));
    const add = records
      .map(normaliseInterventions)
      .filter((r): r is InterventionsRecord => r !== null && !ids.has(r.id));
    if (add.length) {
      await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, ...add]));
    }
    return add.length;
  }

  /** The latest interventions recorded after the given assessment. */
  async findByAssessment(
    assessmentId: string,
  ): Promise<InterventionsRecord | null> {
    const matches = (await this.list()).filter(
      r => r.assessmentId === assessmentId,
    );
    return matches.length ? matches[matches.length - 1] : null;
  }

  /** Saves the record and adds it to the patient's history. */
  async save(
    data: Extract<InterventionsValidation, { ok: true }>['value'],
    meta: {
      assessmentId: string | null;
      initialStatus: TriageCategory | null;
      patientKeys: string[];
      patientLabel: string;
      recordedBy: string;
    },
  ): Promise<InterventionsRecord> {
    const { initialStatus, ...rest } = meta;
    const record: InterventionsRecord = {
      id: newId(),
      recordedAt: new Date().toISOString(),
      ...rest,
      interventions: data.interventions,
      triage: { initialStatus, ...data.triage },
      injuryLocations: data.injuryLocations,
      remarks: data.remarks,
    };
    const all = await this.list();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, record]));

    // One evacuation, one history entry: extend the assessment's entry so
    // the patient's history opens the whole record (4 + 5 and 6 + 7).
    const existing = record.assessmentId
      ? await this.history.get(record.assessmentId)
      : null;
    if (existing) {
      await this.history.upsert({
        ...existing,
        patientKeys: Array.from(
          new Set([...existing.patientKeys, ...record.patientKeys]),
        ),
        title: EVACUATION_TITLE,
        detail: [summariseInterventions(record), existing.detail]
          .filter(Boolean)
          .join(' · '),
      });
    } else {
      await this.history.add({
        id: record.id,
        patientKeys: record.patientKeys,
        at: record.recordedAt,
        title: 'Interventions & triage',
        detail: summariseInterventions(record),
        recordedBy: record.recordedBy,
      });
    }
    return record;
  }
}

let defaultStore: InterventionsStore | null = null;
export function getInterventionsStore(): InterventionsStore {
  defaultStore ??= new InterventionsStore();
  return defaultStore;
}
