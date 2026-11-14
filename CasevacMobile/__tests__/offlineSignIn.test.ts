/**
 * Online-first sign-in with offline fallback (services/auth/signIn.ts).
 * Uses a fake dashboard server and in-memory tablet storage.
 */
import { OfflineCredentialStore } from '../src/services/auth/offlineCredentialStore';
import type { ServerClient } from '../src/services/auth/serverClient';
import {
  MESSAGES,
  signIn,
  syncSavedSignIns,
  type AuthDeps,
} from '../src/services/auth/signIn';
import type { MobileProfile } from '../src/services/auth/types';

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
  permissions: ['clinical.record', 'clinical.handover'],
  teams: [{ teamCode: 'TEAM-001', name: 'Team A', leader: false }],
  issuedAt: '2026-11-01T00:00:00.000Z',
};
const PASSWORD = 'Kx7mPq3Rta';

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

/** Fake dashboard: accepts PASSWORD for DOC-00001 while `online`. */
function fakeServer() {
  const state = {
    online: true,
    revoked: false,
    signInCalls: [] as { userId: string; offlineLogins: unknown[] }[],
  };
  const server: ServerClient = {
    isReachable: async () => state.online,
    signIn: async (userId, password, offlineLogins) => {
      if (!state.online) {
        return { kind: 'unreachable' };
      }
      state.signInCalls.push({ userId, offlineLogins });
      if (state.revoked) {
        return {
          kind: 'rejected',
          error: 'INVALID_CREDENTIALS',
          message: 'User ID or password not recognised.',
        };
      }
      return userId === PROFILE.userId && password === PASSWORD
        ? { kind: 'ok', profile: PROFILE, firstLogin: true }
        : {
            kind: 'rejected',
            error: 'INVALID_CREDENTIALS',
            message: 'User ID or password not recognised.',
          };
    },
    sync: async items =>
      state.online
        ? items.map(i => ({
            accountId: i.accountId,
            status: state.revoked ? ('REVOKED' as const) : ('VALID' as const),
          }))
        : null,
  };
  return { server, state };
}

function setup() {
  const storage = memoryStorage();
  const { server, state } = fakeServer();
  const deps: AuthDeps = { server, store: new OfflineCredentialStore(storage) };
  return { deps, state, storage };
}

test('first sign-in must be online', async () => {
  const { deps, state } = setup();
  state.online = false;
  const result = await signIn('doc-00001', PASSWORD, deps);
  expect(result).toEqual({
    ok: false,
    message: MESSAGES.firstLoginNeedsNetwork,
  });
});

test('online sign-in saves a hashed copy that later works offline', async () => {
  const { deps, state, storage } = setup();

  const online = await signIn('doc-00001', PASSWORD, deps);
  expect(online.ok).toBe(true);
  if (!online.ok) {
    return;
  }
  expect(online.firstLogin).toBe(true);
  expect(online.clinician).toMatchObject({
    id: 'DOC-00001',
    displayName: 'Kavya Iyer',
    team: 'Team A',
    signInMode: 'online',
    isDemo: false,
  });
  // The password itself is never written to the tablet.
  expect([...storage.data.values()].join()).not.toContain(PASSWORD);

  state.online = false;
  const offline = await signIn('DOC-00001', PASSWORD, deps);
  expect(offline.ok && offline.clinician.signInMode).toBe('offline');

  const wrong = await signIn('DOC-00001', 'not-it', deps);
  expect(wrong).toEqual({ ok: false, message: MESSAGES.invalid });
});

test('offline sign-ins are reported at the next online sign-in', async () => {
  const { deps, state } = setup();
  await signIn('DOC-00001', PASSWORD, deps);
  state.online = false;
  await signIn('DOC-00001', PASSWORD, deps);
  await signIn('DOC-00001', PASSWORD, deps);

  state.online = true;
  await signIn('DOC-00001', PASSWORD, deps);
  const last = state.signInCalls[state.signInCalls.length - 1];
  expect(last.offlineLogins).toEqual([
    { accountId: 'acc-1', count: 2, lastAt: expect.any(String) },
  ]);
  expect((await deps.store.get('DOC-00001'))?.pendingOfflineLogins.count).toBe(
    0,
  );
});

test('a reset or revoked password deletes the saved copy', async () => {
  const { deps, state } = setup();
  await signIn('DOC-00001', PASSWORD, deps);
  state.revoked = true;

  const refused = await signIn('DOC-00001', PASSWORD, deps);
  expect(refused.ok).toBe(false);
  expect(await deps.store.get('DOC-00001')).toBeNull();

  state.online = false;
  const offline = await signIn('DOC-00001', PASSWORD, deps);
  expect(offline).toEqual({
    ok: false,
    message: MESSAGES.firstLoginNeedsNetwork,
  });
});

test('a mistyped password online does not delete the saved copy', async () => {
  const { deps } = setup();
  await signIn('DOC-00001', PASSWORD, deps);
  await signIn('DOC-00001', 'typo', deps);
  expect(await deps.store.get('DOC-00001')).not.toBeNull();
});

test('background sync removes revoked copies and clears reported counts', async () => {
  const { deps, state } = setup();
  await signIn('DOC-00001', PASSWORD, deps);
  state.online = false;
  await signIn('DOC-00001', PASSWORD, deps);

  state.online = true;
  expect(await syncSavedSignIns(deps)).toEqual({ removed: [] });
  expect((await deps.store.get('DOC-00001'))?.pendingOfflineLogins.count).toBe(
    0,
  );

  state.revoked = true;
  expect(await syncSavedSignIns(deps)).toEqual({ removed: ['DOC-00001'] });
  expect(await deps.store.list()).toEqual([]);
});

test('the fictional demo account still works without a server', async () => {
  const { deps, state } = setup();
  state.online = false;
  const result = await signIn('med-demo-01', '1234', deps);
  expect(result.ok && result.clinician.signInMode).toBe('demo');
});
