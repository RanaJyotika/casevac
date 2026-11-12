/**
 * QR identity credentials: issue, reissue, revoke, wristband hand-over,
 * print/download tracking, rendering and payload resolution.
 */
import QRCode from "qrcode";
import { getRepository, type RepositoryWriter } from "../data";
import { newInternalId, newOpaqueToken } from "../domain/ids";
import { buildQrPayload, parseQrPayload, QR_FORMAT_VERSION } from "../domain/qr-format";
import type {
  Actor,
  CredentialStatus,
  IdentityCredential,
  PersonRecord,
  SoldierRecord,
} from "../domain/types";
import { validateReason } from "../domain/validation";
import { fail, invalid, nowIso, ok, runTransaction, type AuditFn, type ServiceResult } from "./common";

/** Issues a new ACTIVE QR credential inside an existing transaction. */
export async function issueCredentialTx(
  tx: RepositoryWriter,
  audit: AuditFn,
  person: SoldierRecord,
  actor: Actor,
): Promise<IdentityCredential> {
  const existing = (await tx.listCredentials()).filter(c => c.personId === person.id);
  const version = existing.reduce((max, c) => Math.max(max, c.version), 0) + 1;

  let token = newOpaqueToken();
  while (await tx.findCredentialByToken(token)) token = newOpaqueToken();

  const credential: IdentityCredential = {
    id: newInternalId(),
    personId: person.id,
    method: "QR",
    formatVersion: QR_FORMAT_VERSION,
    token,
    payload: buildQrPayload(token),
    version,
    status: "ACTIVE",
    issuedAt: nowIso(),
    issuedBy: actor.id,
    wristbandIssuedAt: null,
    wristbandIssuedBy: null,
    revokedAt: null,
    revokedBy: null,
    revocationReason: null,
    replacedByCredentialId: null,
    printCount: 0,
    lastPrintedAt: null,
  };
  await tx.insertCredential(credential);
  await audit("QR_ISSUED", "CREDENTIAL", credential.id, `Issued QR v${version} for ${person.displayId}`);
  return credential;
}

async function loadSoldier(tx: RepositoryWriter, personId: string): Promise<SoldierRecord | null> {
  const person = await tx.getPerson(personId);
  return person && person.category === "SOLDIER" ? person : null;
}

async function activeCredentialFor(tx: RepositoryWriter, personId: string) {
  return (await tx.listCredentials()).find(c => c.personId === personId && c.status === "ACTIVE") ?? null;
}

/** Issue a QR to a soldier who currently has none (e.g. after revocation). */
export async function issueNewCredential(personId: string, actor: Actor): Promise<ServiceResult<IdentityCredential>> {
  return runTransaction(actor, async (tx, audit) => {
    const person = await loadSoldier(tx, personId);
    if (!person) return fail("QR codes can only be issued to registered soldiers.");
    if (person.status !== "ACTIVE") return fail("Reactivate this soldier before issuing a QR.");
    if (await activeCredentialFor(tx, personId)) {
      return fail("This soldier already has an active QR. Use Reissue to replace it.");
    }
    return ok(await issueCredentialTx(tx, audit, person, actor));
  });
}

/** Replace the active QR with a new token; the old one stops resolving. */
export async function reissueCredential(personId: string, reason: string, actor: Actor): Promise<ServiceResult<IdentityCredential>> {
  const r = validateReason(reason);
  if (!r.ok) return invalid(r.errors);
  return runTransaction(actor, async (tx, audit) => {
    const person = await loadSoldier(tx, personId);
    if (!person) return fail("QR codes can only be issued to registered soldiers.");
    if (person.status !== "ACTIVE") return fail("Reactivate this soldier before reissuing a QR.");
    const current = await activeCredentialFor(tx, personId);
    if (!current) return fail("There is no active QR to replace. Use Issue QR instead.");

    const now = nowIso();
    const retired: IdentityCredential = {
      ...current,
      status: "REPLACED",
      revokedAt: now,
      revokedBy: actor.id,
      revocationReason: r.value,
    };
    await tx.updateCredential(retired);
    const next = await issueCredentialTx(tx, audit, person, actor);
    await tx.updateCredential({ ...retired, replacedByCredentialId: next.id });
    await audit(
      "QR_REISSUED",
      "CREDENTIAL",
      next.id,
      `Replaced QR v${current.version} with v${next.version} for ${person.displayId}`,
    );
    return ok(next);
  });
}

/** Revoke the active QR without issuing a replacement. */
export async function revokeCredential(personId: string, reason: string, actor: Actor): Promise<ServiceResult<IdentityCredential>> {
  const r = validateReason(reason);
  if (!r.ok) return invalid(r.errors);
  return runTransaction(actor, async (tx, audit) => {
    const person = await loadSoldier(tx, personId);
    if (!person) return fail("Soldier not found.");
    const current = await activeCredentialFor(tx, personId);
    if (!current) return fail("There is no active QR to revoke.");
    const revoked: IdentityCredential = {
      ...current,
      status: "REVOKED",
      revokedAt: nowIso(),
      revokedBy: actor.id,
      revocationReason: r.value,
    };
    await tx.updateCredential(revoked);
    await audit("QR_REVOKED", "CREDENTIAL", current.id, `Revoked QR v${current.version} for ${person.displayId}`);
    return ok(revoked);
  });
}

/** Record that the printed wristband was physically handed over. */
export async function markWristbandIssued(credentialId: string, actor: Actor): Promise<ServiceResult<IdentityCredential>> {
  return runTransaction(actor, async (tx, audit) => {
    const credential = await tx.getCredential(credentialId);
    if (!credential) return fail("QR record not found.");
    if (credential.status !== "ACTIVE") return fail("Only an active QR can be marked as issued.");
    if (credential.wristbandIssuedAt) return fail("This wristband is already marked as issued.");
    const person = await tx.getPerson(credential.personId);
    const updated = { ...credential, wristbandIssuedAt: nowIso(), wristbandIssuedBy: actor.id };
    await tx.updateCredential(updated);
    await audit(
      "QR_WRISTBAND_ISSUED",
      "CREDENTIAL",
      credential.id,
      `Wristband QR v${credential.version} issued to ${person?.displayId ?? "unknown"}`,
    );
    return ok(updated);
  });
}

/** Record a print or PNG download. Reprinting never creates a new identity. */
export async function recordCredentialOutput(
  credentialId: string,
  kind: "PRINT" | "DOWNLOAD",
  actor: Actor,
): Promise<ServiceResult<IdentityCredential>> {
  return runTransaction(actor, async (tx, audit) => {
    const credential = await tx.getCredential(credentialId);
    if (!credential) return fail("QR record not found.");
    if (credential.status !== "ACTIVE") return fail("Revoked or replaced QR codes cannot be printed or downloaded.");
    const person = await tx.getPerson(credential.personId);
    const updated =
      kind === "PRINT"
        ? { ...credential, printCount: credential.printCount + 1, lastPrintedAt: nowIso() }
        : credential;
    if (kind === "PRINT") await tx.updateCredential(updated);
    await audit(
      kind === "PRINT" ? "QR_PRINTED" : "QR_DOWNLOADED",
      "CREDENTIAL",
      credential.id,
      `${kind === "PRINT" ? "Printed" : "Downloaded"} QR v${credential.version} for ${person?.displayId ?? "unknown"}`,
    );
    return ok(updated);
  });
}

/* ------------------------------ Queries ----------------------------- */

export interface CredentialRow {
  credential: IdentityCredential;
  person: PersonRecord | null;
}

export interface CredentialFilter {
  q?: string;
  status?: CredentialStatus | "";
  awaitingWristband?: boolean;
}

export async function listCredentialRows(filter: CredentialFilter = {}): Promise<CredentialRow[]> {
  const repo = getRepository();
  const [credentials, persons] = await Promise.all([repo.listCredentials(), repo.listPersons()]);
  const byId = new Map(persons.map(p => [p.id, p]));
  const q = (filter.q ?? "").trim().toUpperCase();
  return credentials
    .map(credential => ({ credential, person: byId.get(credential.personId) ?? null }))
    .filter(({ credential, person }) => {
      if (filter.status && credential.status !== filter.status) return false;
      if (filter.awaitingWristband && (credential.status !== "ACTIVE" || credential.wristbandIssuedAt)) return false;
      if (q) {
        const haystack = `${person?.displayId ?? ""} ${person?.fullName ?? ""} ${person?.serviceNumber ?? ""}`.toUpperCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => b.credential.issuedAt.localeCompare(a.credential.issuedAt));
}

/** Active soldiers who have no active QR — "unassigned" in QR Management. */
export async function listSoldiersWithoutActiveQr(): Promise<SoldierRecord[]> {
  const repo = getRepository();
  const [credentials, persons] = await Promise.all([repo.listCredentials(), repo.listPersons()]);
  const withActive = new Set(credentials.filter(c => c.status === "ACTIVE").map(c => c.personId));
  return persons.filter(
    (p): p is SoldierRecord => p.category === "SOLDIER" && p.status === "ACTIVE" && !withActive.has(p.id),
  );
}

export async function getCredentialWithPerson(credentialId: string): Promise<CredentialRow | null> {
  const repo = getRepository();
  const credential = await repo.getCredential(credentialId);
  if (!credential) return null;
  return { credential, person: await repo.getPerson(credential.personId) };
}

/**
 * Resolve a scanned payload exactly as the mobile app will (against the
 * dashboard's data). Only ACTIVE credentials of ACTIVE soldiers resolve.
 */
export async function resolveQrPayload(raw: string): Promise<
  | { ok: true; person: SoldierRecord; credential: IdentityCredential }
  | { ok: false; reason: "INVALID_PAYLOAD" | "UNKNOWN_TOKEN" | "CREDENTIAL_NOT_ACTIVE" | "PERSON_INACTIVE" }
> {
  const parsed = parseQrPayload(raw);
  if (!parsed.ok) return { ok: false, reason: "INVALID_PAYLOAD" };
  const repo = getRepository();
  const credential = await repo.findCredentialByToken(parsed.token);
  if (!credential) return { ok: false, reason: "UNKNOWN_TOKEN" };
  if (credential.status !== "ACTIVE") return { ok: false, reason: "CREDENTIAL_NOT_ACTIVE" };
  const person = await repo.getPerson(credential.personId);
  if (!person || person.category !== "SOLDIER" || person.status !== "ACTIVE") {
    return { ok: false, reason: "PERSON_INACTIVE" };
  }
  return { ok: true, person, credential };
}

/* ----------------------------- Rendering ---------------------------- */

const QR_OPTIONS = { errorCorrectionLevel: "M" as const, margin: 2 };

export async function renderQrSvg(payload: string): Promise<string> {
  return QRCode.toString(payload, { ...QR_OPTIONS, type: "svg", color: { dark: "#1C2630", light: "#FFFFFF" } });
}

export async function renderQrPng(payload: string): Promise<Buffer> {
  return QRCode.toBuffer(payload, { ...QR_OPTIONS, type: "png", width: 600 });
}
