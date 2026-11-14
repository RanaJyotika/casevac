import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { issuerKeyFromPkcs8, setIssuerKeyForTesting } from "@/lib/crypto/qr-issuer";
import { setTransferKeyForTesting } from "@/lib/crypto/transfer-key";
import { getRepository, setRepositoryForTesting } from "@/lib/data";
import { parseQrPayload } from "@/lib/domain/qr-format";
import { JsonFileRepository } from "@/lib/data/json-file-repository";
import type { Actor, PersonRecord, StaffRecord } from "@/lib/domain/types";
import {
  getMobileAccessForPerson,
  issueMobileLogin,
  mobileAccessProblem,
  mobileSignIn,
  resetSignInThrottleForTesting,
  revokeMobileLogin,
  syncMobileDevice,
} from "@/lib/services/mobile-access-service";
import { registerSoldier, registerStaff, updateStaff } from "@/lib/services/personnel-service";

const actor: Actor = { id: "ADM-TEST-01", name: "Test Admin" };
/** A tiny valid JPEG data URL (content irrelevant to the server). */
const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////8=";
let dir: string;

function unwrap<T>(r: { ok: true; value: T } | { ok: false; message: string }): T {
  if (!r.ok) throw new Error(`Expected success, got: ${r.message}`);
  return r.value;
}

async function medic(role = "MEDIC", sn = "DEMO-M-1"): Promise<StaffRecord> {
  return unwrap(await registerStaff({ fullName: "Anita Verma", serviceNumber: sn, rank: "Naik", unit: "Demo FA", role, designation: "RMO" }, actor));
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "casevac-mobile-"));
  setRepositoryForTesting(new JsonFileRepository(path.join(dir, "db.json")));
  resetSignInThrottleForTesting();
  setTransferKeyForTesting(null);
});

afterEach(() => {
  setRepositoryForTesting(null);
  setIssuerKeyForTesting(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("issuing mobile sign-ins", () => {
  it("generates a user ID and a one-time password, stored only as a hash", async () => {
    const person = await medic();
    const { account, password } = unwrap(await issueMobileLogin(person.id, actor));
    expect(account.userId).toBe(person.displayId);
    expect(account.status).toBe("PENDING_FIRST_LOGIN");
    expect(password).toMatch(/^[A-Za-z2-9]{10}$/);
    const stored = await getRepository().listMobileAccounts();
    expect(JSON.stringify(stored)).not.toContain(password);
  });

  it("refuses soldiers", () => {
    expect(mobileAccessProblem({ category: "SOLDIER" } as PersonRecord)).toMatch(/patients/);
  });

  it("refuses non-clinical staff", async () => {
    const admin = await medic("ADMIN_OFFICER", "DEMO-A-1");
    const result = await issueMobileLogin(admin.id, actor);
    expect(result.ok).toBe(false);
  });
});

describe("provisioning sent at sign-in", () => {
  it("returns the identity directory and trusted key so a scanned QR resolves offline", async () => {
    const der = generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
    const key = issuerKeyFromPkcs8("test-issuer", der);
    if (!key.ok) throw new Error(key.message);
    setIssuerKeyForTesting(key.key);

    const { person: soldier, credential } = unwrap(
      await registerSoldier(
        {
          fullName: "Rahul Sharma",
          serviceNumber: "DEMO-S-1",
          rank: "Sepoy",
          unit: "2 Demo Rifles",
          bloodGroup: "B",
          rhFactor: "POSITIVE",
          sex: "MALE",
          dateOfBirth: "1998-04-12",
          photo: PHOTO,
        } as never,
        actor,
      ),
    );
    const doc = await medic("MEDICAL_OFFICER", "DEMO-D-1");
    const { password } = unwrap(await issueMobileLogin(doc.id, actor));

    const result = await mobileSignIn({ userId: doc.displayId, password });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { directory, trustedKeys } = result.provisioning;

    // The QR itself carries IDs only — no name, rank or blood group.
    expect(credential.payload).not.toContain("Rahul");
    expect(credential.payload).not.toContain("POSITIVE");
    expect(credential.payload).not.toContain("data:image");
    const parsed = parseQrPayload(credential.payload);
    expect(parsed.ok && parsed.claims.patientId).toBe(soldier.id);

    // The tablet receives what it needs to verify and resolve that QR.
    expect(trustedKeys?.keys[0]).toMatchObject({ keyId: "test-issuer", publicKey: key.key.publicKeyBase64Url });
    // …and the unit key for handing casualties to another tablet, when configured.
    expect(result.provisioning.transferKey).toBeNull();
    setTransferKeyForTesting({ keyId: "test-transfer", key: "A".repeat(43) });
    const again = await mobileSignIn({ userId: doc.displayId, password });
    expect(again.ok && again.provisioning.transferKey).toMatchObject({
      format: "casevac.transfer-key",
      keyId: "test-transfer",
      key: "A".repeat(43),
    });
    setTransferKeyForTesting(null);
    expect(directory.patients).toEqual([
      expect.objectContaining({
        patientId: soldier.id,
        fullName: "Rahul Sharma",
        bloodGroup: "B",
        rhFactor: "POSITIVE",
        sex: "MALE",
        dateOfBirth: "1998-04-12",
        photo: PHOTO,
      }),
    ]);
    expect(directory.credentials).toEqual([
      expect.objectContaining({ credentialId: credential.id, status: "ACTIVE" }),
    ]);
  });

  it("is never sent on a failed sign-in", async () => {
    const doc = await medic();
    unwrap(await issueMobileLogin(doc.id, actor));
    const result = await mobileSignIn({ userId: doc.displayId, password: "wrong" });
    expect(result).not.toHaveProperty("provisioning");
  });
});

describe("soldier ID photo", () => {
  it("rejects anything that is not a small JPEG data URL", async () => {
    const { validateSoldier } = await import("@/lib/domain/validation");
    const base = { fullName: "A Person", serviceNumber: "X-1", rank: "Sepoy", unit: "U" };
    expect(validateSoldier({ ...base, photo: "" }).ok).toBe(true);
    expect(validateSoldier({ ...base, photo: PHOTO }).ok).toBe(true);
    for (const bad of [
      "data:image/png;base64,iVBORw0KGgo=",
      "https://example.com/a.jpg",
      "data:image/jpeg;base64,<script>",
      `data:image/jpeg;base64,${"A".repeat(70_000)}`,
    ]) {
      const r = validateSoldier({ ...base, photo: bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors.photo).toBeDefined();
    }
  });
});

describe("medic / doctor ID photo", () => {
  it("is stored on registration, kept or cleared on edit, and validated", async () => {
    const staff = unwrap(
      await registerStaff({ fullName: "Anita Verma", serviceNumber: "DEMO-P-1", rank: "Naik", unit: "Demo FA", role: "MEDIC", photo: PHOTO }, actor),
    );
    expect(staff.staff.photo).toBe(PHOTO);

    const edit = { fullName: "Anita Verma", rank: "Naik", unit: "Demo FA", role: "MEDIC" };
    expect(unwrap(await updateStaff(staff.id, { ...edit, photo: PHOTO }, actor)).staff.photo).toBe(PHOTO);
    expect(unwrap(await updateStaff(staff.id, { ...edit, photo: "" }, actor)).staff.photo).toBeNull();

    const bad = await registerStaff(
      { fullName: "B Person", serviceNumber: "DEMO-P-2", rank: "Naik", unit: "Demo FA", role: "MEDIC", photo: "https://example.com/a.jpg" },
      actor,
    );
    expect(bad.ok === false && bad.fieldErrors?.photo).toBeTruthy();
  });
});

describe("tablet sign-in", () => {
  it("activates the account on first online sign-in and returns the profile", async () => {
    const person = await medic("MEDICAL_OFFICER", "DEMO-D-1");
    const { password } = unwrap(await issueMobileLogin(person.id, actor));

    const first = await mobileSignIn({ userId: person.displayId.toLowerCase(), password, device: "Tab-1" });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.firstLogin).toBe(true);
    expect(first.profile.fullName).toBe("Anita Verma");
    expect(first.profile.roleLabel).toBe("Doctor / Medical Officer");
    expect(first.profile.permissions).toContain("clinical.record");

    const second = await mobileSignIn({ userId: person.displayId, password });
    expect(second.ok && second.firstLogin).toBe(false);

    const { current } = await getMobileAccessForPerson(person.id);
    expect(current?.status).toBe("ACTIVATED");
    expect(current?.onlineLoginCount).toBe(2);
    expect(current?.lastDevice).toBe("Tab-1");
    expect(current?.firstLoginAt).not.toBeNull();
  });

  it("rejects a wrong password", async () => {
    const person = await medic();
    unwrap(await issueMobileLogin(person.id, actor));
    const result = await mobileSignIn({ userId: person.displayId, password: "wrong-pass" });
    expect(result).toMatchObject({ ok: false, error: "INVALID_CREDENTIALS" });
    expect((await getMobileAccessForPerson(person.id)).current?.status).toBe("PENDING_FIRST_LOGIN");
  });

  it("throttles repeated failures", async () => {
    const person = await medic();
    unwrap(await issueMobileLogin(person.id, actor));
    for (let i = 0; i < 8; i++) await mobileSignIn({ userId: person.displayId, password: "nope" });
    const result = await mobileSignIn({ userId: person.displayId, password: "nope" });
    expect(result).toMatchObject({ ok: false, error: "RATE_LIMITED" });
  });

  it("records offline sign-ins reported by the tablet", async () => {
    const person = await medic();
    const { account, password } = unwrap(await issueMobileLogin(person.id, actor));
    await mobileSignIn({ userId: person.displayId, password });

    const at = "2026-11-01T08:30:00.000Z";
    const sync = await syncMobileDevice({
      accounts: [{ accountId: account.id, userId: account.userId, offlineLogins: { count: 3, lastAt: at } }],
    });
    expect(sync.accounts).toEqual([{ accountId: account.id, status: "VALID" }]);
    const { current } = await getMobileAccessForPerson(person.id);
    expect(current?.offlineLoginCount).toBe(3);
    expect(current?.lastOfflineLoginAt).toBe(at);
  });

  it("reset invalidates the old password and the tablet's cached account", async () => {
    const person = await medic();
    const old = unwrap(await issueMobileLogin(person.id, actor));
    await mobileSignIn({ userId: person.displayId, password: old.password });

    const fresh = unwrap(await issueMobileLogin(person.id, actor));
    expect(fresh.account.userId).toBe(old.account.userId);
    expect((await mobileSignIn({ userId: person.displayId, password: old.password })).ok).toBe(false);
    expect((await mobileSignIn({ userId: person.displayId, password: fresh.password })).ok).toBe(true);

    const sync = await syncMobileDevice({ accounts: [{ accountId: old.account.id, userId: old.account.userId }] });
    expect(sync.accounts[0].status).toBe("REVOKED");
  });

  it("revoke and deactivation disable sign-in", async () => {
    const person = await medic();
    const { account, password } = unwrap(await issueMobileLogin(person.id, actor));
    unwrap(await revokeMobileLogin(person.id, "Tablet lost", actor));
    expect(await mobileSignIn({ userId: account.userId, password })).toMatchObject({ ok: false, error: "ACCOUNT_DISABLED" });

    const other = await medic("MEDIC", "DEMO-M-2");
    const issued = unwrap(await issueMobileLogin(other.id, actor));
    unwrap(
      await updateStaff(
        other.id,
        { fullName: other.fullName, rank: other.rank, unit: other.unit, role: "MEDIC", designation: "RMO", status: "INACTIVE" } as never,
        actor,
      ),
    );
    expect(await mobileSignIn({ userId: issued.account.userId, password: issued.password })).toMatchObject({
      ok: false,
      error: "ACCOUNT_DISABLED",
    });
  });
});
