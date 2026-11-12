/**
 * CASEVAC wristband QR payload — mobile copy of the shared contract.
 * Source of truth: admin-dashboard/src/lib/domain/qr-format.ts. Both sides
 * pin the same cross-implementation test vector in their test suites.
 *
 * v2 (signed, current):
 *   CASEVAC:2:P:<keyId>:<credentialId>:<patientId>:<credentialVersion>:<issuedAt>:<signature>
 *
 * The Ed25519 signature covers the exact ASCII bytes before the final ":".
 * The payload is matched by one anchored pattern; nothing is re-serialised.
 *
 * v1 (legacy, "CASEVAC:1:<token>") is unsigned and is never accepted.
 */

export const QR_NAMESPACE = 'CASEVAC';
export const QR_FORMAT_VERSION = 2;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const V2_PATTERN = new RegExp(
  `^CASEVAC:2:P:([a-z0-9][a-z0-9-]{0,31}):(${UUID}):(${UUID}):([1-9][0-9]{0,5}):([1-9][0-9]{9}):([A-Za-z0-9_-]{86})$`,
);
const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

/** Hard limit before any parsing, so a hostile code cannot cost much. */
const MAX_PAYLOAD_LENGTH = 512;

export interface PatientCredentialClaims {
  keyId: string;
  /** Dashboard IdentityCredential.id (UUID). */
  credentialId: string;
  /** Permanent patient identity (dashboard Person.id, UUID). */
  patientId: string;
  credentialVersion: number;
  /** Unix seconds, UTC. */
  issuedAt: number;
}

export type QrParseFailure =
  | 'NOT_CASEVAC'
  | 'LEGACY_UNSIGNED'
  | 'UNSUPPORTED_VERSION'
  | 'MALFORMED';

export type ParsedCredential =
  | {
      ok: true;
      claims: PatientCredentialClaims;
      /** Exact text the signature covers. */
      signedMessage: string;
      /** base64url Ed25519 signature. */
      signature: string;
    }
  | { ok: false; reason: QrParseFailure };

/** Structural parse only — does NOT verify the signature. */
export function parseCredentialPayload(raw: string): ParsedCredential {
  const text = raw.trim();
  if (text.length > MAX_PAYLOAD_LENGTH) {
    return { ok: false, reason: 'MALFORMED' };
  }
  const parts = text.split(':');
  if (parts[0] !== QR_NAMESPACE || parts.length < 2) {
    return { ok: false, reason: 'NOT_CASEVAC' };
  }
  if (parts[1] === '1') {
    return parts.length === 3 && LEGACY_TOKEN_PATTERN.test(parts[2])
      ? { ok: false, reason: 'LEGACY_UNSIGNED' }
      : { ok: false, reason: 'MALFORMED' };
  }
  if (parts[1] !== String(QR_FORMAT_VERSION)) {
    return { ok: false, reason: 'UNSUPPORTED_VERSION' };
  }
  const m = V2_PATTERN.exec(text);
  if (!m) {
    return { ok: false, reason: 'MALFORMED' };
  }
  return {
    ok: true,
    claims: {
      keyId: m[1],
      credentialId: m[2],
      patientId: m[3],
      credentialVersion: Number(m[4]),
      issuedAt: Number(m[5]),
    },
    signedMessage: text.slice(0, text.lastIndexOf(':')),
    signature: m[6],
  };
}
