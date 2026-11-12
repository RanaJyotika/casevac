import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { issuerKeyFromPkcs8, signPatientCredential, verifyPatientCredential, type IssuerKey } from "@/lib/crypto/qr-issuer";
import { buildSignedMessage, parseQrPayload } from "@/lib/domain/qr-format";

/**
 * Cross-implementation test vector. TEST-ONLY key (seed bytes 0x01..0x20) —
 * never used to sign real wristbands. The mobile app's test suite
 * (CasevacMobile/__tests__/credentialVerification.test.ts) pins the same
 * values, so the two implementations cannot drift apart unnoticed.
 */
const TEST_VECTOR = {
  keyId: "test-vector-01",
  pkcs8: "MC4CAQAwBQYDK2VwBCIEIAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8g",
  publicKey: "ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ",
  claims: {
    credentialId: "11111111-1111-4111-8111-111111111111",
    patientId: "22222222-2222-4222-8222-222222222222",
    credentialVersion: 1,
    issuedAt: 1794470400, // 2026-11-12T08:00:00Z
  },
  payload:
    "CASEVAC:2:P:test-vector-01:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:1:1794470400:aV01UJYw8WEfoOZxVKcXPHXRsav66hFZepc9-O4fVOfNkye5NJ5xHKR1vJNFglteku3Qtw_dySOEBwAtwqS6DQ",
};

function testKey(): IssuerKey {
  const r = issuerKeyFromPkcs8(TEST_VECTOR.keyId, TEST_VECTOR.pkcs8);
  if (!r.ok) throw new Error(r.message);
  return r.key;
}

function randomKey(keyId: string): IssuerKey {
  const der = generateKeyPairSync("ed25519").privateKey.export({ format: "der", type: "pkcs8" }).toString("base64url");
  const r = issuerKeyFromPkcs8(keyId, der);
  if (!r.ok) throw new Error(r.message);
  return r.key;
}

/** Replace one ":"-separated field of a payload. */
function withField(payload: string, index: number, value: string) {
  const parts = payload.split(":");
  parts[index] = value;
  return parts.join(":");
}

describe("signed QR credential format v2", () => {
  it("matches the shared cross-implementation test vector exactly", () => {
    const key = testKey();
    expect(key.publicKeyBase64Url).toBe(TEST_VECTOR.publicKey);
    expect(signPatientCredential(key, TEST_VECTOR.claims)).toBe(TEST_VECTOR.payload);
  });

  it("verifies a genuine credential and returns its claims", () => {
    const result = verifyPatientCredential(TEST_VECTOR.payload, testKey());
    expect(result).toEqual({ ok: true, claims: { keyId: TEST_VECTOR.keyId, ...TEST_VECTOR.claims } });
  });

  it("rejects any modified signed field", () => {
    const key = testKey();
    const tampered = [
      withField(TEST_VECTOR.payload, 4, "11111111-1111-4111-8111-111111111112"), // credentialId
      withField(TEST_VECTOR.payload, 5, "22222222-2222-4222-8222-222222222223"), // patientId
      withField(TEST_VECTOR.payload, 6, "2"), // version
      withField(TEST_VECTOR.payload, 7, "1794470401"), // issuedAt
    ];
    for (const payload of tampered) {
      expect(verifyPatientCredential(payload, key)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
    }
  });

  it("rejects a modified or non-canonical signature", () => {
    const key = testKey();
    const sig = TEST_VECTOR.payload.split(":")[8];
    const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
    expect(verifyPatientCredential(withField(TEST_VECTOR.payload, 8, flipped), key).ok).toBe(false);
    // Last char of a 64-byte base64url value carries 2 unused bits; "Q" → "R" decodes to the same bytes.
    const last = sig.at(-1)!;
    const alias = sig.slice(0, -1) + String.fromCharCode(last.charCodeAt(0) + 1);
    expect(verifyPatientCredential(withField(TEST_VECTOR.payload, 8, alias), key)).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects a forged credential signed by an untrusted key, even under the trusted key ID", () => {
    const forger = randomKey(TEST_VECTOR.keyId);
    const forged = signPatientCredential(forger, TEST_VECTOR.claims);
    expect(verifyPatientCredential(forged, testKey())).toEqual({ ok: false, reason: "BAD_SIGNATURE" });
  });

  it("rejects unknown key IDs", () => {
    const other = signPatientCredential(randomKey("other-issuer"), TEST_VECTOR.claims);
    expect(verifyPatientCredential(other, testKey())).toEqual({ ok: false, reason: "UNKNOWN_KEY" });
  });

  it("classifies legacy, foreign, future-version and malformed payloads", () => {
    expect(parseQrPayload("CASEVAC:1:abcdefghijklmnopqrstuv")).toEqual({ ok: false, reason: "LEGACY_UNSIGNED" });
    expect(parseQrPayload("https://example.com")).toEqual({ ok: false, reason: "NOT_CASEVAC" });
    expect(parseQrPayload("")).toEqual({ ok: false, reason: "NOT_CASEVAC" });
    expect(parseQrPayload("CASEVAC:3:P:x")).toEqual({ ok: false, reason: "UNSUPPORTED_VERSION" });
    // Upper-case UUIDs are a different encoding of the same claims: not canonical, so rejected.
    expect(parseQrPayload(withField(TEST_VECTOR.payload, 4, TEST_VECTOR.claims.credentialId.toUpperCase().replace(/1/g, "A")))).toEqual({
      ok: false,
      reason: "MALFORMED",
    });
    expect(parseQrPayload(TEST_VECTOR.payload + ":extra")).toEqual({ ok: false, reason: "MALFORMED" });
    expect(parseQrPayload(withField(TEST_VECTOR.payload, 2, "X"))).toEqual({ ok: false, reason: "MALFORMED" });
  });

  it("refuses to build messages from invalid claims", () => {
    const base = { keyId: "k1", ...TEST_VECTOR.claims };
    expect(() => buildSignedMessage({ ...base, keyId: "Bad:Key" })).toThrow();
    expect(() => buildSignedMessage({ ...base, patientId: "PAT-00001" })).toThrow();
    expect(() => buildSignedMessage({ ...base, credentialVersion: 0 })).toThrow();
    expect(() => buildSignedMessage({ ...base, issuedAt: 1.5 })).toThrow();
  });

  it("rejects invalid key configuration", () => {
    expect(issuerKeyFromPkcs8("Bad Key", TEST_VECTOR.pkcs8).ok).toBe(false);
    expect(issuerKeyFromPkcs8("k1", "not-a-key").ok).toBe(false);
    const rsa = generateKeyPairSync("rsa", { modulusLength: 1024 }).privateKey.export({ format: "der", type: "pkcs8" });
    expect(issuerKeyFromPkcs8("k1", rsa.toString("base64url")).ok).toBe(false);
  });
});
