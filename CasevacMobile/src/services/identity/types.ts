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
}
