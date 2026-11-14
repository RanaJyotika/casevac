/**
 * Patient directory downloaded at sign-in (services/identity/provisioningStore).
 *
 * The wristband QR carries only IDs + a signature. The tablet resolves a scan
 * against the directory and trusted key the dashboard sends with a successful
 * online sign-in, saved for offline use.
 *
 * TEST_VECTOR is the dashboard-signed credential shared with
 * admin-dashboard/tests/qr-credential.test.ts (test-only key).
 */
import { ProvisioningStore } from '../src/services/identity/provisioningStore';
import { OfflineCredentialStore } from '../src/services/auth/offlineCredentialStore';
import type { ServerClient } from '../src/services/auth/serverClient';
import { signIn } from '../src/services/auth/signIn';
import type { MobileProfile } from '../src/services/auth/types';
import { identifyPatient } from '../src/services/qr/identifyPatient';

const TEST_VECTOR = {
  keyId: 'test-vector-01',
  publicKey: 'ebVWLo_mVPlAeLES6KmLp5AfhTrmlb7X4OORC60ElmQ',
  credentialId: '11111111-1111-4111-8111-111111111111',
  patientId: '22222222-2222-4222-8222-222222222222',
  payload:
    'CASEVAC:2:P:test-vector-01:11111111-1111-4111-8111-111111111111:22222222-2222-4222-8222-222222222222:1:1794470400:aV01UJYw8WEfoOZxVKcXPHXRsav66hFZepc9-O4fVOfNkye5NJ5xHKR1vJNFglteku3Qtw_dySOEBwAtwqS6DQ',
};

/** Exactly what admin-dashboard mobileSignIn returns as `provisioning`. */
function serverProvisioning(status: 'ACTIVE' | 'REVOKED' = 'ACTIVE') {
  return {
    trustedKeys: {
      format: 'casevac.trusted-issuer-keys',
      formatVersion: 1,
      generatedAt: '2026-11-13T08:00:00.000Z',
      keys: [
        {
          keyId: TEST_VECTOR.keyId,
          issuer: 'CASEVAC_ADMIN',
          algorithm: 'Ed25519',
          publicKey: TEST_VECTOR.publicKey,
        },
      ],
    },
    directory: {
      format: 'casevac.identity-directory',
      formatVersion: 2,
      generatedAt: '2026-11-13T08:00:00.000Z',
      dataSource: 'DEMO',
      patients:
        status === 'ACTIVE'
          ? [
              {
                patientId: TEST_VECTOR.patientId,
                displayId: 'PAT-00042',
                fullName: 'Test Soldier',
                rank: 'Sepoy',
                unit: '9 Demo Rifles',
                bloodGroup: 'O',
                rhFactor: 'POSITIVE',
              },
            ]
          : [],
      credentials: [
        {
          credentialId: TEST_VECTOR.credentialId,
          patientId: TEST_VECTOR.patientId,
          keyId: TEST_VECTOR.keyId,
          credentialVersion: 1,
          status,
          issuedAt: '2026-11-12T08:00:00.000Z',
          revokedAt: status === 'ACTIVE' ? null : '2026-11-13T07:00:00.000Z',
        },
      ],
    },
  };
}

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (k: string) => data.get(k) ?? null,
    setItem: async (k: string, v: string) => {
      data.set(k, v);
    },
  };
}

const deps = (store: ProvisioningStore) => ({
  trustStore: store.trustStore(),
  directory: store.directory(),
});

test('the QR itself carries no personal or medical data', () => {
  for (const word of ['Test', 'Soldier', 'Sepoy', 'POSITIVE', 'PAT-00042']) {
    expect(TEST_VECTOR.payload).not.toContain(word);
  }
});

test('before any download, the scan verifies nothing it cannot trust', async () => {
  const store = new ProvisioningStore(memoryStorage());
  const result = await identifyPatient(TEST_VECTOR.payload, deps(store));
  // The bundled demo keys do not include the test key.
  expect(result).toMatchObject({ ok: false, failure: 'UNKNOWN_ISSUER_KEY' });
});

test('a downloaded directory resolves a scanned QR to the patient', async () => {
  const store = new ProvisioningStore(memoryStorage());
  expect(await store.saveFromServer(serverProvisioning())).toBe(true);

  const result = await identifyPatient(TEST_VECTOR.payload, deps(store));
  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }
  expect(result.lookup).toMatchObject({
    status: 'FOUND',
    patient: {
      fullName: 'Test Soldier',
      bloodGroup: 'O',
      rhFactor: 'POSITIVE',
    },
  });
  expect((await store.directory().info()).source).toBe('BACKEND');
});

test('a revoked wristband in the download is rejected', async () => {
  const store = new ProvisioningStore(memoryStorage());
  await store.saveFromServer(serverProvisioning('REVOKED'));
  const result = await identifyPatient(TEST_VECTOR.payload, deps(store));
  expect(result).toMatchObject({ ok: false, failure: 'CREDENTIAL_REVOKED' });
});

test('the download survives an app restart (offline use)', async () => {
  const storage = memoryStorage();
  await new ProvisioningStore(storage).saveFromServer(serverProvisioning());

  const afterRestart = new ProvisioningStore(storage);
  expect(await afterRestart.loadSaved()).toBe(true);
  const result = await identifyPatient(TEST_VECTOR.payload, deps(afterRestart));
  expect(result.ok && result.lookup.status).toBe('FOUND');
});

test('malformed or keyless downloads are rejected whole', async () => {
  const store = new ProvisioningStore(memoryStorage());
  expect(await store.saveFromServer(undefined)).toBe(false);
  expect(await store.saveFromServer({ directory: { nope: true } })).toBe(false);
  expect(
    await store.saveFromServer({
      ...serverProvisioning(),
      trustedKeys: { format: 'casevac.trusted-issuer-keys', keys: [] },
    }),
  ).toBe(false);
  expect((await store.directory().info()).source).toBe('DEMO_BUNDLED');
});

test('online sign-in saves the directory; a later offline sign-in reloads it', async () => {
  const PROFILE: MobileProfile = {
    accountId: 'acc-1',
    userId: 'DOC-00001',
    personId: 'person-1',
    displayId: 'DOC-00001',
    fullName: 'Kavya Iyer',
    rank: 'Major',
    unit: 'Demo MH',
    category: 'DOCTOR',
    role: 'MEDICAL_OFFICER',
    roleLabel: 'Doctor / Medical Officer',
    designation: 'RMO',
    permissions: ['clinical.record'],
    teams: [],
    issuedAt: '2026-11-01T00:00:00.000Z',
  };
  let online = true;
  const server: ServerClient = {
    isReachable: async () => online,
    signIn: async () =>
      online
        ? {
            kind: 'ok',
            profile: PROFILE,
            firstLogin: true,
            provisioning: serverProvisioning(),
          }
        : { kind: 'unreachable' },
    sync: async () => null,
  };
  const storage = memoryStorage();
  const credentials = new OfflineCredentialStore(storage);

  const first = new ProvisioningStore(storage);
  await signIn('DOC-00001', 'pw-123456', {
    server,
    store: credentials,
    provisioning: first,
  });
  expect((await first.directory().info()).patientCount).toBe(1);

  // App restarted in the field: no network, fresh in-memory store.
  online = false;
  const later = new ProvisioningStore(storage);
  const result = await signIn('DOC-00001', 'pw-123456', {
    server,
    store: credentials,
    provisioning: later,
  });
  expect(result.ok && result.clinician.signInMode).toBe('offline');
  const scan = await identifyPatient(TEST_VECTOR.payload, deps(later));
  expect(scan.ok && scan.lookup.status).toBe('FOUND');
});
