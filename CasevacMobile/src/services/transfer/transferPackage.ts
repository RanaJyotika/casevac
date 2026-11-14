/**
 * Casualty handover package — everything the next team's tablet needs to
 * continue care, sealed so only another CASEVAC tablet of the unit can read
 * it and any change in transit is detected.
 *
 * Contents (no photos — the receiving tablet has them from the dashboard):
 *   - patient identity as text (IDs, name, rank, unit, blood group, age)
 *   - this evacuation in full: assessment (4+5), interventions & triage
 *     (6+7), handover (8), prepare evacuation (9)
 *   - the patient's previous history entries from this tablet
 *   - the sending medic (who gave initial care) and this tablet's key
 *
 * Sealing (same for QR and Bluetooth):
 *   JSON → deflate → Ed25519 signature by this tablet (deviceKey)
 *   → XChaCha20-Poly1305 with the unit transfer key (keyId in the header)
 *   → "CVX1.<keyId>.<base64url(nonce ‖ ciphertext)>"
 */
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import {
  getAssessmentStore,
  normaliseAssessment,
  type AssessmentStore,
  type InitialAssessment,
} from '../evacuation/assessment';
import {
  getEvacuationStore,
  normaliseEvacuation,
  type EvacuationRecord,
  type EvacuationStore,
} from '../evacuation/evacuation';
import {
  getHandoverStore,
  normaliseHandover,
  type HandoverRecord,
  type HandoverStore,
} from '../evacuation/handover';
import {
  getInterventionsStore,
  normaliseInterventions,
  type InterventionsRecord,
  type InterventionsStore,
} from '../evacuation/interventions';
import {
  getActiveIdentityDirectory,
  type TransferKey,
} from '../identity/provisioningStore';
import type {
  BloodGroup,
  IdentityDirectory,
  RhFactor,
  Sex,
} from '../identity/types';
import {
  getFieldRegistry,
  type FieldRegistry,
} from '../patients/fieldRegistry';
import {
  getPatientHistoryStore,
  type HistoryEntry,
  type PatientHistoryStore,
} from '../patients/historyStore';
import { decodeBase64Url, encodeBase64Url } from '../qr/base64url';
import type { Clinician, TriageCategory } from '../../types';
import { ageFrom } from '../../utils/format';
import { fingerprint, getDeviceKey, type DeviceKey } from './deviceKey';
import { randomBytes } from './random';

/* --------------------------------- Model --------------------------------- */

export interface TransferPatient {
  /** Every key the patient is known by (UUID, PAT-…, TEMP-…). */
  keys: string[];
  /** Directory UUID when known. */
  patientId: string | null;
  /** PAT-… or TEMP-… */
  displayId: string;
  name: string | null;
  rank: string;
  unit: string;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  sex: Sex;
  dateOfBirth: string | null;
  age: number | null;
  /** Registered by hand in the field (TEMP- ID), not verified. */
  temporary: boolean;
}

export interface TransferSender {
  id: string;
  name: string;
  rank: string;
  team: string;
}

export interface TransferPackage {
  format: 'casevac.transfer';
  v: 1;
  transferId: string;
  createdAt: string;
  sender: TransferSender;
  /** This tablet's Ed25519 public key (base64url); signs the package. */
  senderKey: string;
  patient: TransferPatient;
  evacuation: {
    assessment: InitialAssessment;
    interventions: InterventionsRecord | null;
    handover: HandoverRecord | null;
    evacuation: EvacuationRecord | null;
  };
  /** The patient's history entries on the sending tablet. */
  history: HistoryEntry[];
}

/** What the receiving medic sees before accepting. */
export interface TransferSummary {
  transferId: string;
  patientLabel: string;
  patientId: string;
  triage: TriageCategory | null;
  sender: TransferSender;
  /** Fingerprint of the sending tablet's key, e.g. "3F9A-0C21". */
  senderDevice: string;
  handedOver: boolean;
  /** Location of injury codes (e.g. "THR-F"), shown with their meaning. */
  injuryLocations: string[];
}

export type TransferErrorCode =
  | 'NO_KEY'
  | 'NOT_CASEVAC'
  | 'WRONG_UNIT_KEY'
  | 'NOT_AUTHENTIC'
  | 'BAD_SIGNATURE'
  | 'MALFORMED'
  | 'NO_RECORD';

export class TransferError extends Error {
  constructor(public readonly code: TransferErrorCode, message: string) {
    super(message);
  }
}

const PREFIX = 'CVX1';
const MAX_ENVELOPE = 400_000;

/* ------------------------------- Building ------------------------------- */

export interface PackageSources {
  assessments?: AssessmentStore;
  interventions?: InterventionsStore;
  handovers?: HandoverStore;
  evacuations?: EvacuationStore;
  history?: PatientHistoryStore;
  directory?: IdentityDirectory;
  fieldRegistry?: FieldRegistry;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** "Name (ID)" as stored on records → name and ID. */
export function parsePatientLabel(label: string): {
  name: string | null;
  id: string | null;
} {
  const match = /^(.*) \(([^()]*)\)$/.exec(label.trim());
  if (!match) {
    return { name: label.trim() || null, id: null };
  }
  const name = match[1].trim();
  return {
    name: name && name !== 'Unidentified casualty' ? name : null,
    id: match[2].trim() || null,
  };
}

/** Patient identity as text, from this tablet's directory or field registry. */
export async function resolvePatient(
  keys: string[],
  label: string,
  sources: PackageSources = {},
): Promise<TransferPatient> {
  const directory = sources.directory ?? getActiveIdentityDirectory();
  const parsed = parsePatientLabel(label);
  for (const key of keys) {
    const k = key.trim();
    const found = UUID.test(k.toLowerCase())
      ? await directory.findPatient(k.toLowerCase())
      : /^PAT-/i.test(k)
      ? await directory.findPatientByDisplayId(k)
      : null;
    if (found) {
      return {
        keys,
        patientId: found.patientId,
        displayId: found.displayId,
        name: found.fullName,
        rank: found.rank,
        unit: found.unit,
        bloodGroup: found.bloodGroup,
        rhFactor: found.rhFactor,
        sex: found.sex,
        dateOfBirth: found.dateOfBirth,
        age: ageFrom(found.dateOfBirth),
        temporary: false,
      };
    }
  }
  const tempId = keys.find(k => /^TEMP-/i.test(k));
  const field = tempId
    ? await (sources.fieldRegistry ?? getFieldRegistry()).find(tempId)
    : null;
  if (field) {
    return {
      keys,
      patientId: null,
      displayId: field.tempId,
      name: field.fullName,
      rank: field.rank,
      unit: field.unit,
      bloodGroup: field.bloodGroup,
      rhFactor: field.rhFactor,
      sex: field.sex,
      dateOfBirth: null,
      age: field.age,
      temporary: true,
    };
  }
  const displayId = (
    keys.find(k => /^(PAT|TEMP)-/i.test(k)) ??
    parsed.id ??
    keys[0] ??
    'UNKNOWN'
  ).toUpperCase();
  return {
    keys,
    patientId: keys.find(k => UUID.test(k.toLowerCase())) ?? null,
    displayId,
    name: parsed.name,
    rank: '',
    unit: '',
    bloodGroup: 'UNKNOWN',
    rhFactor: 'UNKNOWN',
    sex: 'NOT_RECORDED',
    dateOfBirth: null,
    age: null,
    temporary: displayId.startsWith('TEMP-'),
  };
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/** Collects one evacuation (by its assessment) into a package. */
export async function buildTransferPackage(
  assessmentId: string,
  sender: Clinician,
  sources: PackageSources = {},
): Promise<TransferPackage> {
  const assessment = await (sources.assessments ?? getAssessmentStore()).get(
    assessmentId,
  );
  if (!assessment) {
    throw new TransferError(
      'NO_RECORD',
      'This evacuation is not saved on this tablet.',
    );
  }
  const [interventions, handover, evacuation] = await Promise.all([
    (sources.interventions ?? getInterventionsStore()).findByAssessment(
      assessmentId,
    ),
    (sources.handovers ?? getHandoverStore()).findByAssessment(assessmentId),
    (sources.evacuations ?? getEvacuationStore()).findByAssessment(
      assessmentId,
    ),
  ]);
  const history = await (sources.history ?? getPatientHistoryStore()).listFor(
    assessment.patientKeys,
  );
  const device = await getDeviceKey();
  return {
    format: 'casevac.transfer',
    v: 1,
    transferId: hex(await randomBytes(8)),
    createdAt: new Date().toISOString(),
    sender: {
      id: sender.id,
      name: sender.displayName,
      rank: sender.rank ?? '',
      team: sender.team ?? '',
    },
    senderKey: encodeBase64Url(device.publicKey),
    patient: await resolvePatient(
      assessment.patientKeys,
      assessment.patientLabel,
      sources,
    ),
    evacuation: {
      assessment,
      interventions,
      // Photos stay on the tablets; the receiver looks them up by ID.
      handover: handover
        ? { ...handover, officer: { ...handover.officer, photo: null } }
        : null,
      evacuation,
    },
    history,
  };
}

export function summarise(pkg: TransferPackage): TransferSummary {
  const e = pkg.evacuation;
  return {
    transferId: pkg.transferId,
    patientLabel: `${pkg.patient.name ?? 'Unidentified casualty'} (${
      pkg.patient.displayId
    })`,
    patientId: pkg.patient.displayId,
    triage:
      e.evacuation?.condition ??
      e.interventions?.triage.category ??
      e.assessment.incident.status ??
      null,
    sender: pkg.sender,
    senderDevice: fingerprint(
      decodeBase64Url(pkg.senderKey) ?? new Uint8Array(),
    ),
    handedOver: e.evacuation !== null,
    injuryLocations: e.interventions?.injuryLocations ?? [],
  };
}

/* ---------------------------- Seal and open ---------------------------- */

const aad = (keyId: string) => strToU8(`${PREFIX}.${keyId}`);

export async function sealPackage(
  pkg: TransferPackage,
  unitKey: TransferKey | null,
  device?: DeviceKey,
): Promise<string> {
  if (!unitKey) {
    throw new TransferError(
      'NO_KEY',
      'This tablet has no unit transfer key. Sign in online once to download it.',
    );
  }
  const signer = device ?? (await getDeviceKey());
  const compressed = deflateSync(strToU8(JSON.stringify(pkg)), { level: 9 });
  const signature = ed25519.sign(compressed, signer.secretKey);
  const inner = new Uint8Array(signature.length + compressed.length);
  inner.set(signature, 0);
  inner.set(compressed, signature.length);
  const nonce = await randomBytes(24);
  const cipher = xchacha20poly1305(unitKey.key, nonce, aad(unitKey.keyId));
  const sealed = cipher.encrypt(inner);
  const body = new Uint8Array(nonce.length + sealed.length);
  body.set(nonce, 0);
  body.set(sealed, nonce.length);
  return `${PREFIX}.${unitKey.keyId}.${encodeBase64Url(body)}`;
}

export function isTransferEnvelope(text: string): boolean {
  return text.startsWith(`${PREFIX}.`);
}

/** Decrypts, verifies and parses a sealed package. Throws TransferError. */
export function openPackage(
  envelope: string,
  unitKey: TransferKey | null,
): TransferPackage {
  if (!unitKey) {
    throw new TransferError(
      'NO_KEY',
      'This tablet has no unit transfer key. Sign in online once to download it.',
    );
  }
  const parts = envelope.trim().split('.');
  if (
    parts.length !== 3 ||
    parts[0] !== PREFIX ||
    envelope.length > MAX_ENVELOPE
  ) {
    throw new TransferError(
      'NOT_CASEVAC',
      'This is not a Jeewan patient transfer.',
    );
  }
  const [, keyId, data] = parts;
  if (keyId !== unitKey.keyId) {
    throw new TransferError(
      'WRONG_UNIT_KEY',
      `This record was sealed with unit key “${keyId}”, but this tablet has “${unitKey.keyId}”. Sign in online on both tablets so they share the same unit key.`,
    );
  }
  const body = decodeBase64Url(data);
  if (!body || body.length < 24 + 16 + 64) {
    throw new TransferError('MALFORMED', 'The transfer is incomplete.');
  }
  let inner: Uint8Array;
  try {
    inner = xchacha20poly1305(
      unitKey.key,
      body.subarray(0, 24),
      aad(keyId),
    ).decrypt(body.subarray(24));
  } catch {
    throw new TransferError(
      'NOT_AUTHENTIC',
      'This transfer could not be verified — it was damaged or did not come from a Jeewan tablet of this unit.',
    );
  }
  const signature = inner.subarray(0, 64);
  const compressed = inner.subarray(64);
  let pkg: TransferPackage;
  try {
    pkg = JSON.parse(strFromU8(inflateSync(compressed))) as TransferPackage;
  } catch {
    throw new TransferError('MALFORMED', 'The transfer could not be read.');
  }
  if (
    !pkg ||
    pkg.format !== 'casevac.transfer' ||
    pkg.v !== 1 ||
    typeof pkg.transferId !== 'string' ||
    !pkg.patient ||
    !pkg.sender ||
    !pkg.evacuation ||
    !normaliseAssessment(pkg.evacuation.assessment)
  ) {
    throw new TransferError(
      'MALFORMED',
      'The transfer does not contain a casualty record.',
    );
  }
  const publicKey = decodeBase64Url(pkg.senderKey ?? '');
  let valid = false;
  try {
    valid =
      !!publicKey &&
      publicKey.length === 32 &&
      ed25519.verify(signature, compressed, publicKey);
  } catch {
    valid = false;
  }
  if (!valid) {
    throw new TransferError(
      'BAD_SIGNATURE',
      'The sending tablet’s signature does not match — the record may have been altered.',
    );
  }
  // Re-shape every record through the same checks as local storage.
  return {
    ...pkg,
    evacuation: {
      assessment: normaliseAssessment(pkg.evacuation.assessment)!,
      interventions: normaliseInterventions(pkg.evacuation.interventions),
      handover: normaliseHandover(pkg.evacuation.handover),
      evacuation: normaliseEvacuation(pkg.evacuation.evacuation),
    },
    history: Array.isArray(pkg.history)
      ? pkg.history.filter(
          h =>
            h &&
            typeof h.id === 'string' &&
            typeof h.title === 'string' &&
            Array.isArray(h.patientKeys),
        )
      : [],
  };
}
