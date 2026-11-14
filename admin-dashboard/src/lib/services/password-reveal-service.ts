/**
 * Viewing a medic's stored mobile sign-in password on the dashboard.
 *
 * The admin must re-verify first, like a browser's saved-passwords page:
 *  - Windows Hello on this PC (WebAuthn platform passkey, user verification
 *    required), set up once per admin per PC; or
 *  - re-entering the dashboard admin password, for PCs without Windows Hello.
 * The password is decrypted only after the server has checked that proof.
 * Every view is audited.
 */
import { isLoginVaultConfigured, openPassword } from "../crypto/login-vault";
import { getRepository, type RepositoryWriter } from "../data";
import type { Actor, AdminPasskey } from "../domain/types";
import { verifyDemoCredentials } from "../auth/session";
import {
  createChallenge,
  SUPPORTED_ALGORITHMS,
  verifyAssertion,
  verifyRegistration,
  type AssertionResponseJSON,
  type RegistrationResponseJSON,
  type RelyingParty,
} from "../auth/webauthn";
import { fail, nowIso, ok, runTransaction, type AuditFn, type ServiceResult } from "./common";

const TIMEOUT_MS = 60_000;

/** JSON-safe options; the browser converts base64url fields to ArrayBuffers. */
export interface RegistrationOptionsJSON {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: "public-key"; alg: number }[];
  excludeCredentials: { type: "public-key"; id: string }[];
  timeout: number;
}

export interface RequestOptionsJSON {
  challenge: string;
  rpId: string;
  allowCredentials: { type: "public-key"; id: string }[];
  timeout: number;
}

export async function beginPasskeyRegistration(actor: Actor, rp: RelyingParty): Promise<RegistrationOptionsJSON> {
  const existing = await getRepository().listAdminPasskeys(actor.id);
  return {
    challenge: createChallenge(actor.id, "register"),
    rp: { id: rp.id, name: rp.name },
    user: { id: Buffer.from(actor.id, "utf8").toString("base64url"), name: actor.id, displayName: actor.name },
    pubKeyCredParams: SUPPORTED_ALGORITHMS.map(alg => ({ type: "public-key" as const, alg })),
    excludeCredentials: existing.map(k => ({ type: "public-key" as const, id: k.id })),
    timeout: TIMEOUT_MS,
  };
}

export async function finishPasskeyRegistration(
  actor: Actor,
  rp: RelyingParty,
  response: RegistrationResponseJSON,
  label: string,
): Promise<ServiceResult<null>> {
  const result = verifyRegistration(rp, actor.id, response);
  if (!result.ok) return fail(result.message);
  return runTransaction(actor, async (tx, audit) => {
    if ((await tx.listAdminPasskeys(actor.id)).some(k => k.id === result.credentialId)) {
      return fail("This PC is already set up.");
    }
    const passkey: AdminPasskey = {
      id: result.credentialId,
      adminId: actor.id,
      publicKey: result.publicKey,
      algorithm: result.algorithm,
      signCount: result.signCount,
      label: label.replace(/[^\w .()/·-]/g, "").slice(0, 60) || "Windows Hello",
      createdAt: nowIso(),
      lastUsedAt: null,
    };
    await tx.insertAdminPasskey(passkey);
    await audit("ADMIN_PASSKEY_REGISTERED", "SYSTEM", null, `${actor.id} set up Windows Hello verification (${passkey.label})`);
    return ok(null);
  });
}

export type BeginRevealResult =
  | { status: "verify"; options: RequestOptionsJSON }
  | { status: "needs-setup" }
  | { status: "error"; message: string };

export async function beginPasswordReveal(actor: Actor, rp: RelyingParty, personId: string): Promise<BeginRevealResult> {
  const problem = await revealProblem(personId);
  if (problem) return { status: "error", message: problem };
  const passkeys = await getRepository().listAdminPasskeys(actor.id);
  if (!passkeys.length) return { status: "needs-setup" };
  return {
    status: "verify",
    options: {
      challenge: createChallenge(actor.id, "reveal", personId),
      rpId: rp.id,
      allowCredentials: passkeys.map(k => ({ type: "public-key" as const, id: k.id })),
      timeout: TIMEOUT_MS,
    },
  };
}

export async function finishPasswordReveal(
  actor: Actor,
  rp: RelyingParty,
  personId: string,
  response: AssertionResponseJSON,
): Promise<ServiceResult<string>> {
  return runTransaction(actor, async (tx, audit) => {
    const passkey = (await tx.listAdminPasskeys(actor.id)).find(k => k.id === response.credentialId);
    if (!passkey) return fail("This PC is not set up for Windows Hello verification yet.");
    const check = verifyAssertion(rp, actor.id, personId, passkey, response);
    if (!check.ok) return fail(check.message);
    await tx.updateAdminPasskey({ ...passkey, signCount: check.signCount, lastUsedAt: nowIso() });
    return readPassword(tx, personId, audit, "Windows Hello");
  });
}

/* Fallback for PCs without Windows Hello: re-enter the dashboard password. */
const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 5;
const adminFailures = new Map<string, number[]>();

export async function revealWithAdminPassword(actor: Actor, personId: string, password: string): Promise<ServiceResult<string>> {
  const now = Date.now();
  const recent = (adminFailures.get(actor.id) ?? []).filter(t => now - t < FAILURE_WINDOW_MS);
  if (recent.length >= MAX_FAILURES) return fail("Too many wrong passwords. Wait a few minutes and try again.");
  if (!verifyDemoCredentials(actor.id, password)) {
    adminFailures.set(actor.id, [...recent, now]);
    return fail("Admin password not recognised.");
  }
  adminFailures.delete(actor.id);
  return runTransaction(actor, async (tx, audit) => readPassword(tx, personId, audit, "admin password"));
}

/** Test helper. */
export function resetRevealThrottleForTesting(): void {
  adminFailures.clear();
}

/* ------------------------------ Internals ------------------------------ */

async function revealProblem(personId: string): Promise<string | null> {
  if (!isLoginVaultConfigured()) return "Password viewing is not configured on this server (CASEVAC_LOGIN_VAULT_KEY).";
  const account = (await getRepository().listMobileAccounts()).find(a => a.personId === personId && a.status !== "REVOKED");
  if (!account) return "There is no active mobile sign-in for this person.";
  if (!account.passwordVault) return "This password was issued before viewing was enabled. Reset the password to make it viewable.";
  return null;
}

async function readPassword(
  tx: RepositoryWriter,
  personId: string,
  audit: AuditFn,
  method: string,
): Promise<ServiceResult<string>> {
  const account = (await tx.listMobileAccounts()).find(a => a.personId === personId && a.status !== "REVOKED");
  if (!account) return fail("There is no active mobile sign-in for this person.");
  if (!account.passwordVault) return fail("This password was issued before viewing was enabled. Reset the password to make it viewable.");
  const password = openPassword(account.passwordVault, account.id);
  if (password === null) return fail("The stored password could not be decrypted. The vault key may have changed — reset the password.");
  await audit("MOBILE_LOGIN_PASSWORD_VIEWED", "MOBILE_LOGIN", account.id, `Viewed mobile sign-in password for ${account.userId} (verified by ${method})`);
  return ok(password);
}
