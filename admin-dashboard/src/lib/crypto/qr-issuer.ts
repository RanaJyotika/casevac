/**
 * QR credential issuer — Ed25519 signing (server side only).
 *
 * The private key is read from the server environment:
 *   CASEVAC_QR_ISSUER_KEY_ID       e.g. "dev-issuer-01"
 *   CASEVAC_QR_ISSUER_PRIVATE_KEY  base64url PKCS#8 DER Ed25519 private key
 *
 * Generate a DEVELOPMENT key with `npm run issuer:keygen`. It is written to
 * .env.local (git-ignored). The key never reaches the browser: this module uses
 * node:crypto and is imported only by server-side services.
 *
 * DEVELOPMENT ISSUER ONLY. A production issuer needs a protected signing
 * service (HSM/KMS or an isolated signing host), key rotation and an approved
 * process for distributing trusted public keys to medic phones.
 */
import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from "node:crypto";
import {
  assembleQrPayload,
  buildSignedMessage,
  KEY_ID_PATTERN,
  parseQrPayload,
  QR_ISSUER,
  type PatientCredentialClaims,
} from "../domain/qr-format";

export interface IssuerKey {
  keyId: string;
  issuer: typeof QR_ISSUER;
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Raw 32-byte Ed25519 public key, base64url — what phones need to verify. */
  publicKeyBase64Url: string;
}

export type IssuerKeyResult = { ok: true; key: IssuerKey } | { ok: false; message: string };

const NOT_CONFIGURED =
  "QR signing key is not configured. Run `npm run issuer:keygen` in admin-dashboard, then restart the dashboard.";

let testOverride: IssuerKey | null | undefined;
let cache: { envKeyId: string; envKey: string; result: IssuerKeyResult } | null = null;

/** Builds an IssuerKey from a base64url PKCS#8 DER private key. */
export function issuerKeyFromPkcs8(keyId: string, pkcs8Base64Url: string): IssuerKeyResult {
  if (!KEY_ID_PATTERN.test(keyId)) {
    return { ok: false, message: "CASEVAC_QR_ISSUER_KEY_ID must be 1–32 characters: lower-case letters, digits, hyphens." };
  }
  let privateKey: KeyObject;
  try {
    privateKey = createPrivateKey({ key: Buffer.from(pkcs8Base64Url, "base64url"), format: "der", type: "pkcs8" });
  } catch {
    return { ok: false, message: "CASEVAC_QR_ISSUER_PRIVATE_KEY is not a valid PKCS#8 private key." };
  }
  if (privateKey.asymmetricKeyType !== "ed25519") {
    return { ok: false, message: "CASEVAC_QR_ISSUER_PRIVATE_KEY must be an Ed25519 key." };
  }
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: "jwk" });
  if (typeof jwk.x !== "string") return { ok: false, message: "Could not derive the issuer public key." };
  return { ok: true, key: { keyId, issuer: QR_ISSUER, privateKey, publicKey, publicKeyBase64Url: jwk.x } };
}

/** The configured issuer key, or a plain-language reason it is unavailable. */
export function getIssuerKey(): IssuerKeyResult {
  if (testOverride !== undefined) {
    return testOverride ? { ok: true, key: testOverride } : { ok: false, message: NOT_CONFIGURED };
  }
  const envKeyId = process.env.CASEVAC_QR_ISSUER_KEY_ID?.trim() ?? "";
  const envKey = process.env.CASEVAC_QR_ISSUER_PRIVATE_KEY?.trim() ?? "";
  if (cache && cache.envKeyId === envKeyId && cache.envKey === envKey) return cache.result;
  const result: IssuerKeyResult = !envKeyId || !envKey ? { ok: false, message: NOT_CONFIGURED } : issuerKeyFromPkcs8(envKeyId, envKey);
  cache = { envKeyId, envKey, result };
  return result;
}

/** Test helper: use a fixed key (or `null` = not configured; `undefined` = environment). */
export function setIssuerKeyForTesting(key: IssuerKey | null | undefined): void {
  testOverride = key;
}

/** Signs patient credential claims and returns the exact QR text. */
export function signPatientCredential(
  key: IssuerKey,
  claims: Omit<PatientCredentialClaims, "keyId">,
): string {
  const message = buildSignedMessage({ ...claims, keyId: key.keyId });
  const signature = sign(null, Buffer.from(message, "ascii"), key.privateKey);
  return assembleQrPayload(message, signature.toString("base64url"));
}

export type CredentialVerification =
  | { ok: true; claims: PatientCredentialClaims }
  | { ok: false; reason: "NOT_CASEVAC" | "LEGACY_UNSIGNED" | "UNSUPPORTED_VERSION" | "MALFORMED" | "UNKNOWN_KEY" | "BAD_SIGNATURE" };

/** Parses and verifies a payload against the given trusted key. */
export function verifyPatientCredential(raw: string, key: IssuerKey): CredentialVerification {
  const parsed = parseQrPayload(raw);
  if (!parsed.ok) return { ok: false, reason: parsed.reason };
  if (parsed.claims.keyId !== key.keyId) return { ok: false, reason: "UNKNOWN_KEY" };
  const signature = Buffer.from(parsed.signature, "base64url");
  // Reject non-canonical base64url so each signature has exactly one encoding.
  if (signature.length !== 64 || signature.toString("base64url") !== parsed.signature) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }
  const valid = verify(null, Buffer.from(parsed.signedMessage, "ascii"), key.publicKey, signature);
  return valid ? { ok: true, claims: parsed.claims } : { ok: false, reason: "BAD_SIGNATURE" };
}
