/**
 * Minimal WebAuthn (passkey) verification for admin step-up checks, built on
 * node:crypto. Used with platform authenticators only (Windows Hello PIN,
 * fingerprint or face) and always with user verification required.
 *
 * Registration uses attestation "none": we trust the public key the browser
 * extracted (AuthenticatorAttestationResponse.getPublicKey()) because the
 * ceremony already runs inside an authenticated admin session. What matters
 * for the step-up check is the assertion, which is fully verified here:
 * challenge, origin, RP ID hash, user-present + user-verified flags,
 * signature and signature counter.
 */
import { createHash, createPublicKey, randomBytes, verify, type KeyObject } from "node:crypto";

export interface RelyingParty {
  /** Hostname, e.g. "localhost" or "admin.casevac.example". */
  id: string;
  /** Full origin the browser reports, e.g. "http://localhost:3000". */
  origin: string;
  name: string;
}

/** COSE algorithms we accept: ES256, RS256 (Windows Hello default), EdDSA. */
export const SUPPORTED_ALGORITHMS = [-7, -257, -8] as const;

const FLAG_USER_PRESENT = 0x01;
const FLAG_USER_VERIFIED = 0x04;
const FLAG_ATTESTED_DATA = 0x40;

/* ----------------------------- Challenges ----------------------------- */

export type ChallengePurpose = "register" | "reveal";

interface PendingChallenge {
  adminId: string;
  purpose: ChallengePurpose;
  /** What the challenge authorises, e.g. the person whose password is revealed. */
  subject: string | null;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 2 * 60 * 1000;
/**
 * In-process store, like the sign-in throttle. A multi-instance deployment
 * needs a shared store (database/Redis) instead.
 */
const pending = new Map<string, PendingChallenge>();

export function createChallenge(adminId: string, purpose: ChallengePurpose, subject: string | null = null): string {
  const now = Date.now();
  for (const [key, value] of pending) if (value.expiresAt <= now) pending.delete(key);
  const challenge = randomBytes(32).toString("base64url");
  pending.set(challenge, { adminId, purpose, subject, expiresAt: now + CHALLENGE_TTL_MS });
  return challenge;
}

/** Single use: the challenge is removed whether or not it matches. */
function consumeChallenge(challenge: string, adminId: string, purpose: ChallengePurpose, subject: string | null): boolean {
  const entry = pending.get(challenge);
  pending.delete(challenge);
  return Boolean(
    entry && entry.expiresAt > Date.now() && entry.adminId === adminId && entry.purpose === purpose && entry.subject === subject,
  );
}

/** Test helper. */
export function resetChallengesForTesting(): void {
  pending.clear();
}

/* ------------------------------ Parsing ------------------------------ */

interface ClientData {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
}

function parseClientData(raw: Buffer): ClientData | null {
  try {
    const data = JSON.parse(raw.toString("utf8")) as Partial<ClientData>;
    if (typeof data.type !== "string" || typeof data.challenge !== "string" || typeof data.origin !== "string") return null;
    return data as ClientData;
  } catch {
    return null;
  }
}

interface AuthenticatorData {
  rpIdHash: Buffer;
  flags: number;
  signCount: number;
  credentialId: Buffer | null;
}

export function parseAuthenticatorData(data: Buffer): AuthenticatorData | null {
  if (data.length < 37) return null;
  const flags = data[32];
  let credentialId: Buffer | null = null;
  if (flags & FLAG_ATTESTED_DATA) {
    // aaguid (16) | credentialIdLength (2) | credentialId | credentialPublicKey (CBOR)
    if (data.length < 55) return null;
    const length = data.readUInt16BE(53);
    if (data.length < 55 + length) return null;
    credentialId = data.subarray(55, 55 + length);
  }
  return { rpIdHash: data.subarray(0, 32), flags, signCount: data.readUInt32BE(33), credentialId };
}

const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest();

function b64(value: unknown): Buffer | null {
  if (typeof value !== "string" || !value || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  return Buffer.from(value, "base64url");
}

type Check = { ok: true } | { ok: false; message: string };

function checkCeremony(
  rp: RelyingParty,
  clientDataRaw: Buffer,
  authData: AuthenticatorData,
  type: "webauthn.create" | "webauthn.get",
  adminId: string,
  purpose: ChallengePurpose,
  subject: string | null,
): Check {
  const clientData = parseClientData(clientDataRaw);
  if (!clientData || clientData.type !== type) return { ok: false, message: "Unexpected verification response." };
  if (!consumeChallenge(clientData.challenge, adminId, purpose, subject)) {
    return { ok: false, message: "Verification expired. Try again." };
  }
  if (clientData.origin !== rp.origin || clientData.crossOrigin) {
    return { ok: false, message: "Verification came from an unexpected site." };
  }
  if (!authData.rpIdHash.equals(sha256(rp.id))) return { ok: false, message: "Verification was for a different site." };
  if (!(authData.flags & FLAG_USER_PRESENT) || !(authData.flags & FLAG_USER_VERIFIED)) {
    return { ok: false, message: "Windows Hello did not verify the user (PIN, fingerprint or face required)." };
  }
  return { ok: true };
}

/* ---------------------------- Registration ---------------------------- */

export interface RegistrationResponseJSON {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  /** SubjectPublicKeyInfo DER from getPublicKey(), base64url. */
  publicKey: string;
  algorithm: number;
}

export type RegistrationResult =
  | { ok: true; credentialId: string; publicKey: string; algorithm: number; signCount: number }
  | { ok: false; message: string };

function keyMatchesAlgorithm(key: KeyObject, algorithm: number): boolean {
  if (algorithm === -7) return key.asymmetricKeyType === "ec" && key.asymmetricKeyDetails?.namedCurve === "prime256v1";
  if (algorithm === -257) return key.asymmetricKeyType === "rsa";
  if (algorithm === -8) return key.asymmetricKeyType === "ed25519";
  return false;
}

export function verifyRegistration(rp: RelyingParty, adminId: string, response: RegistrationResponseJSON): RegistrationResult {
  const credentialId = b64(response.credentialId);
  const clientDataRaw = b64(response.clientDataJSON);
  const authDataRaw = b64(response.authenticatorData);
  const publicKeyRaw = b64(response.publicKey);
  if (!credentialId || !clientDataRaw || !authDataRaw || !publicKeyRaw) {
    return { ok: false, message: "This browser did not return a usable Windows Hello key. Use an up-to-date Chrome or Edge." };
  }
  const authData = parseAuthenticatorData(authDataRaw);
  if (!authData?.credentialId) return { ok: false, message: "Unexpected verification response." };
  const check = checkCeremony(rp, clientDataRaw, authData, "webauthn.create", adminId, "register", null);
  if (!check.ok) return check;
  if (!authData.credentialId.equals(credentialId)) return { ok: false, message: "Unexpected verification response." };

  let key: KeyObject;
  try {
    key = createPublicKey({ key: publicKeyRaw, format: "der", type: "spki" });
  } catch {
    return { ok: false, message: "Windows Hello returned an unreadable key." };
  }
  if (!SUPPORTED_ALGORITHMS.includes(response.algorithm as (typeof SUPPORTED_ALGORITHMS)[number]) || !keyMatchesAlgorithm(key, response.algorithm)) {
    return { ok: false, message: "Windows Hello used an unsupported key type." };
  }
  return {
    ok: true,
    credentialId: credentialId.toString("base64url"),
    publicKey: publicKeyRaw.toString("base64url"),
    algorithm: response.algorithm,
    signCount: authData.signCount,
  };
}

/* ----------------------------- Assertion ----------------------------- */

export interface AssertionResponseJSON {
  credentialId: string;
  clientDataJSON: string;
  authenticatorData: string;
  signature: string;
}

export interface StoredPasskey {
  id: string;
  publicKey: string;
  algorithm: number;
  signCount: number;
}

export type AssertionResult = { ok: true; signCount: number } | { ok: false; message: string };

export function verifyAssertion(
  rp: RelyingParty,
  adminId: string,
  subject: string,
  passkey: StoredPasskey,
  response: AssertionResponseJSON,
): AssertionResult {
  const clientDataRaw = b64(response.clientDataJSON);
  const authDataRaw = b64(response.authenticatorData);
  const signature = b64(response.signature);
  if (!clientDataRaw || !authDataRaw || !signature || response.credentialId !== passkey.id) {
    return { ok: false, message: "Unexpected verification response." };
  }
  const authData = parseAuthenticatorData(authDataRaw);
  if (!authData) return { ok: false, message: "Unexpected verification response." };
  const check = checkCeremony(rp, clientDataRaw, authData, "webauthn.get", adminId, "reveal", subject);
  if (!check.ok) return check;

  const signed = Buffer.concat([authDataRaw, sha256(clientDataRaw)]);
  let valid = false;
  try {
    const key = createPublicKey({ key: Buffer.from(passkey.publicKey, "base64url"), format: "der", type: "spki" });
    valid =
      passkey.algorithm === -8
        ? verify(null, signed, key, signature)
        : verify("sha256", signed, passkey.algorithm === -7 ? { key, dsaEncoding: "der" } : key, signature);
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, message: "Windows Hello signature could not be verified." };

  // A counter that does not increase suggests a cloned authenticator. Many
  // platform authenticators always report 0, which is allowed.
  if ((authData.signCount !== 0 || passkey.signCount !== 0) && authData.signCount <= passkey.signCount) {
    return { ok: false, message: "Windows Hello key counter is out of date. Set up this PC again." };
  }
  return { ok: true, signCount: authData.signCount };
}
