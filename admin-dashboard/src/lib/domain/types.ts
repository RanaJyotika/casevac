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
  /**
   * Optional small ID photo (JPEG data URL, ≤ ~48 KB) shown to medics on the
   * tablet. Never part of the QR. Absent on records created before photos.
   */
  photo?: string | null;
}

export interface StaffDetails {
  role: RoleId;
  designation: string;
  professionalRegistration: string;
  /** Optional small ID photo (JPEG data URL, ≤ ~48 KB). Absent on records created before staff photos. */
  photo?: string | null;
  /**
   * ISO date (YYYY-MM-DD) or null. Lets the tablet show the receiving
   * officer's age at handover. Absent on records created before this field.
   */
  dateOfBirth?: string | null;
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
  /**
   * Payload format (see lib/domain/qr-format.ts).
   * 1 = legacy unsigned token (rejected by the medic app — reissue);
   * 2 = Ed25519-signed patient credential.
   */
  formatVersion: 1 | 2;
  /** Issuer signing key that signed a v2 payload. Absent on legacy v1 records. */
  keyId?: string;
  /**
   * 128-bit random, base64url. Internal opaque reference; it is the QR content
   * only for legacy v1 credentials. v2 QR codes identify the credential by `id`.
   */
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

/**
 * Mobile app sign-in account for a clinical staff member (medic / doctor).
 *
 * Lifecycle: the admin generates a user ID + password (PENDING_FIRST_LOGIN).
 * The first sign-in must happen online at base camp; the tablet then caches a
 * hashed copy so later sign-ins work offline (ACTIVATED). Revoking or
 * resetting retires the account; tablets drop their cached copy the next
 * time they reach the server.
 */
export type MobileAccountStatus = "PENDING_FIRST_LOGIN" | "ACTIVATED" | "REVOKED";

export interface MobileLoginAccount {
  /** Random internal UUID. Sent to the tablet so it can tell accounts apart. */
  id: string;
  personId: string;
  /** Sign-in user ID typed on the tablet (normalised upper-case), e.g. MED-00001. */
  userId: string;
  /** scrypt hash of the password; the plaintext is shown to the admin once only. */
  passwordHash: string;
  passwordSalt: string;
  /**
   * AES-256-GCM encrypted copy of the password so an admin can view it again
   * after verifying with Windows Hello (see login-vault.ts). Absent on
   * accounts issued before this existed or when no vault key is configured.
   * Dashboard only: never sent to tablets.
   */
  passwordVault?: string | null;
  status: MobileAccountStatus;
  issuedAt: string;
  issuedBy: string;
  /** First successful online sign-in (offline copy saved on a tablet). */
  firstLoginAt: string | null;
  lastOnlineLoginAt: string | null;
  /** Most recent offline sign-in reported by a tablet when it next came online. */
  lastOfflineLoginAt: string | null;
  onlineLoginCount: number;
  offlineLoginCount: number;
  /** Device label reported by the tablet at the last online sign-in. */
  lastDevice: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
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
  | "DEMO_DATA_RESET"
  | "MOBILE_LOGIN_ISSUED"
  | "MOBILE_LOGIN_RESET"
  | "MOBILE_LOGIN_REVOKED"
  | "MOBILE_LOGIN_ACTIVATED"
  | "MOBILE_LOGIN_ONLINE"
  | "MOBILE_LOGIN_FAILED"
  | "MOBILE_LOGIN_PASSWORD_VIEWED"
  | "ADMIN_PASSKEY_REGISTERED";

export interface AuditEvent {
  id: string;
  at: string;
  actorId: string;
  action: AuditAction;
  entityType: "PERSON" | "CREDENTIAL" | "TEAM" | "SYSTEM" | "MOBILE_LOGIN";
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
  /** Added after schema v1 shipped; older files load with an empty list. */
  mobileAccounts: MobileLoginAccount[];
  /** Added later; older files load with an empty list. */
  adminPasskeys: AdminPasskey[];
  auditLog: AuditEvent[];
}

/**
 * A WebAuthn platform credential (Windows Hello on an admin's PC). Used to
 * re-verify the admin before showing a stored mobile sign-in password.
 */
export interface AdminPasskey {
  /** WebAuthn credential ID, base64url. */
  id: string;
  adminId: string;
  /** SubjectPublicKeyInfo DER, base64url. */
  publicKey: string;
  /** COSE algorithm: -7 ES256, -257 RS256, -8 EdDSA. */
  algorithm: number;
  signCount: number;
  /** Browser/OS hint captured at setup, e.g. "Windows · Chrome". */
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface Actor {
  id: string;
  name: string;
}
