/**
 * Patients registered in the field on this tablet — used when a casualty has
 * no wristband, the wristband is unknown to this tablet, or an entered ID is
 * not found. Each gets a temporary casualty ID (TEMP-XXXXXX); an authorised
 * user can link it to the real identity later (after sync — not built yet).
 *
 * Field registrations are never verified: the screen says so wherever they
 * appear. Stored in app-private storage on the tablet.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BloodGroup, RhFactor, Sex } from '../identity/types';

const STORAGE_KEY = 'casevac.fieldPatients.v1';
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface FieldPatientInput {
  fullName: string;
  rank: string;
  /** Free text from the form; whole years 0–120 or blank. */
  age: string;
  sex: Sex;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  unit: string;
}

/** What the medic scanned or typed before registering, kept for later linking. */
export interface FieldLink {
  credentialId?: string;
  patientId?: string;
  enteredId?: string;
}

export interface FieldPatient {
  tempId: string;
  /** null = name unknown (unidentified casualty). */
  fullName: string | null;
  rank: string;
  age: number | null;
  sex: Sex;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  unit: string;
  registeredAt: string;
  /** User ID of the medic who registered the patient. */
  registeredBy: string;
  link: FieldLink;
}

export interface FieldRegistration {
  ok: true;
  method: 'FIELD';
  patient: FieldPatient;
}

export type FieldValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<keyof FieldPatientInput, string>> };

export function validateFieldPatient(
  input: FieldPatientInput,
): FieldValidation {
  const errors: Partial<Record<keyof FieldPatientInput, string>> = {};
  if (input.fullName.trim().length > 100) {
    errors.fullName = 'Name is too long (100 characters max).';
  }
  if (input.rank.trim().length > 40) {
    errors.rank = 'Rank is too long (40 characters max).';
  }
  if (input.unit.trim().length > 80) {
    errors.unit = 'Unit is too long (80 characters max).';
  }
  const age = input.age.trim();
  if (age && (!/^\d{1,3}$/.test(age) || Number(age) > 120)) {
    errors.age = 'Enter age in whole years (0–120), or leave it blank.';
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true };
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function newTempId(): string {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return `TEMP-${id}`;
}

export class FieldRegistry {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  async list(): Promise<FieldPatient[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  async find(tempId: string): Promise<FieldPatient | null> {
    const id = tempId.trim().toUpperCase();
    return (await this.list()).find(p => p.tempId === id) ?? null;
  }

  /** Validates and saves; throws on invalid input (screens validate first). */
  async register(
    input: FieldPatientInput,
    registeredBy: string,
    link: FieldLink = {},
  ): Promise<FieldPatient> {
    const check = validateFieldPatient(input);
    if (!check.ok) {
      throw new Error('Invalid field registration');
    }
    const all = await this.list();
    let tempId = newTempId();
    while (all.some(p => p.tempId === tempId)) {
      tempId = newTempId();
    }
    const age = input.age.trim();
    const patient: FieldPatient = {
      tempId,
      fullName: input.fullName.trim() || null,
      rank: input.rank.trim(),
      age: age ? Number(age) : null,
      sex: input.sex,
      bloodGroup: input.bloodGroup,
      rhFactor: input.rhFactor,
      unit: input.unit.trim(),
      registeredAt: new Date().toISOString(),
      registeredBy,
      link,
    };
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, patient]));
    return patient;
  }
}

let defaultRegistry: FieldRegistry | null = null;
export function getFieldRegistry(): FieldRegistry {
  defaultRegistry ??= new FieldRegistry();
  return defaultRegistry;
}
