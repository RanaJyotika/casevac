import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetChallengesForTesting, type RelyingParty } from "@/lib/auth/webauthn";
import { openPassword, sealPassword, setLoginVaultKeyForTesting } from "@/lib/crypto/login-vault";
import { getRepository, setRepositoryForTesting } from "@/lib/data";
import { JsonFileRepository } from "@/lib/data/json-file-repository";
import type { Actor, StaffRecord } from "@/lib/domain/types";
import { getMobileAccessForPerson, issueMobileLogin, mobileSignIn } from "@/lib/services/mobile-access-service";
import {
  beginPasskeyRegistration,
  beginPasswordReveal,
  finishPasskeyRegistration,
  finishPasswordReveal,
  resetRevealThrottleForTesting,
  revealWithAdminPassword,
} from "@/lib/services/password-reveal-service";
import { registerStaff } from "@/lib/services/personnel-service";

const actor: Actor = { id: "ADM-TEST-01", name: "Test Admin" };
const rp: RelyingParty = { id: "localhost", origin: "http://localhost:3000", name: "CASEVAC Admin" };
let dir: string;

const b64 = (b: Buffer) => b.toString("base64url");
const sha256 = (d: Buffer | string) => createHash("sha256").update(d).digest();

function unwrap<T>(r: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!r.ok) throw new Error(`Expected success, got: ${r.message}`);
  return r.value;
}

async function medicWithLogin(sn = "DEMO-M-1") {
  const person: StaffRecord = unwrap(
    await registerStaff({ fullName: "Anita Verma", serviceNumber: sn, rank: "Naik", unit: "Demo FA", role: "MEDIC", designation: "RMO" }, actor),
  );
  const issued = unwrap(await issueMobileLogin(person.id, actor));
  return { person, issued };
}

/** A fake Windows Hello authenticator holding one key pair. */
function authenticator(kind: "ec" | "rsa" = "ec") {
  const { privateKey, publicKey } =
    kind === "ec" ? generateKeyPairSync("ec", { namedCurve: "prime256v1" }) : generateKeyPairSync("rsa", { modulusLength: 2048 });
  const credentialId = randomBytes(16);
  let counter = 0;
  const flagsFor = (uv: boolean, attested: boolean) => 0x01 | (uv ? 0x04 : 0) | (attested ? 0x40 : 0);

  function authData(flags: number, attested: boolean): Buffer {
    const count = Buffer.alloc(4);
    count.writeUInt32BE(counter);
    const parts = [sha256(rp.id), Buffer.from([flags]), count];
    if (attested) {
      const len = Buffer.alloc(2);
      len.writeUInt16BE(credentialId.length);
      parts.push(Buffer.alloc(16), len, credentialId, Buffer.from([0xa0]));
    }
    return Buffer.concat(parts);
  }

  return {
    register(challenge: string) {
      const clientData = Buffer.from(JSON.stringify({ type: "webauthn.create", challenge, origin: rp.origin }));
      return {
        credentialId: b64(credentialId),
        clientDataJSON: b64(clientData),
        authenticatorData: b64(authData(flagsFor(true, true), true)),
        publicKey: b64((publicKey as KeyObject).export({ type: "spki", format: "der" })),
        algorithm: kind === "ec" ? -7 : -257,
      };
    },
    assert(challenge: string, opts: { uv?: boolean; origin?: string } = {}) {
      counter += 1;
      const clientData = Buffer.from(JSON.stringify({ type: "webauthn.get", challenge, origin: opts.origin ?? rp.origin }));
      const data = authData(flagsFor(opts.uv ?? true, false), false);
      const signature = sign("sha256", Buffer.concat([data, sha256(clientData)]), privateKey);
      return { credentialId: b64(credentialId), clientDataJSON: b64(clientData), authenticatorData: b64(data), signature: b64(signature) };
    },
  };
}

async function setUpPasskey(kind: "ec" | "rsa" = "ec") {
  const device = authenticator(kind);
  const options = await beginPasskeyRegistration(actor, rp);
  unwrap(await finishPasskeyRegistration(actor, rp, device.register(options.challenge), "Windows · Chrome"));
  return device;
}

async function challengeFor(personId: string): Promise<string> {
  const begin = await beginPasswordReveal(actor, rp, personId);
  if (begin.status !== "verify") throw new Error(`Expected verify, got ${begin.status}`);
  return begin.options.challenge;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "casevac-reveal-"));
  setRepositoryForTesting(new JsonFileRepository(path.join(dir, "db.json")));
  setLoginVaultKeyForTesting(randomBytes(32));
  resetChallengesForTesting();
  resetRevealThrottleForTesting();
});

afterEach(() => {
  setRepositoryForTesting(null);
  setLoginVaultKeyForTesting(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("login vault", () => {
  it("round-trips and is bound to the account ID", () => {
    const vault = sealPassword("Abc23xyz9Q", "acct-1")!;
    expect(vault).toMatch(/^v1\./);
    expect(vault).not.toContain("Abc23xyz9Q");
    expect(openPassword(vault, "acct-1")).toBe("Abc23xyz9Q");
    expect(openPassword(vault, "acct-2")).toBeNull();
  });

  it("stores nothing when no key is configured", () => {
    setLoginVaultKeyForTesting(null);
    expect(sealPassword("x", "acct-1")).toBeNull();
  });
});

describe("password reveal with Windows Hello", () => {
  it("asks for setup first, then reveals the issued password and audits it", async () => {
    const { person, issued } = await medicWithLogin();
    expect((await getMobileAccessForPerson(person.id)).current?.passwordViewable).toBe(true);
    expect(await beginPasswordReveal(actor, rp, person.id)).toEqual({ status: "needs-setup" });

    const device = await setUpPasskey();
    const password = unwrap(await finishPasswordReveal(actor, rp, person.id, device.assert(await challengeFor(person.id))));
    expect(password).toBe(issued.password);

    const audit = await getRepository().listAuditEvents(10);
    expect(audit.some(e => e.action === "ADMIN_PASSKEY_REGISTERED")).toBe(true);
    expect(audit.find(e => e.action === "MOBILE_LOGIN_PASSWORD_VIEWED")?.summary).toContain("Windows Hello");
  });

  it("works with RSA keys (Windows Hello default)", async () => {
    const { person, issued } = await medicWithLogin();
    const device = await setUpPasskey("rsa");
    expect(unwrap(await finishPasswordReveal(actor, rp, person.id, device.assert(await challengeFor(person.id))))).toBe(issued.password);
  });

  it("rejects missing user verification, wrong origin, replays and other people's challenges", async () => {
    const { person } = await medicWithLogin("DEMO-M-1");
    const { person: other } = await medicWithLogin("DEMO-M-2");
    const device = await setUpPasskey();

    const noUv = await finishPasswordReveal(actor, rp, person.id, device.assert(await challengeFor(person.id), { uv: false }));
    expect(noUv.ok).toBe(false);

    const phishing = await finishPasswordReveal(actor, rp, person.id, device.assert(await challengeFor(person.id), { origin: "https://evil.example" }));
    expect(phishing.ok).toBe(false);

    const challenge = await challengeFor(person.id);
    unwrap(await finishPasswordReveal(actor, rp, person.id, device.assert(challenge)));
    expect((await finishPasswordReveal(actor, rp, person.id, device.assert(challenge))).ok).toBe(false);

    const swapped = await finishPasswordReveal(actor, rp, other.id, device.assert(await challengeFor(person.id)));
    expect(swapped.ok).toBe(false);
  });

  it("rejects a signature from a different key", async () => {
    const { person } = await medicWithLogin();
    await setUpPasskey();
    const impostor = authenticator();
    const forged = { ...impostor.assert(await challengeFor(person.id)) };
    const registered = (await getRepository().listAdminPasskeys(actor.id))[0];
    expect((await finishPasswordReveal(actor, rp, person.id, { ...forged, credentialId: registered.id })).ok).toBe(false);
  });

  it("explains that logins issued before viewing existed must be reset", async () => {
    setLoginVaultKeyForTesting(null);
    const { person } = await medicWithLogin();
    setLoginVaultKeyForTesting(randomBytes(32));
    expect((await getMobileAccessForPerson(person.id)).current?.passwordViewable).toBe(false);
    const begin = await beginPasswordReveal(actor, rp, person.id);
    expect(begin.status === "error" && begin.message).toMatch(/Reset the password/);
  });

  it("never sends the encrypted password to tablets", async () => {
    const { issued } = await medicWithLogin();
    const vault = (await getRepository().listMobileAccounts())[0].passwordVault!;
    const result = await mobileSignIn({ userId: issued.account.userId, password: issued.password });
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).not.toContain(vault);
  });
});

describe("password reveal with the admin password (no Windows Hello)", () => {
  it("reveals with the right password, rejects and throttles wrong ones", async () => {
    process.env.DEMO_ADMIN_ID = actor.id;
    process.env.DEMO_ADMIN_PASSWORD = "correct horse battery";
    const { person, issued } = await medicWithLogin();
    expect(unwrap(await revealWithAdminPassword(actor, person.id, "correct horse battery"))).toBe(issued.password);
    for (let i = 0; i < 5; i++) expect((await revealWithAdminPassword(actor, person.id, "wrong")).ok).toBe(false);
    const locked = await revealWithAdminPassword(actor, person.id, "correct horse battery");
    expect(locked.ok === false && locked.message).toMatch(/Too many/);
  });
});
