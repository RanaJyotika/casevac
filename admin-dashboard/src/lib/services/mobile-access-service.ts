/**
 * Mobile app sign-in accounts for clinical staff (medics, doctors, team leaders).
 *
 * Flow agreed with the client:
 *  1. Admin generates a user ID + password on the dashboard and hands them to
 *     the medic. The password is shown once and stored only as a scrypt hash.
 *  2. The medic signs in on the tablet while it is online at base camp. The
 *     server verifies the password, marks the account ACTIVATED and returns the
 *     medic's profile. The tablet keeps a hashed copy for offline sign-in.
 *  3. Later sign-ins work offline from the tablet's copy. When the tablet next
 *     reaches the server it reports offline sign-ins and learns about revoked
 *     accounts (see syncMobileDevice).
 *  4. Every successful online sign-in also returns the tablet's provisioning:
 *     the patient identity directory (incl. revoked / replaced wristbands) and
 *     the public QR-signing key. Wristband QR codes carry only random IDs and
 *     a signature, so patient details reach a tablet only through this
 *     password-authenticated download — a stray scan reveals nothing.
 *
 * DEMO SECURITY LEVEL: no device enrolment, no MFA, in-memory rate limiting.
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import { getRepository, type RepositoryWriter } from "../data";
import { newInternalId } from "../domain/ids";
import { ROLE_DEFINITIONS } from "../domain/roles";
import type {
  Actor,
  MobileLoginAccount,
  PersonRecord,
  StaffRecord,
} from "../domain/types";
import { validateReason } from "../domain/validation";
import { fail, invalid, nowIso, ok, runTransaction, type ServiceResult } from "./common";
import {
  buildIdentityDirectory,
  buildTrustedIssuerKeys,
  type IdentityDirectory,
  type TrustedIssuerKeys,
} from "./directory-service";

/* ------------------------------ Hashing ------------------------------ */

const SCRYPT_KEYLEN = 32;

export function hashPassword(password: string, salt = randomBytes(16).toString("base64url")) {
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString("base64url");
  return { hash, salt };
}

function passwordMatches(account: MobileLoginAccount, password: string): boolean {
  const expected = Buffer.from(account.passwordHash, "base64url");
  const actual = scryptSync(password, account.passwordSalt, SCRYPT_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** No 0/O, 1/l/I: the password is read aloud or copied by hand. */
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const PASSWORD_LENGTH = 10;

export function generatePassword(): string {
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) out += PASSWORD_ALPHABET[randomInt(PASSWORD_ALPHABET.length)];
  return out;
}

/* ----------------------------- Eligibility ---------------------------- */

/** Only staff whose role may record casualty care get a mobile sign-in. */
export function mobileAccessProblem(person: PersonRecord): string | null {
  if (person.category === "SOLDIER") return "Soldiers are patients and do not sign in to the medic app.";
  const role = ROLE_DEFINITIONS[person.staff.role];
  if (!role.permissions.includes("clinical.record")) {
    return `${role.label} has no mobile app permissions, so no sign-in can be issued.`;
  }
  if (person.status !== "ACTIVE") return "Reactivate this person before issuing a mobile sign-in.";
  return null;
}

/* ------------------------- Admin: issue / revoke ------------------------ */

export interface IssuedMobileLogin {
  account: MobileLoginAccount;
  /** Plaintext — return to the admin once, never store or log it. */
  password: string;
}

async function liveAccountFor(tx: RepositoryWriter, personId: string) {
  return (await tx.listMobileAccounts()).find(a => a.personId === personId && a.status !== "REVOKED") ?? null;
}

/**
 * Generates a new user ID + password. If the person already has a live
 * account it is revoked first (password reset): any tablet holding the old
 * copy drops it the next time it reaches the server.
 */
export async function issueMobileLogin(personId: string, actor: Actor): Promise<ServiceResult<IssuedMobileLogin>> {
  return runTransaction(actor, async (tx, audit) => {
    const person = await tx.getPerson(personId);
    if (!person) return fail("Personnel record not found.");
    const problem = mobileAccessProblem(person);
    if (problem) return fail(problem);

    const now = nowIso();
    const previous = await liveAccountFor(tx, personId);
    if (previous) {
      await tx.updateMobileAccount({
        ...previous,
        status: "REVOKED",
        revokedAt: now,
        revokedBy: actor.id,
        revocationReason: "Password reset",
      });
    }

    const password = generatePassword();
    const { hash, salt } = hashPassword(password);
    const account: MobileLoginAccount = {
      id: newInternalId(),
      personId,
      userId: person.displayId.toUpperCase(),
      passwordHash: hash,
      passwordSalt: salt,
      status: "PENDING_FIRST_LOGIN",
      issuedAt: now,
      issuedBy: actor.id,
      firstLoginAt: null,
      lastOnlineLoginAt: null,
      lastOfflineLoginAt: null,
      onlineLoginCount: 0,
      offlineLoginCount: 0,
      lastDevice: null,
      revokedAt: null,
      revokedBy: null,
      revocationReason: null,
    };
    await tx.insertMobileAccount(account);
    await audit(
      previous ? "MOBILE_LOGIN_RESET" : "MOBILE_LOGIN_ISSUED",
      "MOBILE_LOGIN",
      account.id,
      `${previous ? "Reset" : "Issued"} mobile sign-in ${account.userId} for ${person.displayId}`,
    );
    return ok({ account, password });
  });
}

export async function revokeMobileLogin(personId: string, reason: string, actor: Actor): Promise<ServiceResult<MobileLoginAccount>> {
  const r = validateReason(reason);
  if (!r.ok) return invalid(r.errors);
  return runTransaction(actor, async (tx, audit) => {
    const current = await liveAccountFor(tx, personId);
    if (!current) return fail("There is no active mobile sign-in to revoke.");
    const revoked: MobileLoginAccount = {
      ...current,
      status: "REVOKED",
      revokedAt: nowIso(),
      revokedBy: actor.id,
      revocationReason: r.value,
    };
    await tx.updateMobileAccount(revoked);
    await audit("MOBILE_LOGIN_REVOKED", "MOBILE_LOGIN", current.id, `Revoked mobile sign-in ${current.userId}`);
    return ok(revoked);
  });
}

/* ------------------------------ Queries ------------------------------ */

/** Account fields safe to show on the dashboard (no hash or salt). */
export type MobileAccountView = Omit<MobileLoginAccount, "passwordHash" | "passwordSalt">;

function toView(account: MobileLoginAccount): MobileAccountView {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, passwordSalt, ...rest } = account;
  return rest;
}

export async function getMobileAccessForPerson(personId: string): Promise<{
  current: MobileAccountView | null;
  history: MobileAccountView[];
}> {
  const accounts = (await getRepository().listMobileAccounts())
    .filter(a => a.personId === personId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const current = accounts.find(a => a.status !== "REVOKED") ?? null;
  return { current: current ? toView(current) : null, history: accounts.map(toView) };
}

/** Live (non-revoked) account per person, for list pages. */
export async function listLiveMobileAccounts(): Promise<Map<string, MobileAccountView>> {
  const accounts = await getRepository().listMobileAccounts();
  return new Map(accounts.filter(a => a.status !== "REVOKED").map(a => [a.personId, toView(a)]));
}

/* --------------------------- Tablet: sign in --------------------------- */

/** Profile returned to the tablet and cached there for offline sign-in. */
export interface MobileProfile {
  accountId: string;
  userId: string;
  personId: string;
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  category: StaffRecord["category"];
  role: StaffRecord["staff"]["role"];
  roleLabel: string;
  designation: string;
  permissions: string[];
  teams: { teamCode: string; name: string; leader: boolean }[];
  issuedAt: string;
}

export type MobileSignInError = "INVALID_CREDENTIALS" | "ACCOUNT_DISABLED" | "RATE_LIMITED" | "BAD_REQUEST";

/** What a tablet needs to verify and resolve wristband QR codes offline. */
export interface MobileProvisioning {
  directory: IdentityDirectory;
  /** Null when the dashboard has no QR signing key configured. */
  trustedKeys: TrustedIssuerKeys | null;
}

export type MobileSignInResult =
  | {
      ok: true;
      profile: MobileProfile;
      firstLogin: boolean;
      serverTime: string;
      provisioning: MobileProvisioning;
    }
  | { ok: false; error: MobileSignInError; message: string };

export interface OfflineLoginReport {
  accountId: string;
  count: number;
  /** ISO time of the most recent offline sign-in. */
  lastAt: string | null;
}

export interface MobileSignInInput {
  userId: string;
  password: string;
  device?: string;
  /** Offline sign-ins on this tablet since its last contact with the server. */
  offlineLogins?: OfflineLoginReport[];
}

/* Simple per-user-ID throttle (in-process; good enough for a demo server). */
const FAILURE_WINDOW_MS = 5 * 60 * 1000;
const MAX_FAILURES = 8;
const failures = new Map<string, number[]>();

function isThrottled(userId: string, now = Date.now()): boolean {
  const recent = (failures.get(userId) ?? []).filter(t => now - t < FAILURE_WINDOW_MS);
  failures.set(userId, recent);
  return recent.length >= MAX_FAILURES;
}

function recordFailure(userId: string) {
  failures.set(userId, [...(failures.get(userId) ?? []), Date.now()]);
}

/** Test helper. */
export function resetSignInThrottleForTesting() {
  failures.clear();
}

const INVALID = {
  ok: false as const,
  error: "INVALID_CREDENTIALS" as const,
  message: "User ID or password not recognised.",
};

function cleanDevice(device: string | undefined): string | null {
  const text = (device ?? "").replace(/[^\w .()/:-]/g, "").trim().slice(0, 80);
  return text || null;
}

function applyOfflineReports(account: MobileLoginAccount, reports: OfflineLoginReport[] | undefined): MobileLoginAccount {
  let next = account;
  for (const report of reports ?? []) {
    if (report.accountId !== account.id) continue;
    const count = Number.isInteger(report.count) && report.count > 0 ? Math.min(report.count, 10_000) : 0;
    if (!count) continue;
    const lastAt = report.lastAt && !Number.isNaN(Date.parse(report.lastAt)) ? new Date(report.lastAt).toISOString() : null;
    next = {
      ...next,
      offlineLoginCount: next.offlineLoginCount + count,
      lastOfflineLoginAt:
        lastAt && (!next.lastOfflineLoginAt || lastAt > next.lastOfflineLoginAt) ? lastAt : next.lastOfflineLoginAt,
    };
  }
  return next;
}

export async function mobileSignIn(input: MobileSignInInput): Promise<MobileSignInResult> {
  const userId = (input.userId ?? "").trim().toUpperCase();
  const password = input.password ?? "";
  if (!userId || !password || userId.length > 40 || password.length > 200) {
    return { ok: false, error: "BAD_REQUEST", message: "Enter a user ID and password." };
  }
  if (isThrottled(userId)) {
    return { ok: false, error: "RATE_LIMITED", message: "Too many failed attempts. Wait a few minutes and try again." };
  }

  const systemActor: Actor = { id: userId, name: "Medic app" };
  // Failures still commit (so the failed attempt is audited), hence a union
  // inside an ok() rather than a rolled-back fail().
  type Outcome =
    | { kind: "invalid" }
    | { kind: "disabled" }
    | { kind: "signed-in"; profile: MobileProfile; firstLogin: boolean };
  const result = await runTransaction<Outcome>(systemActor, async (tx, audit) => {
    const account = await tx.findMobileAccountByUserId(userId);
    if (!account || !passwordMatches(account, password)) {
      if (account) await audit("MOBILE_LOGIN_FAILED", "MOBILE_LOGIN", account.id, `Failed mobile sign-in for ${userId}`);
      return ok({ kind: "invalid" });
    }
    const person = await tx.getPerson(account.personId);
    if (account.status === "REVOKED" || !person || mobileAccessProblem(person)) {
      return ok({ kind: "disabled" });
    }
    const staff = person as StaffRecord;
    const now = nowIso();
    const firstLogin = account.status === "PENDING_FIRST_LOGIN";
    const updated: MobileLoginAccount = {
      ...applyOfflineReports(account, input.offlineLogins),
      status: "ACTIVATED",
      firstLoginAt: account.firstLoginAt ?? now,
      lastOnlineLoginAt: now,
      onlineLoginCount: account.onlineLoginCount + 1,
      lastDevice: cleanDevice(input.device) ?? account.lastDevice,
    };
    await tx.updateMobileAccount(updated);
    await audit(
      firstLogin ? "MOBILE_LOGIN_ACTIVATED" : "MOBILE_LOGIN_ONLINE",
      "MOBILE_LOGIN",
      account.id,
      firstLogin ? `First mobile sign-in for ${userId}; offline copy saved on tablet` : `Online mobile sign-in for ${userId}`,
    );

    const role = ROLE_DEFINITIONS[staff.staff.role];
    const teams = (await tx.listTeams())
      .filter(t => t.status === "ACTIVE" && t.memberIds.includes(staff.id))
      .map(t => ({ teamCode: t.teamCode, name: t.name, leader: t.leaderId === staff.id }));
    return ok({
      kind: "signed-in",
      firstLogin,
      profile: {
        accountId: account.id,
        userId: account.userId,
        personId: staff.id,
        displayId: staff.displayId,
        fullName: staff.fullName,
        rank: staff.rank,
        unit: staff.unit,
        category: staff.category,
        role: staff.staff.role,
        roleLabel: role.label,
        designation: staff.staff.designation,
        permissions: role.permissions.filter(p => p.startsWith("clinical.")),
        teams,
        issuedAt: account.issuedAt,
      },
    });
  });

  const outcome: Outcome = result.ok ? result.value : { kind: "invalid" };
  if (outcome.kind === "invalid") {
    recordFailure(userId);
    return INVALID;
  }
  if (outcome.kind === "disabled") {
    return {
      ok: false,
      error: "ACCOUNT_DISABLED",
      message: "This sign-in has been revoked or the account is inactive. Contact your unit registrar.",
    };
  }
  const provisioning: MobileProvisioning = {
    directory: await buildIdentityDirectory(),
    trustedKeys: buildTrustedIssuerKeys(),
  };
  await runTransaction({ id: userId, name: "Medic app" }, async (_tx, audit) => {
    await audit(
      "DIRECTORY_EXPORTED",
      "MOBILE_LOGIN",
      outcome.profile.accountId,
      `Sent identity directory to ${userId}'s tablet (${provisioning.directory.patients.length} patients, ${provisioning.directory.credentials.length} credentials)`,
    );
    return ok(null);
  });
  return {
    ok: true,
    profile: outcome.profile,
    firstLogin: outcome.firstLogin,
    serverTime: nowIso(),
    provisioning,
  };
}

/* --------------------------- Tablet: sync --------------------------- */

export interface DeviceSyncInput {
  device?: string;
  accounts: { accountId: string; userId: string; offlineLogins?: Omit<OfflineLoginReport, "accountId"> }[];
}

export interface DeviceSyncResult {
  accounts: { accountId: string; status: "VALID" | "REVOKED" }[];
}

/**
 * Called by a tablet whenever it reaches the server: reports offline sign-ins
 * and learns which cached accounts were revoked (so it can delete them).
 * Accounts are identified by their random internal ID, which only a tablet
 * that completed an online sign-in knows.
 */
export async function syncMobileDevice(input: DeviceSyncInput): Promise<DeviceSyncResult> {
  const items = (input.accounts ?? []).slice(0, 50);
  if (items.length === 0) return { accounts: [] };
  const actor: Actor = { id: "MOBILE-SYNC", name: "Medic app" };
  const result = await runTransaction<DeviceSyncResult>(actor, async tx => {
    const all = await tx.listMobileAccounts();
    const out: DeviceSyncResult["accounts"] = [];
    for (const item of items) {
      const account = all.find(a => a.id === item.accountId && a.userId === (item.userId ?? "").trim().toUpperCase());
      if (!account) {
        out.push({ accountId: item.accountId, status: "REVOKED" });
        continue;
      }
      const person = await tx.getPerson(account.personId);
      const valid = account.status !== "REVOKED" && !!person && !mobileAccessProblem(person);
      if (valid && item.offlineLogins) {
        const updated = applyOfflineReports(account, [{ accountId: account.id, ...item.offlineLogins }]);
        if (updated !== account) await tx.updateMobileAccount(updated);
      }
      out.push({ accountId: item.accountId, status: valid ? "VALID" : "REVOKED" });
    }
    return ok({ accounts: out });
  });
  return result.ok ? result.value : { accounts: [] };
}
