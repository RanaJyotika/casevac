/**
 * Identity provisioning contracts.
 *
 * TrustStore  — public keys of credential issuers this phone trusts (trust anchors).
 * IdentityDirectory — patient identities and credential status (incl. revocations)
 *                     provisioned to the phone while it was last online.
 *
 * Today both are bundled DEMO files written by the dashboard's
 * `npm run mobile:provision`. A backend-provisioned, encrypted implementation
 * replaces them later without changing screens or verification logic.
 */

export type DirectorySource = 'DEMO_BUNDLED' | 'BACKEND';

export interface TrustedIssuerKey {
  keyId: string;
  issuer: string;
  algorithm: 'Ed25519';
  /** Raw 32-byte Ed25519 public key. */
  publicKey: Uint8Array;
}

export interface TrustStore {
  findKey(keyId: string): Promise<TrustedIssuerKey | null>;
  listKeyIds(): Promise<string[]>;
}

export type CredentialStatus = 'ACTIVE' | 'REVOKED' | 'REPLACED';

export interface CredentialRecord {
  credentialId: string;
  patientId: string;
  keyId: string;
  credentialVersion: number;
  status: CredentialStatus;
  /** ISO-8601 UTC. */
  issuedAt: string;
  revokedAt: string | null;
}

export type BloodGroup = 'UNKNOWN' | 'A' | 'B' | 'AB' | 'O';
export type RhFactor = 'UNKNOWN' | 'POSITIVE' | 'NEGATIVE';
export type Sex = 'NOT_RECORDED' | 'MALE' | 'FEMALE';

export interface PatientIdentity {
  /** Permanent patient identity (UUID). */
  patientId: string;
  /** Registrar reference shown to medics, e.g. PAT-00012. */
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  sex: Sex;
  /** ISO date (YYYY-MM-DD) or null; used to show age. */
  dateOfBirth: string | null;
  /** Small JPEG data URL from the dashboard, or null. Never from the QR. */
  photo: string | null;
}

/**
 * A clinician a casualty can be handed over to (from the dashboard's staff
 * register: active medical officers and medics). Downloaded at sign-in.
 */
export interface StaffMember {
  staffId: string;
  /** Personnel ID, e.g. MED-00003 */
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  /** e.g. MEDICAL_OFFICER, MEDIC */
  role: string;
  /** e.g. "Doctor / Medical Officer" */
  roleLabel: string;
  designation: string;
  /** ISO date (YYYY-MM-DD) or null; used to show age. */
  dateOfBirth: string | null;
  contactPhone: string;
  /** Small JPEG data URL from the dashboard, or null. */
  photo: string | null;
}

export interface DirectoryInfo {
  source: DirectorySource;
  /** When the directory was produced (ISO-8601), null if never provisioned. */
  generatedAt: string | null;
  patientCount: number;
  credentialCount: number;
}

export interface IdentityDirectory {
  info(): Promise<DirectoryInfo>;
  findCredential(credentialId: string): Promise<CredentialRecord | null>;
  findPatient(patientId: string): Promise<PatientIdentity | null>;
  /** Exact match on the registrar display ID (e.g. PAT-00012), case-insensitive. */
  findPatientByDisplayId(displayId: string): Promise<PatientIdentity | null>;
  /**
   * Clinicians matching a name or personnel ID (case-insensitive; every word
   * typed must match). Medical officers first. Empty query → empty list.
   */
  searchStaff(query: string, limit?: number): Promise<StaffMember[]>;
  /** Number of clinicians on this tablet (0 if none were downloaded). */
  staffCount(): Promise<number>;
}
