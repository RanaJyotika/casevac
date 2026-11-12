/**
 * Versioned QR payload format — the shared contract with the mobile app.
 * The mobile copy lives in CasevacMobile/src/services/qr/credentialFormat.ts
 * and both are pinned to the same test vector (see tests).
 *
 * v2 (current) — signed patient credential, Ed25519:
 *
 *   CASEVAC:2:P:<keyId>:<credentialId>:<patientId>:<credentialVersion>:<issuedAt>:<signature>
 *
 *   keyId              issuer signing key, [a-z0-9][a-z0-9-]{0,31}
 *   credentialId       IdentityCredential.id, lower-case UUID
 *   patientId          Person.id, lower-case UUID (the permanent patient identity)
 *   credentialVersion  per-patient issue sequence 1, 2, 3 …
 *   issuedAt           Unix time in seconds (UTC), 10 digits
 *   signature          Ed25519 signature, base64url without padding (86 chars)
 *
 * Canonical signed message: the exact ASCII bytes of the payload up to (not
 * including) the final ":" — i.e. "CASEVAC:2:P:<keyId>:…:<issuedAt>". Every
 * field has a fixed character set that excludes ":", and the whole payload is
 * matched by one anchored pattern, so there is exactly one encoding of a given
 * set of claims and verifiers never re-serialise anything.
 *
 * The payload carries no name, service number, contact or medical data.
 * A valid signature proves the dashboard issued the credential. It does NOT
 * prove the credential is unrevoked, or that the wearer is that person.
 *
 * v1 (legacy) — "CASEVAC:1:<token>", unsigned. Recognised only so it can be
 * reported as "unsigned — reissue"; it is never accepted as a credential.
 */

export const QR_NAMESPACE = "CASEVAC";
export const LEGACY_QR_FORMAT_VERSION = 1 as const;
export const QR_FORMAT_VERSION = 2 as const;
/** Credential type "P" = CASEVAC_PATIENT (patient identity wristband). */
export const QR_TYPE_PATIENT = "P";
/** Issuer name associated with dashboard signing keys. */
export const QR_ISSUER = "CASEVAC_ADMIN";

export const KEY_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const UUID_PATTERN = new RegExp(`^${UUID}$`);
const V2_PATTERN = new RegExp(
  `^CASEVAC:2:P:([a-z0-9][a-z0-9-]{0,31}):(${UUID}):(${UUID}):([1-9][0-9]{0,5}):([1-9][0-9]{9}):([A-Za-z0-9_-]{86})$`,
);
const LEGACY_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export interface PatientCredentialClaims {
  keyId: string;
  credentialId: string;
  patientId: string;
  credentialVersion: number;
  /** Unix seconds, UTC. */
  issuedAt: number;
}

/** Builds the canonical message that the issuer signs. Throws on invalid claims. */
export function buildSignedMessage(claims: PatientCredentialClaims): string {
  const { keyId, credentialId, patientId, credentialVersion, issuedAt } = claims;
  if (!KEY_ID_PATTERN.test(keyId)) throw new Error("Invalid key ID");
  if (!UUID_PATTERN.test(credentialId)) throw new Error("Invalid credential ID");
  if (!UUID_PATTERN.test(patientId)) throw new Error("Invalid patient ID");
  if (!Number.isInteger(credentialVersion) || credentialVersion < 1 || credentialVersion > 999_999) {
    throw new Error("Invalid credential version");
  }
  if (!Number.isInteger(issuedAt) || issuedAt < 1_000_000_000 || issuedAt > 9_999_999_999) {
    throw new Error("Invalid issue time");
  }
  return `${QR_NAMESPACE}:${QR_FORMAT_VERSION}:${QR_TYPE_PATIENT}:${keyId}:${credentialId}:${patientId}:${credentialVersion}:${issuedAt}`;
}

/** Appends the base64url signature to a signed message, producing the QR text. */
export function assembleQrPayload(signedMessage: string, signatureBase64Url: string): string {
  const payload = `${signedMessage}:${signatureBase64Url}`;
  if (!V2_PATTERN.test(payload)) throw new Error("Invalid QR payload");
  return payload;
}

export type QrParseFailure = "NOT_CASEVAC" | "LEGACY_UNSIGNED" | "UNSUPPORTED_VERSION" | "MALFORMED";

export type ParsedQrPayload =
  | {
      ok: true;
      version: typeof QR_FORMAT_VERSION;
      claims: PatientCredentialClaims;
      /** Exact bytes the signature covers. */
      signedMessage: string;
      signature: string;
    }
  | { ok: false; reason: QrParseFailure };

/** Structural parse only — does NOT verify the signature. */
export function parseQrPayload(raw: string): ParsedQrPayload {
  const text = raw.trim();
  const parts = text.split(":");
  if (parts[0] !== QR_NAMESPACE || parts.length < 2) return { ok: false, reason: "NOT_CASEVAC" };
  if (parts[1] === String(LEGACY_QR_FORMAT_VERSION)) {
    return parts.length === 3 && LEGACY_TOKEN_PATTERN.test(parts[2])
      ? { ok: false, reason: "LEGACY_UNSIGNED" }
      : { ok: false, reason: "MALFORMED" };
  }
  if (parts[1] !== String(QR_FORMAT_VERSION)) return { ok: false, reason: "UNSUPPORTED_VERSION" };
  const m = V2_PATTERN.exec(text);
  if (!m) return { ok: false, reason: "MALFORMED" };
  return {
    ok: true,
    version: QR_FORMAT_VERSION,
    claims: {
      keyId: m[1],
      credentialId: m[2],
      patientId: m[3],
      credentialVersion: Number(m[4]),
      issuedAt: Number(m[5]),
    },
    signedMessage: text.slice(0, text.lastIndexOf(":")),
    signature: m[6],
  };
}

/** Human description of the payload format for UI copy. */
export const QR_FORMAT_DESCRIPTION =
  "CASEVAC:2:P:<keyId>:<credentialId>:<patientId>:<version>:<issuedAt>:<Ed25519 signature>";
