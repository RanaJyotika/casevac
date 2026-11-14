/**
 * Medic sign-in: online first, offline from the tablet's saved copy.
 *
 *  1. Demo account (fictional, for demonstrations) — checked locally.
 *  2. Server reachable → the server decides. Success saves/refreshes the
 *     offline copy and the patient directory used to resolve wristband QR
 *     scans. A rejection deletes a saved copy holding the same password (it
 *     was reset or revoked).
 *  3. Server unreachable → the saved copy decides. A medic who has never
 *     signed in online on this tablet cannot sign in offline.
 *
 * Emergency access (no sign-in) is separate: see startEmergencySession.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEMO_ACCOUNTS } from '../../data/mockData';
import type { Clinician } from '../../types';
import {
  getProvisioningStore,
  type ProvisioningStore,
} from '../identity/provisioningStore';
import { OfflineCredentialStore } from './offlineCredentialStore';
import { createServerClient, type ServerClient } from './serverClient';
import type { MobileProfile } from './types';

export interface AuthDeps {
  server: ServerClient;
  store: OfflineCredentialStore;
  /** Patient directory + trusted keys for scanning (defaults to the app's). */
  provisioning?: ProvisioningStore;
}

let defaultDeps: AuthDeps | null = null;
export function getDefaultAuthDeps(): AuthDeps {
  defaultDeps ??= {
    server: createServerClient(),
    store: new OfflineCredentialStore(),
  };
  return defaultDeps;
}

export type SignInResult =
  | { ok: true; clinician: Clinician; firstLogin: boolean }
  | { ok: false; message: string };

export const MESSAGES = {
  invalid: 'User ID or password not recognised.',
  firstLoginNeedsNetwork:
    'Cannot reach the base server, and this user ID has not signed in on this tablet before. The first sign-in with new credentials must be done online at base camp.',
};

export function clinicianFromProfile(
  profile: MobileProfile,
  signInMode: 'online' | 'offline',
): Clinician {
  const team = profile.teams[0];
  return {
    id: profile.userId,
    rank: profile.rank,
    displayName: profile.fullName,
    team: team ? team.name || team.teamCode : profile.unit,
    isDemo: false,
    signInMode,
    roleLabel: profile.roleLabel,
    unit: profile.unit,
    personId: profile.personId,
  };
}

function demoMatch(userId: string, password: string): Clinician | null {
  const id = userId.trim().toUpperCase();
  const match = DEMO_ACCOUNTS.find(
    a => a.clinician.id === id && a.password === password,
  );
  return match ? { ...match.clinician, signInMode: 'demo' } : null;
}

export async function signIn(
  userIdRaw: string,
  password: string,
  deps: AuthDeps = getDefaultAuthDeps(),
): Promise<SignInResult> {
  const userId = userIdRaw.trim().toUpperCase();

  const demo = demoMatch(userId, password);
  const provisioning = deps.provisioning ?? getProvisioningStore();

  if (demo) {
    await provisioning.loadSaved();
    return { ok: true, clinician: demo, firstLogin: false };
  }

  const cached = await deps.store.get(userId);
  const reports = cached?.pendingOfflineLogins.count
    ? [{ accountId: cached.profile.accountId, ...cached.pendingOfflineLogins }]
    : [];

  const online = await deps.server.signIn(userId, password, reports);

  if (online.kind === 'ok') {
    await deps.store.saveFromOnlineSignIn(online.profile, password);
    if (!(await provisioning.saveFromServer(online.provisioning))) {
      // Server sent nothing usable: keep scanning with the last download.
      await provisioning.loadSaved();
    }
    return {
      ok: true,
      clinician: clinicianFromProfile(online.profile, 'online'),
      firstLogin: online.firstLogin,
    };
  }

  if (online.kind === 'rejected') {
    const wasValidCredential =
      (online.error === 'INVALID_CREDENTIALS' ||
        online.error === 'ACCOUNT_DISABLED') &&
      cached &&
      (await deps.store.passwordMatches(cached, password));
    if (wasValidCredential) {
      // The server no longer accepts what this tablet saved: drop the copy.
      await deps.store.remove(userId);
    }
    return { ok: false, message: online.message };
  }

  // Unreachable → offline sign-in.
  if (!cached) {
    return { ok: false, message: MESSAGES.firstLoginNeedsNetwork };
  }
  if (!(await deps.store.passwordMatches(cached, password))) {
    return { ok: false, message: MESSAGES.invalid };
  }
  await deps.store.recordOfflineLogin(userId);
  await provisioning.loadSaved();
  return {
    ok: true,
    clinician: clinicianFromProfile(cached.profile, 'offline'),
    firstLogin: false,
  };
}

/**
 * When the server is reachable: report offline sign-ins and delete saved
 * copies the server has revoked. Safe to call any time; never throws.
 */
export async function syncSavedSignIns(
  deps: AuthDeps = getDefaultAuthDeps(),
): Promise<{ removed: string[] } | null> {
  try {
    const saved = await deps.store.list();
    if (saved.length === 0) {
      return { removed: [] };
    }
    const result = await deps.server.sync(
      saved.map(entry => ({
        accountId: entry.profile.accountId,
        userId: entry.profile.userId,
        offlineLogins: entry.pendingOfflineLogins.count
          ? entry.pendingOfflineLogins
          : undefined,
      })),
    );
    if (!result) {
      return null;
    }
    const revoked = result
      .filter(r => r.status === 'REVOKED')
      .map(r => r.accountId);
    const valid = result
      .filter(r => r.status === 'VALID')
      .map(r => r.accountId);
    await deps.store.removeAccounts(revoked);
    await deps.store.markReported(valid);
    return {
      removed: saved
        .filter(e => revoked.includes(e.profile.accountId))
        .map(e => e.profile.userId),
    };
  } catch {
    return null;
  }
}

/* ----------------------------- Emergency ----------------------------- */

const EMERGENCY_LOG_KEY = 'casevac.emergencyAccessLog.v1';

/**
 * Break-glass access when the medic cannot sign in (forgotten password, no
 * network for a first sign-in). The session is clearly marked as unverified
 * and each use is logged on the tablet for later review.
 */
export async function startEmergencySession(
  storage: Pick<typeof AsyncStorage, 'getItem' | 'setItem'> = AsyncStorage,
): Promise<Clinician> {
  const startedAt = new Date().toISOString();
  try {
    const raw = await storage.getItem(EMERGENCY_LOG_KEY);
    const log: string[] = raw ? JSON.parse(raw) : [];
    log.push(startedAt);
    await storage.setItem(EMERGENCY_LOG_KEY, JSON.stringify(log.slice(-500)));
  } catch {
    // Logging must never block emergency care.
  }
  return {
    id: 'EMERGENCY',
    rank: '',
    displayName: 'Emergency access',
    team: 'Not signed in',
    isDemo: false,
    signInMode: 'emergency',
  };
}
