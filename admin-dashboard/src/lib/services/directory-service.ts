/**
 * Mobile integration boundary (NOT a live sync).
 *
 * Builds the identity directory a medic phone would need to resolve scanned
 * QR tokens offline. Today it is only available as an admin-downloaded demo
 * file; provisioning to devices needs the backend, device enrolment and
 * encryption (see INTEGRATION.md).
 */
import { getRepository } from "../data";
import { QR_FORMAT_VERSION } from "../domain/qr-format";
import type { BloodGroup, RhFactor } from "../domain/types";

export interface IdentityDirectoryEntry {
  /** Token from the QR payload CASEVAC:1:<token>. */
  token: string;
  qrFormatVersion: typeof QR_FORMAT_VERSION;
  credentialVersion: number;
  /** Internal Person UUID — matches the mobile app's patient id. */
  patientId: string;
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
}

export interface IdentityDirectory {
  format: "casevac.identity-directory";
  formatVersion: 1;
  generatedAt: string;
  dataSource: "DEMO";
  notice: string;
  entries: IdentityDirectoryEntry[];
}

/** Only ACTIVE soldiers with an ACTIVE QR are included; minimal fields only. */
export async function buildIdentityDirectory(): Promise<IdentityDirectory> {
  const repo = getRepository();
  const [persons, credentials] = await Promise.all([repo.listPersons(), repo.listCredentials()]);
  const byId = new Map(persons.map(p => [p.id, p]));
  const entries: IdentityDirectoryEntry[] = [];
  for (const c of credentials) {
    if (c.status !== "ACTIVE") continue;
    const p = byId.get(c.personId);
    if (!p || p.category !== "SOLDIER" || p.status !== "ACTIVE") continue;
    entries.push({
      token: c.token,
      qrFormatVersion: QR_FORMAT_VERSION,
      credentialVersion: c.version,
      patientId: p.id,
      displayId: p.displayId,
      fullName: p.fullName,
      rank: p.rank,
      unit: p.unit,
      bloodGroup: p.soldier.bloodGroup,
      rhFactor: p.soldier.rhFactor,
    });
  }
  entries.sort((a, b) => a.displayId.localeCompare(b.displayId));
  return {
    format: "casevac.identity-directory",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    dataSource: "DEMO",
    notice: "DEMONSTRATION EXPORT — fictional records only. Unencrypted. Not for operational use.",
    entries,
  };
}
