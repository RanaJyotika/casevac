/**
 * Mobile integration boundary (NOT a live sync).
 *
 * Builds the identity directory a medic phone uses after verifying a signed
 * QR offline: who the credential belongs to, and whether the dashboard has
 * revoked or replaced it. Today it is only produced as a demo file (admin
 * download or `npm run mobile:provision`); provisioning to devices needs the
 * backend, device enrolment and encryption (see INTEGRATION.md).
 */
import { getIssuerKey } from "../crypto/qr-issuer";
import { getRepository } from "../data";
import { QR_ISSUER } from "../domain/qr-format";
import type { BloodGroup, CredentialStatus, RhFactor, Sex } from "../domain/types";

export interface DirectoryPatient {
  /** Internal Person UUID — the patientId inside signed QR credentials. */
  patientId: string;
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  sex: Sex;
  /** ISO date (YYYY-MM-DD) or null; the tablet shows age from it. */
  dateOfBirth: string | null;
  /** Small JPEG data URL or null. Delivered only via authenticated sign-in. */
  photo: string | null;
}

export interface DirectoryCredential {
  credentialId: string;
  patientId: string;
  keyId: string;
  credentialVersion: number;
  status: CredentialStatus;
  issuedAt: string;
  /** Set for REVOKED / REPLACED credentials. */
  revokedAt: string | null;
}

export interface IdentityDirectory {
  format: "casevac.identity-directory";
  formatVersion: 2;
  generatedAt: string;
  dataSource: "DEMO";
  notice: string;
  /** ACTIVE soldiers holding an ACTIVE signed credential; minimal fields only. */
  patients: DirectoryPatient[];
  /** Every signed soldier credential, including REVOKED/REPLACED (revocation list). */
  credentials: DirectoryCredential[];
}

export interface TrustedIssuerKeys {
  format: "casevac.trusted-issuer-keys";
  formatVersion: 1;
  generatedAt: string;
  notice: string;
  keys: { keyId: string; issuer: typeof QR_ISSUER; algorithm: "Ed25519"; publicKey: string }[];
}

export async function buildIdentityDirectory(): Promise<IdentityDirectory> {
  const repo = getRepository();
  const [persons, credentials] = await Promise.all([repo.listPersons(), repo.listCredentials()]);
  const byId = new Map(persons.map(p => [p.id, p]));

  const directoryCredentials: DirectoryCredential[] = [];
  const patientIds = new Set<string>();
  for (const c of credentials) {
    // Legacy unsigned (v1) credentials are rejected by the app before lookup.
    if (c.formatVersion !== 2 || !c.keyId) continue;
    const p = byId.get(c.personId);
    if (!p || p.category !== "SOLDIER") continue;
    directoryCredentials.push({
      credentialId: c.id,
      patientId: c.personId,
      keyId: c.keyId,
      credentialVersion: c.version,
      status: c.status,
      issuedAt: c.issuedAt,
      revokedAt: c.revokedAt,
    });
    if (c.status === "ACTIVE" && p.status === "ACTIVE") patientIds.add(p.id);
  }

  const patients: DirectoryPatient[] = [];
  for (const id of patientIds) {
    const p = byId.get(id);
    if (!p || p.category !== "SOLDIER") continue;
    patients.push({
      patientId: p.id,
      displayId: p.displayId,
      fullName: p.fullName,
      rank: p.rank,
      unit: p.unit,
      bloodGroup: p.soldier.bloodGroup,
      rhFactor: p.soldier.rhFactor,
      sex: p.soldier.sex,
      dateOfBirth: p.soldier.dateOfBirth,
      photo: p.soldier.photo ?? null,
    });
  }
  patients.sort((a, b) => a.displayId.localeCompare(b.displayId));
  directoryCredentials.sort((a, b) => a.issuedAt.localeCompare(b.issuedAt));

  return {
    format: "casevac.identity-directory",
    formatVersion: 2,
    generatedAt: new Date().toISOString(),
    dataSource: "DEMO",
    notice: "DEMONSTRATION EXPORT — fictional records only. Unencrypted. Not for operational use.",
    patients,
    credentials: directoryCredentials,
  };
}

/** Public verification key(s) phones must trust. Contains no secrets. */
export function buildTrustedIssuerKeys(): TrustedIssuerKeys | null {
  const issuer = getIssuerKey();
  if (!issuer.ok) return null;
  return {
    format: "casevac.trusted-issuer-keys",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    notice: "DEVELOPMENT ISSUER KEY — public key only. Production trust anchors require an approved provisioning process.",
    keys: [{ keyId: issuer.key.keyId, issuer: QR_ISSUER, algorithm: "Ed25519", publicKey: issuer.key.publicKeyBase64Url }],
  };
}
