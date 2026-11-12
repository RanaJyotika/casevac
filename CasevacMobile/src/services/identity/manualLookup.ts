/**
 * Manual Patient ID entry (M03 fallback) — used when the wristband cannot be
 * scanned. Looks the ID up in the tablet's local identity directory only.
 *
 * Manual entry proves nothing about the wristband: the result is always
 * marked "identified manually" and the medic must confirm identity.
 * Exact matches only — no fuzzy or partial matching, so a typo can never
 * select a different soldier.
 */
import type { IdentityDirectory, PatientIdentity } from './types';

export interface ManualIdentification {
  ok: true;
  method: 'MANUAL';
  /** What the medic typed (normalised). */
  enteredId: string;
  patient: PatientIdentity;
  directoryGeneratedAt: string | null;
}

export type ManualLookupResult =
  | ManualIdentification
  | { ok: false; reason: 'EMPTY' | 'NOT_FOUND'; enteredId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function lookupPatientById(
  input: string,
  directory: IdentityDirectory,
): Promise<ManualLookupResult> {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, reason: 'EMPTY', enteredId: '' };
  }
  const asUuid = trimmed.toLowerCase();
  const patient = UUID.test(asUuid)
    ? await directory.findPatient(asUuid)
    : await directory.findPatientByDisplayId(trimmed);
  const enteredId = UUID.test(asUuid) ? asUuid : trimmed.toUpperCase();
  if (!patient) {
    return { ok: false, reason: 'NOT_FOUND', enteredId };
  }
  const info = await directory.info();
  return {
    ok: true,
    method: 'MANUAL',
    enteredId,
    patient,
    directoryGeneratedAt: info.generatedAt,
  };
}
