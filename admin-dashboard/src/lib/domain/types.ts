/**
 * CASEVAC admin domain model.
 *
 * Identity concepts (CASEVAC_DOCS/PROJECT_OVERVIEW.md §5):
 * - Person: an enrolled individual. `id` is a random internal UUID; `displayId`
 *   (PAT-00001, MED-00001 …) is a human-readable admin reference.
 * - IdentityCredential: a QR (now) or NFC (future) token mapped to a Person.
 *   Tokens are random and opaque, can be revoked/replaced, and never carry
 *   personal or clinical data.
 * - Evacuation incidents and clinical events belong to the mobile app and are
 *   deliberately NOT modelled here.
 */

export type RecordStatus = "ACTIVE" | "INACTIVE";

export type PersonCategory = "SOLDIER" | "MEDIC" | "DOCTOR" | "STAFF";

export type Sex = "NOT_RECORDED" | "MALE" | "FEMALE";
export type BloodGroup = "UNKNOWN" | "A" | "B" | "AB" | "O";
export type RhFactor = "UNKNOWN" | "POSITIVE" | "NEGATIVE";

export type RoleId =
  | "MEDIC"
  | "MEDICAL_OFFICER"
  | "TEAM_LEADER"
  | "EVAC_TEAM_MEMBER"
  | "ADMIN_OFFICER"
  | "SYSTEM_ADMIN";

export interface NextOfKin {
  name: string;
  relationship: string;
  phone: string;
}

export interface SoldierDetails {
  /** ISO date (YYYY-MM-DD) or null when not recorded. */
  dateOfBirth: string | null;
  sex: Sex;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  medicalCategory: string;
  identificationMarks: string;
  nextOfKin: NextOfKin;
}

export interface StaffDetails {
  role: RoleId;
  designation: string;
  professionalRegistration: string;
}

interface PersonBase {
  /** Random internal UUID. Never shown on wristbands. */
  id: string;
  /** Human-readable admin reference, e.g. PAT-00001. */
  displayId: string;
  fullName: string;
  /** Normalised (trimmed, upper-case). Unique across all persons. */
  serviceNumber: string;
  rank: string;
  unit: string;
  contactPhone: string;
  status: RecordStatus;
  registeredAt: string;
  updatedAt: string;
  registeredBy: string;
}

export interface SoldierRecord extends PersonBase {
  category: "SOLDIER";
  soldier: SoldierDetails;
}

export interface StaffRecord extends PersonBase {
  category: "MEDIC" | "DOCTOR" | "STAFF";
  staff: StaffDetails;
}

export type PersonRecord = SoldierRecord | StaffRecord;

/** QR today; NFC reserved for future wristbands using the same Person identity. */
export type IdentityMethod = "QR" | "NFC";

export type CredentialStatus = "ACTIVE" | "REVOKED" | "REPLACED";

export interface IdentityCredential {
  id: string;
  personId: string;
  method: IdentityMethod;
  /** Version of the payload format (see lib/domain/qr-format.ts). */
  formatVersion: 1;
  /** 128-bit random, base64url. Opaque; maps to exactly one Person. */
  token: string;
  /** Exact string encoded into the QR. */
  payload: string;
  /** Per-person issue sequence: 1, 2, 3 … */
  version: number;
  status: CredentialStatus;
  issuedAt: string;
  issuedBy: string;
  wristbandIssuedAt: string | null;
  wristbandIssuedBy: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  replacedByCredentialId: string | null;
  printCount: number;
  lastPrintedAt: string | null;
}

export interface MedicalTeam {
  id: string;
  /** Human-readable team reference, e.g. TEAM-001. */
  teamCode: string;
  name: string;
  unit: string;
  description: string;
  leaderId: string | null;
  memberIds: string[];
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | "PERSON_REGISTERED"
  | "PERSON_UPDATED"
  | "QR_ISSUED"
  | "QR_REISSUED"
  | "QR_REVOKED"
  | "QR_WRISTBAND_ISSUED"
  | "QR_PRINTED"
  | "QR_DOWNLOADED"
  | "TEAM_CREATED"
  | "TEAM_UPDATED"
  | "TEAM_MEMBER_ADDED"
  | "TEAM_MEMBER_REMOVED"
  | "ADMIN_SIGNED_IN"
  | "ADMIN_SIGNED_OUT"
  | "DIRECTORY_EXPORTED"
  | "DEMO_DATA_SEEDED"
  | "DEMO_DATA_RESET";

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  action: AuditAction;
  entityType: "PERSON" | "CREDENTIAL" | "TEAM" | "SYSTEM";
  entityId: string | null;
  /** Short, non-sensitive description (IDs only; no medical details). */
  summary: string;
}

export type SequenceKey = PersonCategory | "TEAM";

export interface DatabaseSnapshot {
  schemaVersion: 1;
  counters: Record<SequenceKey, number>;
  persons: PersonRecord[];
  credentials: IdentityCredential[];
  teams: MedicalTeam[];
  auditLog: AuditEvent[];
}

export interface Actor {
  id: string;
  name: string;
}
