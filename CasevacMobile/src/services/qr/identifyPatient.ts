/**
 * Offline patient identification from a scanned wristband QR.
 *
 * Order of checks (all local, no network):
 *   1. Parse the payload strictly (format, version, field syntax).
 *   2. Find the issuer key by keyId in the phone's trust store.
 *   3. Verify the Ed25519 signature over the exact signed bytes.
 *   4. Check the local directory for revocation / replacement.
 *   5. Check the directory record matches the signed patient ID.
 *   6. Resolve identity details if provisioned; otherwise report
 *      "Credential verified — patient details unavailable offline".
 *
 * A valid signature proves the dashboard issued the credential. It does not
 * prove the credential is still unrevoked (only as fresh as the directory),
 * nor that the wearer is that person — the medic still confirms identity.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import type {
  CredentialRecord,
  IdentityDirectory,
  PatientIdentity,
  TrustStore,
} from '../identity/types';
import { asciiBytes, decodeBase64Url } from './base64url';
import {
  parseCredentialPayload,
  type PatientCredentialClaims,
  type QrParseFailure,
} from './credentialFormat';

export type IdentificationFailure =
  | QrParseFailure
  | 'UNKNOWN_ISSUER_KEY'
  | 'INVALID_SIGNATURE'
  | 'CREDENTIAL_REVOKED'
  | 'CREDENTIAL_REPLACED'
  | 'RECORD_MISMATCH';

export type IdentityLookup =
  /** Directory has this active credential and the patient's details. */
  | {
      status: 'FOUND';
      patient: PatientIdentity;
      credential: CredentialRecord;
    }
  /** Credential is newer than the directory, or never provisioned here. */
  | { status: 'CREDENTIAL_NOT_IN_DIRECTORY' }
  /** Credential is active but the patient's details are not provisioned. */
  | { status: 'PATIENT_DETAILS_UNAVAILABLE'; credential: CredentialRecord };

export interface VerifiedIdentification {
  ok: true;
  /** Identified by scanning a signed wristband credential. */
  method: 'QR';
  claims: PatientCredentialClaims;
  issuer: string;
  lookup: IdentityLookup;
  directoryGeneratedAt: string | null;
}

export interface FailedIdentification {
  ok: false;
  failure: IdentificationFailure;
  /** Extra facts for the error message (key ID, revocation time…). Never clinical data. */
  keyId?: string;
  revokedAt?: string | null;
}

export type IdentificationResult =
  | VerifiedIdentification
  | FailedIdentification;

export interface IdentificationDeps {
  trustStore: TrustStore;
  directory: IdentityDirectory;
}

export function verifyEd25519(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    // zip215: false → strict RFC 8032 rules, matching Node's verifier.
    return ed25519.verify(signature, message, publicKey, { zip215: false });
  } catch {
    return false;
  }
}

export async function identifyPatient(
  rawQr: string,
  { trustStore, directory }: IdentificationDeps,
): Promise<IdentificationResult> {
  const parsed = parseCredentialPayload(rawQr);
  if (!parsed.ok) {
    return { ok: false, failure: parsed.reason };
  }
  const { claims } = parsed;

  const key = await trustStore.findKey(claims.keyId);
  if (!key) {
    return { ok: false, failure: 'UNKNOWN_ISSUER_KEY', keyId: claims.keyId };
  }
  const signature = decodeBase64Url(parsed.signature);
  if (
    !signature ||
    signature.length !== 64 ||
    !verifyEd25519(signature, asciiBytes(parsed.signedMessage), key.publicKey)
  ) {
    return { ok: false, failure: 'INVALID_SIGNATURE' };
  }

  const [credential, info] = await Promise.all([
    directory.findCredential(claims.credentialId),
    directory.info(),
  ]);
  const base = {
    ok: true as const,
    method: 'QR' as const,
    claims,
    issuer: key.issuer,
    directoryGeneratedAt: info.generatedAt,
  };
  if (!credential) {
    return { ...base, lookup: { status: 'CREDENTIAL_NOT_IN_DIRECTORY' } };
  }
  if (
    credential.patientId !== claims.patientId ||
    credential.keyId !== claims.keyId ||
    credential.credentialVersion !== claims.credentialVersion
  ) {
    return { ok: false, failure: 'RECORD_MISMATCH' };
  }
  if (credential.status === 'REVOKED' || credential.status === 'REPLACED') {
    return {
      ok: false,
      failure:
        credential.status === 'REVOKED'
          ? 'CREDENTIAL_REVOKED'
          : 'CREDENTIAL_REPLACED',
      revokedAt: credential.revokedAt,
    };
  }
  const patient = await directory.findPatient(claims.patientId);
  if (!patient) {
    return {
      ...base,
      lookup: { status: 'PATIENT_DETAILS_UNAVAILABLE', credential },
    };
  }
  return { ...base, lookup: { status: 'FOUND', patient, credential } };
}
