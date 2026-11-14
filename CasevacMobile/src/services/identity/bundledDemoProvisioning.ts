/**
 * DEMO PROVISIONING — bundled, unencrypted, fictional records only.
 *
 * Loads src/provisioning/*.json (written by the dashboard's
 * `npm run mobile:provision`). These files are NOT authoritative production
 * data and NOT a secure provisioning channel: anyone who can rebuild the app
 * can change them. Production requires device enrolment, an authenticated
 * download and encrypted storage (see admin-dashboard/INTEGRATION.md).
 *
 * Input is validated defensively: malformed entries are dropped, never
 * guessed, so a bad file results in "unknown issuer" / "details unavailable"
 * rather than a wrong identity.
 */
import directoryJson from '../../provisioning/demo-identity-directory.json';
import trustedKeysJson from '../../provisioning/trusted-issuer-keys.json';
import { decodeBase64Url } from '../qr/base64url';
import type {
  BloodGroup,
  CredentialRecord,
  CredentialStatus,
  DirectoryInfo,
  IdentityDirectory,
  PatientIdentity,
  RhFactor,
  Sex,
  StaffMember,
  TrustedIssuerKey,
  TrustStore,
} from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KEY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const STATUSES: CredentialStatus[] = ['ACTIVE', 'REVOKED', 'REPLACED'];
const BLOOD: BloodGroup[] = ['UNKNOWN', 'A', 'B', 'AB', 'O'];
const RH: RhFactor[] = ['UNKNOWN', 'POSITIVE', 'NEGATIVE'];
const SEX: Sex[] = ['NOT_RECORDED', 'MALE', 'FEMALE'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Accept only small JPEG data URLs; anything else is dropped, never shown. */
const PHOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;
const PHOTO_MAX_LENGTH = 80_000;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/* ----------------------------- Trust store ----------------------------- */

export function parseTrustedKeys(json: unknown): TrustedIssuerKey[] {
  if (!isObject(json) || json.format !== 'casevac.trusted-issuer-keys') {
    return [];
  }
  const keys: TrustedIssuerKey[] = [];
  for (const entry of list(json.keys)) {
    if (!isObject(entry) || entry.algorithm !== 'Ed25519') {
      continue;
    }
    const keyId = str(entry.keyId);
    const issuer = str(entry.issuer);
    const raw = str(entry.publicKey);
    const publicKey = raw ? decodeBase64Url(raw) : null;
    if (!keyId || !KEY_ID.test(keyId) || !issuer || publicKey?.length !== 32) {
      continue;
    }
    keys.push({ keyId, issuer, algorithm: 'Ed25519', publicKey });
  }
  return keys;
}

export class StaticTrustStore implements TrustStore {
  private readonly byId: Map<string, TrustedIssuerKey>;
  constructor(keys: TrustedIssuerKey[]) {
    this.byId = new Map(keys.map(k => [k.keyId, k]));
  }
  async findKey(keyId: string) {
    return this.byId.get(keyId) ?? null;
  }
  async listKeyIds() {
    return [...this.byId.keys()];
  }
}

/* ------------------------------ Directory ------------------------------ */

export interface ParsedDirectory {
  generatedAt: string | null;
  patients: PatientIdentity[];
  credentials: CredentialRecord[];
  /** Clinicians for handover; absent in directories made before staff. */
  staff?: StaffMember[];
}

function parseStaff(json: Json): StaffMember[] {
  const staff: StaffMember[] = [];
  for (const s of list(json.staff)) {
    if (!isObject(s)) {
      continue;
    }
    const staffId = str(s.staffId);
    const displayId = str(s.displayId);
    const fullName = str(s.fullName);
    if (!staffId || !displayId || !fullName) {
      continue;
    }
    const dob = str(s.dateOfBirth);
    const photo = str(s.photo);
    staff.push({
      staffId,
      displayId,
      fullName,
      rank: str(s.rank) ?? '',
      unit: str(s.unit) ?? '',
      role: str(s.role) ?? '',
      roleLabel: str(s.roleLabel) ?? '',
      designation: str(s.designation) ?? '',
      dateOfBirth: dob && ISO_DATE.test(dob) ? dob : null,
      contactPhone: str(s.contactPhone) ?? '',
      photo:
        photo && photo.length <= PHOTO_MAX_LENGTH && PHOTO.test(photo)
          ? photo
          : null,
    });
  }
  return staff;
}

export function parseDirectory(json: unknown): ParsedDirectory {
  if (
    !isObject(json) ||
    json.format !== 'casevac.identity-directory' ||
    json.formatVersion !== 2
  ) {
    return { generatedAt: null, patients: [], credentials: [] };
  }
  const patients: PatientIdentity[] = [];
  for (const p of list(json.patients)) {
    if (!isObject(p)) {
      continue;
    }
    const patientId = str(p.patientId);
    const displayId = str(p.displayId);
    const fullName = str(p.fullName);
    if (!patientId || !UUID.test(patientId) || !displayId || !fullName) {
      continue;
    }
    const blood = str(p.bloodGroup) as BloodGroup;
    const rh = str(p.rhFactor) as RhFactor;
    const sex = str(p.sex) as Sex;
    const dob = str(p.dateOfBirth);
    const photo = str(p.photo);
    patients.push({
      patientId,
      displayId,
      fullName,
      rank: str(p.rank) ?? '',
      unit: str(p.unit) ?? '',
      bloodGroup: BLOOD.includes(blood) ? blood : 'UNKNOWN',
      rhFactor: RH.includes(rh) ? rh : 'UNKNOWN',
      sex: SEX.includes(sex) ? sex : 'NOT_RECORDED',
      dateOfBirth: dob && ISO_DATE.test(dob) ? dob : null,
      photo:
        photo && photo.length <= PHOTO_MAX_LENGTH && PHOTO.test(photo)
          ? photo
          : null,
    });
  }
  const credentials: CredentialRecord[] = [];
  for (const c of list(json.credentials)) {
    if (!isObject(c)) {
      continue;
    }
    const credentialId = str(c.credentialId);
    const patientId = str(c.patientId);
    const keyId = str(c.keyId);
    const status = str(c.status) as CredentialStatus;
    const version = c.credentialVersion;
    const issuedAt = str(c.issuedAt);
    if (
      !credentialId ||
      !UUID.test(credentialId) ||
      !patientId ||
      !UUID.test(patientId) ||
      !keyId ||
      !STATUSES.includes(status) ||
      typeof version !== 'number' ||
      !Number.isInteger(version) ||
      !issuedAt
    ) {
      continue;
    }
    credentials.push({
      credentialId,
      patientId,
      keyId,
      credentialVersion: version,
      status,
      issuedAt,
      revokedAt: str(c.revokedAt),
    });
  }
  return {
    generatedAt: str(json.generatedAt),
    patients,
    credentials,
    staff: parseStaff(json),
  };
}

export class StaticIdentityDirectory implements IdentityDirectory {
  private readonly credentials: Map<string, CredentialRecord>;
  private readonly patients: Map<string, PatientIdentity>;
  private readonly byDisplayId: Map<string, PatientIdentity>;
  constructor(
    private readonly data: ParsedDirectory,
    private readonly source: DirectoryInfo['source'] = 'DEMO_BUNDLED',
  ) {
    this.credentials = new Map(data.credentials.map(c => [c.credentialId, c]));
    this.patients = new Map(data.patients.map(p => [p.patientId, p]));
    this.byDisplayId = new Map(
      data.patients.map(p => [p.displayId.toUpperCase(), p]),
    );
  }
  async info(): Promise<DirectoryInfo> {
    return {
      source: this.source,
      generatedAt: this.data.generatedAt,
      patientCount: this.patients.size,
      credentialCount: this.credentials.size,
    };
  }
  async findCredential(credentialId: string) {
    return this.credentials.get(credentialId) ?? null;
  }
  async findPatient(patientId: string) {
    return this.patients.get(patientId) ?? null;
  }
  async findPatientByDisplayId(displayId: string) {
    return this.byDisplayId.get(displayId.trim().toUpperCase()) ?? null;
  }
  async searchStaff(query: string, limit = 20): Promise<StaffMember[]> {
    const words = query.trim().toUpperCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return [];
    }
    return (this.data.staff ?? [])
      .filter(s => {
        const haystack = `${s.fullName} ${s.displayId}`.toUpperCase();
        return words.every(w => haystack.includes(w));
      })
      .sort(
        (a, b) =>
          Number(b.role === 'MEDICAL_OFFICER') -
          Number(a.role === 'MEDICAL_OFFICER'),
      )
      .slice(0, limit);
  }
  async staffCount() {
    return this.data.staff?.length ?? 0;
  }
}

/* --------------------------- Bundled defaults -------------------------- */

let trustStore: TrustStore | null = null;
let directory: IdentityDirectory | null = null;

export function getBundledTrustStore(): TrustStore {
  trustStore ??= new StaticTrustStore(parseTrustedKeys(trustedKeysJson));
  return trustStore;
}

export function getBundledIdentityDirectory(): IdentityDirectory {
  directory ??= new StaticIdentityDirectory(parseDirectory(directoryJson));
  return directory;
}
