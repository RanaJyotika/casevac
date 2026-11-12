/* eslint-disable no-bitwise -- test-side base64url encoder */
/**
 * Offline QR credential verification (Phase 2).
 *
 * TEST_VECTOR is shared with admin-dashboard/tests/qr-credential.test.ts and
 * was produced by the dashboard's Node.js signer with a TEST-ONLY key (seed
 * bytes 0x01..0x20). It proves the phone verifies exactly what the dashboard
 * issues. It is never trusted by the app itself.
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import bundledDirectory from '../src/provisioning/demo-identity-directory.json';
import bundledKeys from '../src/provisioning/trusted-issuer-keys.json';
import {
  parseDirectory,
  parseTrustedKeys,
  StaticIdentityDirectory,
  StaticTrustStore,
  type ParsedDirectory,
} from '../src/services/identity/bundledDemoProvisioning';
import type { CredentialRecord, PatientIdentity } from '../src/services/identity/types';
import { asciiBytes, decodeBase64Url } from '../src/services/qr/base64url';
import { parseCredentialPayload } from '../src/services/qr/credentialFormat';
import { describeFailure } from '../src/services/qr/identificationMessages';
import { identifyPatient } from '../src/services/qr/identifyPatient';

const TEST_VECTOR = {
  keyId: 'test-vector-01',
  publicKey: 'ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ',
  credentialId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  issuedAt: 1794470400,
  payload:
    'CASEVAC:2:P:test-vector-01:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:1:1794470400:aV01UJYw8WEfoOZxVKcXPHXRsav66hFZepc9-O4fVOfNkye5NJ5xHKR1vJNFglteku3Qtw_dySOEBwAtwqS6DQ',
};

const PATIENT: PatientIdentity = {
  patientId: TEST_VECTOR.patientId,
  displayId: 'PAT-00042',
  fullName: 'Test Soldier',
  rank: 'Sepoy',
  unit: '9 Demo Rifles',
  bloodGroup: 'O',
  rhFactor: 'POSITIVE',
};

const CREDENTIAL: CredentialRecord = {
  credentialId: TEST_VECTOR.credentialId,
  patientId: TEST_VECTOR.patientId,
  keyId: TEST_VECTOR.keyId,
  credentialVersion: 1,
  status: 'ACTIVE',
  issuedAt: '2026-11-12T08:00:00.000Z',
  revokedAt: null,
};

function base64Url(bytes: Uint8Array): string {
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let out = '';
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 6) {
      bits -= 6;
      out += alphabet[(buffer >> bits) & 63];
    }
  }
  if (bits > 0) {
    out += alphabet[(buffer << (6 - bits)) & 63];
  }
  return out;
}

const trustStore = new StaticTrustStore([
  {
    keyId: TEST_VECTOR.keyId,
    issuer: 'CASEVAC_ADMIN',
    algorithm: 'Ed25519',
    publicKey: decodeBase64Url(TEST_VECTOR.publicKey)!,
  },
]);

function directoryWith(data: Partial<ParsedDirectory>) {
  return new StaticIdentityDirectory({
    generatedAt: '2026-11-12T09:00:00.000Z',
    patients: [],
    credentials: [],
    ...data,
  });
}

const fullDirectory = directoryWith({
  patients: [PATIENT],
  credentials: [CREDENTIAL],
});

function withField(payload: string, index: number, value: string) {
  const parts = payload.split(':');
  parts[index] = value;
  return parts.join(':');
}

describe('base64url', () => {
  it('decodes canonical input and rejects invalid or non-canonical input', () => {
    expect(Array.from(decodeBase64Url('AQID')!)).toEqual([1, 2, 3]);
    expect(decodeBase64Url(TEST_VECTOR.publicKey)?.length).toBe(32);
    expect(decodeBase64Url('AQI=')).toBeNull(); // padding not allowed
    expect(decodeBase64Url('AQ+/')).toBeNull(); // standard alphabet not allowed
    expect(decodeBase64Url('A')).toBeNull(); // impossible length
    expect(decodeBase64Url('AR')).toBeNull(); // non-zero trailing bits
  });

  it('refuses non-ASCII message text', () => {
    expect(() => asciiBytes('CASEVAC:é')).toThrow();
  });
});

describe('credential payload parsing', () => {
  it('parses the shared test vector', () => {
    const parsed = parseCredentialPayload(TEST_VECTOR.payload);
    expect(parsed).toMatchObject({
      ok: true,
      claims: {
        keyId: TEST_VECTOR.keyId,
        credentialId: TEST_VECTOR.credentialId,
        patientId: TEST_VECTOR.patientId,
        credentialVersion: 1,
        issuedAt: TEST_VECTOR.issuedAt,
      },
    });
    expect(parsed.ok && parsed.signedMessage).toBe(
      TEST_VECTOR.payload.slice(0, TEST_VECTOR.payload.lastIndexOf(':')),
    );
  });

  it('classifies foreign, legacy, future and malformed codes', () => {
    const reason = (raw: string) => {
      const r = parseCredentialPayload(raw);
      return r.ok ? 'OK' : r.reason;
    };
    expect(reason('https://example.com/menu')).toBe('NOT_CASEVAC');
    expect(reason('')).toBe('NOT_CASEVAC');
    expect(reason('CASEVAC:1:abcdefghijklmnopqrstuv')).toBe('LEGACY_UNSIGNED');
    expect(reason('CASEVAC:1:short')).toBe('MALFORMED');
    expect(reason('CASEVAC:9:P:anything')).toBe('UNSUPPORTED_VERSION');
    expect(reason(TEST_VECTOR.payload + ':x')).toBe('MALFORMED');
    expect(reason(withField(TEST_VECTOR.payload, 2, 'X'))).toBe('MALFORMED');
    expect(reason('CASEVAC:2:' + 'A'.repeat(600))).toBe('MALFORMED');
  });
});

describe('identifyPatient (offline)', () => {
  it('accepts a genuine dashboard credential and resolves the local identity', async () => {
    const result = await identifyPatient(TEST_VECTOR.payload, {
      trustStore,
      directory: fullDirectory,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.issuer).toBe('CASEVAC_ADMIN');
      expect(result.lookup).toEqual({
        status: 'FOUND',
        patient: PATIENT,
        credential: CREDENTIAL,
      });
      expect(result.directoryGeneratedAt).toBe('2026-11-12T09:00:00.000Z');
    }
  });

  it('verifies but reports details unavailable when the credential is not provisioned', async () => {
    const result = await identifyPatient(TEST_VECTOR.payload, {
      trustStore,
      directory: directoryWith({}),
    });
    expect(result).toMatchObject({
      ok: true,
      lookup: { status: 'CREDENTIAL_NOT_IN_DIRECTORY' },
    });
  });

  it('verifies but never invents details when the patient record is missing', async () => {
    const result = await identifyPatient(TEST_VECTOR.payload, {
      trustStore,
      directory: directoryWith({ credentials: [CREDENTIAL] }),
    });
    expect(result).toMatchObject({
      ok: true,
      lookup: { status: 'PATIENT_DETAILS_UNAVAILABLE' },
    });
  });

  it('rejects revoked and replaced credentials even with a valid signature', async () => {
    for (const status of ['REVOKED', 'REPLACED'] as const) {
      const directory = directoryWith({
        patients: [PATIENT],
        credentials: [
          { ...CREDENTIAL, status, revokedAt: '2026-11-12T10:00:00.000Z' },
        ],
      });
      const result = await identifyPatient(TEST_VECTOR.payload, {
        trustStore,
        directory,
      });
      expect(result).toEqual({
        ok: false,
        failure: status === 'REVOKED' ? 'CREDENTIAL_REVOKED' : 'CREDENTIAL_REPLACED',
        revokedAt: '2026-11-12T10:00:00.000Z',
      });
    }
  });

  it('rejects a credential whose local record names a different patient', async () => {
    const directory = directoryWith({
      patients: [PATIENT],
      credentials: [
        { ...CREDENTIAL, patientId: '33333333-3333-4333-8333-333333333333' },
      ],
    });
    const result = await identifyPatient(TEST_VECTOR.payload, {
      trustStore,
      directory,
    });
    expect(result).toEqual({ ok: false, failure: 'RECORD_MISMATCH' });
  });

  it('rejects every modified signed field', async () => {
    const tampered = [
      withField(TEST_VECTOR.payload, 4, '11111111-1111-4111-8111-111111111112'),
      withField(TEST_VECTOR.payload, 5, '22222222-2222-4222-8222-222222222223'),
      withField(TEST_VECTOR.payload, 6, '2'),
      withField(TEST_VECTOR.payload, 7, '1794470401'),
    ];
    for (const payload of tampered) {
      const result = await identifyPatient(payload, {
        trustStore,
        directory: fullDirectory,
      });
      expect(result).toEqual({ ok: false, failure: 'INVALID_SIGNATURE' });
    }
  });

  it('rejects modified and non-canonical signatures', async () => {
    const sig = TEST_VECTOR.payload.split(':')[8];
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    const alias =
      sig.slice(0, -1) + String.fromCharCode(sig.charCodeAt(sig.length - 1) + 1);
    for (const s of [flipped, alias]) {
      const result = await identifyPatient(withField(TEST_VECTOR.payload, 8, s), {
        trustStore,
        directory: fullDirectory,
      });
      expect(result).toEqual({ ok: false, failure: 'INVALID_SIGNATURE' });
    }
  });

  it('rejects a forgery signed by another key that claims the trusted key ID', async () => {
    const secret = ed25519.utils.randomSecretKey();
    const message = TEST_VECTOR.payload.slice(
      0,
      TEST_VECTOR.payload.lastIndexOf(':'),
    );
    const forged = `${message}:${base64Url(
      ed25519.sign(asciiBytes(message), secret),
    )}`;
    const result = await identifyPatient(forged, {
      trustStore,
      directory: fullDirectory,
    });
    expect(result).toEqual({ ok: false, failure: 'INVALID_SIGNATURE' });
  });

  it('rejects credentials from an issuer key the phone does not trust', async () => {
    const result = await identifyPatient(
      withField(TEST_VECTOR.payload, 3, 'other-issuer'),
      { trustStore, directory: fullDirectory },
    );
    expect(result).toEqual({
      ok: false,
      failure: 'UNKNOWN_ISSUER_KEY',
      keyId: 'other-issuer',
    });
  });

  it('rejects legacy unsigned wristbands before any lookup', async () => {
    const result = await identifyPatient('CASEVAC:1:abcdefghijklmnopqrstuv', {
      trustStore,
      directory: fullDirectory,
    });
    expect(result).toEqual({ ok: false, failure: 'LEGACY_UNSIGNED' });
  });

  it('has a plain-language message for every failure', () => {
    const failures = [
      'NOT_CASEVAC',
      'LEGACY_UNSIGNED',
      'UNSUPPORTED_VERSION',
      'MALFORMED',
      'UNKNOWN_ISSUER_KEY',
      'INVALID_SIGNATURE',
      'CREDENTIAL_REVOKED',
      'CREDENTIAL_REPLACED',
      'RECORD_MISMATCH',
    ] as const;
    for (const failure of failures) {
      const m = describeFailure({ ok: false, failure });
      expect(m.title.length).toBeGreaterThan(0);
      expect(m.message.length).toBeGreaterThan(0);
    }
  });
});

describe('provisioning file parsing', () => {
  it('drops malformed trusted keys and directory entries instead of guessing', () => {
    const keys = parseTrustedKeys({
      format: 'casevac.trusted-issuer-keys',
      keys: [
        { keyId: 'good-key', issuer: 'CASEVAC_ADMIN', algorithm: 'Ed25519', publicKey: TEST_VECTOR.publicKey },
        { keyId: 'short', issuer: 'CASEVAC_ADMIN', algorithm: 'Ed25519', publicKey: 'AQID' },
        { keyId: 'rsa', issuer: 'CASEVAC_ADMIN', algorithm: 'RSA', publicKey: TEST_VECTOR.publicKey },
        { keyId: 'Bad Key', issuer: 'CASEVAC_ADMIN', algorithm: 'Ed25519', publicKey: TEST_VECTOR.publicKey },
      ],
    });
    expect(keys.map(k => k.keyId)).toEqual(['good-key']);
    expect(parseTrustedKeys({ format: 'something-else', keys: [] })).toEqual([]);

    const directory = parseDirectory({
      format: 'casevac.identity-directory',
      formatVersion: 2,
      generatedAt: '2026-11-12T09:00:00.000Z',
      patients: [PATIENT, { ...PATIENT, patientId: 'not-a-uuid' }],
      credentials: [CREDENTIAL, { ...CREDENTIAL, status: 'MAYBE' }],
    });
    expect(directory.patients).toHaveLength(1);
    expect(directory.credentials).toHaveLength(1);
    expect(parseDirectory({ format: 'casevac.identity-directory', formatVersion: 1 }).patients).toEqual([]);
  });

  it('parses the bundled demo provisioning files written by the dashboard', () => {
    expect(parseTrustedKeys(bundledKeys).length).toBeGreaterThan(0);
    const directory = parseDirectory(bundledDirectory);
    expect(directory.generatedAt).not.toBeNull();
    // Every patient in the directory holds an active credential.
    const active = new Set(
      directory.credentials.filter(c => c.status === 'ACTIVE').map(c => c.patientId),
    );
    for (const p of directory.patients) {
      expect(active.has(p.patientId)).toBe(true);
    }
  });
});
