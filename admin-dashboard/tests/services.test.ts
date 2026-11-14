import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { issuerKeyFromPkcs8, setIssuerKeyForTesting } from "@/lib/crypto/qr-issuer";
import { setRepositoryForTesting } from "@/lib/data";
import { JsonFileRepository } from "@/lib/data/json-file-repository";
import { parseQrPayload } from "@/lib/domain/qr-format";
import type { Actor } from "@/lib/domain/types";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";
import { seedDemoData, resetDemoData } from "@/lib/services/demo-data-service";
import { buildIdentityDirectory } from "@/lib/services/directory-service";
import {
  issueNewCredential,
  listSoldiersWithoutActiveQr,
  markWristbandIssued,
  recordCredentialOutput,
  reissueCredential,
  renderQrPng,
  renderQrSvg,
  resolveQrPayload,
  revokeCredential,
} from "@/lib/services/identity-service";
import {
  getPersonProfile,
  listPersonnel,
  registerSoldier,
  registerStaff,
  updateSoldier,
  updateStaff,
} from "@/lib/services/personnel-service";
import { getDashboardSummary } from "@/lib/services/stats-service";
import { addTeamMember, createTeam, removeTeamMember } from "@/lib/services/team-service";

const actor: Actor = { id: "ADM-TEST-01", name: "Test Admin" };
let dir: string;
let file: string;

const soldierInput = (overrides: Record<string, string> = {}) => ({
  fullName: "Rahul Sharma",
  serviceNumber: "demo-12345",
  rank: "Sepoy",
  unit: "2 Demo Rifles",
  bloodGroup: "B",
  rhFactor: "POSITIVE",
  ...overrides,
});

function unwrap<T>(r: { ok: true; value: T } | { ok: false; message: string; fieldErrors?: Record<string, string> }): T {
  if (!r.ok) throw new Error(`Expected success, got: ${r.message} ${JSON.stringify(r.fieldErrors)}`);
  return r.value;
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "casevac-test-"));
  file = path.join(dir, "db.json");
  setRepositoryForTesting(new JsonFileRepository(file));
  const der = generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
  const key = issuerKeyFromPkcs8("test-issuer", der);
  if (!key.ok) throw new Error(key.message);
  setIssuerKeyForTesting(key.key);
});

afterEach(() => {
  setRepositoryForTesting(null);
  setIssuerKeyForTesting(undefined);
  rmSync(dir, { recursive: true, force: true });
});

describe("soldier registration", () => {
  it("creates a patient identity with display ID, UUID and an opaque QR", async () => {
    const { person, credential } = unwrap(await registerSoldier(soldierInput(), actor));
    expect(person.displayId).toBe("PAT-00001");
    expect(person.serviceNumber).toBe("DEMO-12345");
    expect(person.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(credential.status).toBe("ACTIVE");
    expect(credential.version).toBe(1);

    const parsed = parseQrPayload(credential.payload);
    expect(parsed.ok && parsed.claims).toMatchObject({
      keyId: "test-issuer",
      credentialId: credential.id,
      patientId: person.id,
      credentialVersion: 1,
    });
    expect(credential.formatVersion).toBe(2);
    expect(credential.keyId).toBe("test-issuer");
    // Signed issue time and stored issue time agree to the second.
    expect(parsed.ok && parsed.claims.issuedAt * 1000).toBe(Date.parse(credential.issuedAt));
    // The QR must not leak identity data: only opaque IDs, version, time and signature.
    // (The signature is not checked for short strings: random base64url may contain them by chance.)
    const signedPart = parsed.ok ? parsed.signedMessage : "";
    for (const secret of ["Rahul", "Sharma", "DEMO-12345", "PAT-00001", "2 Demo Rifles"]) {
      expect(signedPart).not.toContain(secret);
    }
    expect((await resolveQrPayload(credential.payload)).ok).toBe(true);
  });

  it("refuses to issue an unsigned QR when no signing key is configured, rolling back registration", async () => {
    setIssuerKeyForTesting(null);
    const r = await registerSoldier(soldierInput(), actor);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.message).toMatch(/signing key is not configured/);
    expect(await listPersonnel()).toHaveLength(0);
  });

  it("validates required fields and formats", async () => {
    const r = await registerSoldier({ fullName: "", serviceNumber: "x", rank: "", unit: "", nextOfKinPhone: "abc" }, actor);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.fieldErrors ?? {})).toEqual(
        expect.arrayContaining(["fullName", "serviceNumber", "rank", "unit", "nextOfKinPhone", "nextOfKinName"]),
      );
    }
  });

  it("rejects duplicate service numbers (case-insensitive, across all personnel) without consuming an ID", async () => {
    unwrap(await registerSoldier(soldierInput(), actor));
    const dupSoldier = await registerSoldier(soldierInput({ fullName: "Other Person", serviceNumber: " DEMO-12345 " }), actor);
    expect(dupSoldier.ok).toBe(false);
    if (!dupSoldier.ok) expect(dupSoldier.fieldErrors?.serviceNumber).toContain("PAT-00001");

    const dupStaff = await registerStaff(
      { fullName: "Anita Verma", serviceNumber: "Demo-12345", rank: "Naik", unit: "Demo FA", role: "MEDIC" },
      actor,
    );
    expect(dupStaff.ok).toBe(false);

    const next = unwrap(await registerSoldier(soldierInput({ serviceNumber: "DEMO-99999" }), actor));
    expect(next.person.displayId).toBe("PAT-00002");
  });

  it("persists records across a new repository instance (server restart)", async () => {
    const { person } = unwrap(await registerSoldier(soldierInput(), actor));
    setRepositoryForTesting(new JsonFileRepository(file));
    const profile = await getPersonProfile(person.id);
    expect(profile?.person.fullName).toBe("Rahul Sharma");
    expect(profile?.credentials).toHaveLength(1);
  });

  it("assigns unique IDs under concurrent registrations", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => registerSoldier(soldierInput({ serviceNumber: `DEMO-C-${i}` }), actor)),
    );
    const ids = results.map(r => unwrap(r).person.displayId);
    expect(new Set(ids).size).toBe(8);
  });

  it("edits permitted fields but keeps the service number", async () => {
    const { person } = unwrap(await registerSoldier(soldierInput(), actor));
    const updated = unwrap(
      await updateSoldier(person.id, { ...soldierInput({ rank: "Naik", serviceNumber: "CHANGED-1" }), status: "ACTIVE" }, actor),
    );
    expect(updated.rank).toBe("Naik");
    expect(updated.serviceNumber).toBe("DEMO-12345");
  });
});

describe("QR lifecycle", () => {
  it("reissues with a new token, preserving history and a single active QR", async () => {
    const { person, credential: v1 } = unwrap(await registerSoldier(soldierInput(), actor));
    const v2 = unwrap(await reissueCredential(person.id, "Wristband damaged", actor));
    expect(v2.version).toBe(2);
    expect(v2.token).not.toBe(v1.token);

    const profile = await getPersonProfile(person.id);
    const old = profile!.credentials.find(c => c.id === v1.id)!;
    expect(old.status).toBe("REPLACED");
    expect(old.replacedByCredentialId).toBe(v2.id);
    expect(profile!.credentials.filter(c => c.status === "ACTIVE")).toHaveLength(1);

    expect((await resolveQrPayload(v1.payload)).ok).toBe(false);
    const resolved = await resolveQrPayload(v2.payload);
    expect(resolved.ok && resolved.person.id).toBe(person.id);
  });

  it("requires a reason, revokes, lists as unassigned and allows a new issue", async () => {
    const { person, credential } = unwrap(await registerSoldier(soldierInput(), actor));
    expect((await revokeCredential(person.id, "", actor)).ok).toBe(false);
    unwrap(await revokeCredential(person.id, "Wristband lost", actor));

    expect((await listSoldiersWithoutActiveQr()).map(p => p.id)).toContain(person.id);
    expect((await recordCredentialOutput(credential.id, "PRINT", actor)).ok).toBe(false);
    expect((await reissueCredential(person.id, "x reason", actor)).ok).toBe(false);

    const v2 = unwrap(await issueNewCredential(person.id, actor));
    expect(v2.version).toBe(2);
    expect((await issueNewCredential(person.id, actor)).ok).toBe(false); // already active
  });

  it("tracks prints and wristband hand-over without creating identities", async () => {
    const { credential } = unwrap(await registerSoldier(soldierInput(), actor));
    unwrap(await recordCredentialOutput(credential.id, "PRINT", actor));
    const printed = unwrap(await recordCredentialOutput(credential.id, "PRINT", actor));
    expect(printed.printCount).toBe(2);
    unwrap(await markWristbandIssued(credential.id, actor));
    expect((await markWristbandIssued(credential.id, actor)).ok).toBe(false);
    expect((await listPersonnel()).length).toBe(1);
  });

  it("rejects malformed and foreign payloads", async () => {
    for (const raw of ["", "hello", "CASEVAC:2:abcdefghijklmnopqrstuv", "CASEVAC:1:short", "OTHER:1:abcdefghijklmnopqrstuv"]) {
      expect((await resolveQrPayload(raw)).ok).toBe(false);
    }
    expect(await resolveQrPayload("CASEVAC:1:abcdefghijklmnopqrstuv")).toEqual({ ok: false, reason: "LEGACY_UNSIGNED" });
  });

  it("rejects QR codes signed by a key the dashboard does not hold", async () => {
    const { credential } = unwrap(await registerSoldier(soldierInput(), actor));
    const der = generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
    const rotated = issuerKeyFromPkcs8("test-issuer", der);
    if (!rotated.ok) throw new Error(rotated.message);
    setIssuerKeyForTesting(rotated.key);
    expect(await resolveQrPayload(credential.payload)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("renders SVG and PNG", async () => {
    const { credential } = unwrap(await registerSoldier(soldierInput(), actor));
    expect(await renderQrSvg(credential.payload)).toContain("<svg");
    const png = await renderQrPng(credential.payload);
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
  });
});

describe("staff and teams", () => {
  async function medic(sn: string, role = "MEDIC", extra: Record<string, string> = {}) {
    return unwrap(await registerStaff({ fullName: "Anita Verma", serviceNumber: sn, rank: "Naik", unit: "Demo FA", role, ...extra }, actor));
  }

  it("generates role-specific IDs and enforces doctor designation", async () => {
    expect((await medic("DEMO-M-1")).displayId).toBe("MED-00001");
    expect((await registerStaff({ fullName: "Kavya Iyer", serviceNumber: "DEMO-D-1", rank: "Major", unit: "Demo MH", role: "MEDICAL_OFFICER" }, actor)).ok).toBe(false);
    expect((await medic("DEMO-D-1", "MEDICAL_OFFICER", { designation: "RMO" })).displayId).toBe("DOC-00001");
    expect((await medic("DEMO-A-1", "ADMIN_OFFICER")).displayId).toBe("STF-00001");
  });

  it("creates teams, adds/removes members and protects the leader", async () => {
    const leader = await medic("DEMO-M-1");
    const member = await medic("DEMO-M-2");
    const admin = await medic("DEMO-A-1", "ADMIN_OFFICER");
    const team = unwrap(await createTeam({ name: "Forward Team A", leaderId: leader.id, status: "ACTIVE" }, actor));
    expect(team.teamCode).toBe("TEAM-001");
    expect(team.memberIds).toEqual([leader.id]);

    expect((await createTeam({ name: "forward team a" }, actor)).ok).toBe(false);
    expect((await addTeamMember(team.id, admin.id, actor)).ok).toBe(false);
    unwrap(await addTeamMember(team.id, member.id, actor));
    expect((await addTeamMember(team.id, member.id, actor)).ok).toBe(false);
    expect((await removeTeamMember(team.id, leader.id, actor)).ok).toBe(false);
    unwrap(await removeTeamMember(team.id, member.id, actor));

    // Leader of an active team cannot be deactivated; category changes are blocked.
    const base = { fullName: leader.fullName, rank: leader.rank, unit: leader.unit, role: "MEDIC" };
    expect((await updateStaff(leader.id, { ...base, status: "INACTIVE" }, actor)).ok).toBe(false);
    expect((await updateStaff(leader.id, { ...base, role: "MEDICAL_OFFICER", designation: "RMO", status: "ACTIVE" }, actor)).ok).toBe(false);
  });

  it("assigns a team during registration only for eligible roles", async () => {
    const team = unwrap(await createTeam({ name: "Team B" }, actor));
    const m = unwrap(await registerStaff({ fullName: "Karan Rao", serviceNumber: "DEMO-M-9", rank: "Sepoy", unit: "Demo FA", role: "MEDIC", teamId: team.id }, actor));
    expect((await getPersonProfile(m.id))?.teams.map(t => t.id)).toEqual([team.id]);
    const bad = await registerStaff({ fullName: "Admin Person", serviceNumber: "DEMO-A-9", rank: "Capt", unit: "HQ", role: "SYSTEM_ADMIN", teamId: team.id }, actor);
    expect(bad.ok).toBe(false);
  });
});

describe("dashboard data", () => {
  it("derives statistics from stored records and exports only active identities", async () => {
    unwrap(await seedDemoData(actor));
    expect((await seedDemoData(actor)).ok).toBe(false); // only into an empty store
    const s = await getDashboardSummary();
    expect(s.people.SOLDIER.total).toBe(3);
    expect(s.people.MEDIC.total).toBe(2);
    expect(s.people.DOCTOR.total).toBe(1);
    expect(s.teams.active).toBe(1);
    expect(s.qr.active).toBe(3);
    expect(s.clinicalStaffWithoutTeam).toBe(1);

    const soldier = (await listPersonnel({ category: "SOLDIER" }))[0].person;
    unwrap(await revokeCredential(soldier.id, "Lost in transit", actor));
    const directory = await buildIdentityDirectory();
    expect(directory.formatVersion).toBe(2);
    expect(directory.patients).toHaveLength(2);
    expect(directory.patients.map(p => p.patientId)).not.toContain(soldier.id);
    // The revoked credential stays listed so phones can reject it offline.
    expect(directory.credentials).toHaveLength(3);
    expect(directory.credentials.find(c => c.patientId === soldier.id)?.status).toBe("REVOKED");
    expect(JSON.stringify(directory)).not.toContain("nextOfKin");
    expect(JSON.stringify(directory)).not.toContain("serviceNumber");
    // Clinical staff a casualty can be handed over to: medical officer first.
    expect(directory.staff).toHaveLength(3);
    expect(directory.staff[0].role).toBe("MEDICAL_OFFICER");
    expect(directory.staff[0].roleLabel).toBe("Doctor / Medical Officer");
    expect(JSON.stringify(directory.staff)).not.toContain("passwordHash");

    unwrap(await resetDemoData(actor));
    expect((await getDashboardSummary()).isEmpty).toBe(true);
  });

  it("stores a staff date of birth and sends it with the handover staff list", async () => {
    const mo = unwrap(
      await registerStaff(
        { fullName: "Meera Iyer", serviceNumber: "DEMO-D-77", rank: "Maj", unit: "Demo ADS", role: "MEDICAL_OFFICER", designation: "RMO", dateOfBirth: "1988-03-14" },
        actor,
      ),
    );
    expect(mo.staff.dateOfBirth).toBe("1988-03-14");
    const bad = await registerStaff(
      { fullName: "Future Born", serviceNumber: "DEMO-D-78", rank: "Capt", unit: "Demo ADS", role: "MEDICAL_OFFICER", designation: "RMO", dateOfBirth: "2999-01-01" },
      actor,
    );
    expect(bad.ok).toBe(false);
    // Admin roles are not clinical: never offered as a handover recipient.
    unwrap(await registerStaff({ fullName: "Office Admin", serviceNumber: "DEMO-A-77", rank: "Capt", unit: "HQ", role: "ADMIN_OFFICER" }, actor));

    const directory = await buildIdentityDirectory();
    expect(directory.staff.map(s => s.fullName)).toEqual(["Meera Iyer"]);
    expect(directory.staff[0]).toMatchObject({ rank: "Maj", unit: "Demo ADS", designation: "RMO", dateOfBirth: "1988-03-14", photo: null });
  });

  it("filters the directory by search, category, role and status", async () => {
    unwrap(await seedDemoData(actor));
    expect((await listPersonnel({ q: "priya" })).length).toBe(1);
    expect((await listPersonnel({ q: "DEMO-M" })).length).toBe(2);
    expect((await listPersonnel({ role: "MEDICAL_OFFICER" })).length).toBe(1);
    expect((await listPersonnel({ status: "INACTIVE" })).length).toBe(0);
    expect((await listPersonnel({ unit: "2 demo rifles" })).length).toBe(2);
  });
});

describe("demo session tokens", () => {
  const secret = "x".repeat(40);
  it("verifies valid tokens and rejects tampering and expiry", () => {
    const token = createSessionToken(actor, secret, 1_000);
    expect(verifySessionToken(token, secret, 1_001)?.sub).toBe(actor.id);
    expect(verifySessionToken(token, "y".repeat(40), 1_001)).toBeNull();
    expect(verifySessionToken(`${token}x`, secret, 1_001)).toBeNull();
    expect(verifySessionToken(token, secret, 1_000 + 9 * 3600)).toBeNull();
    expect(verifySessionToken(undefined, secret)).toBeNull();
  });
});
