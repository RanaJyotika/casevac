/**
 * Offline sign-in copies, kept in the app's private internal storage
 * (AsyncStorage → app-private SQLite on Android, not readable by other apps).
 *
 * Only a salted PBKDF2-SHA256 hash of the password is stored, never the
 * password itself. The profile (name, rank, unit, role, teams) is stored as
 * returned by the server.
 *
 * Hardening still needed for real deployment: hardware-backed encryption
 * (Android Keystore) for the whole record, and an expiry policy.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { CachedAccount, MobileProfile } from './types';

const STORAGE_KEY = 'casevac.offlineAccounts.v1';
const PBKDF2_ITERATIONS = 20_000;

/** Minimal key-value contract (AsyncStorage-compatible) so tests can inject. */
export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

function randomSalt(): string {
  const bytes = new Uint8Array(16);
  const cryptoObj = (
    globalThis as {
      crypto?: { getRandomValues?: (bytes: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (cryptoObj?.getRandomValues) {
    cryptoObj.getRandomValues(bytes);
  } else {
    // The salt must be unique, not secret, so Math.random is acceptable here.
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return `${Date.now().toString(36)}.${bytesToHex(bytes)}`;
}

async function hash(password: string, salt: string, iterations: number) {
  const out = await pbkdf2Async(
    sha256,
    utf8ToBytes(password),
    utf8ToBytes(salt),
    {
      c: iterations,
      dkLen: 32,
    },
  );
  return bytesToHex(out);
}

/* eslint-disable no-bitwise -- constant-time comparison */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
/* eslint-enable no-bitwise */

const normalise = (userId: string) => userId.trim().toUpperCase();

export class OfflineCredentialStore {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  private async readAll(): Promise<Record<string, CachedAccount>> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private async writeAll(all: Record<string, CachedAccount>) {
    await this.storage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  async list(): Promise<CachedAccount[]> {
    return Object.values(await this.readAll());
  }

  async get(userId: string): Promise<CachedAccount | null> {
    return (await this.readAll())[normalise(userId)] ?? null;
  }

  /** Saves (or refreshes) the copy after a successful online sign-in. */
  async saveFromOnlineSignIn(profile: MobileProfile, password: string) {
    const salt = randomSalt();
    const entry: CachedAccount = {
      profile,
      passwordHash: await hash(password, salt, PBKDF2_ITERATIONS),
      salt,
      iterations: PBKDF2_ITERATIONS,
      savedAt: new Date().toISOString(),
      // The online sign-in just reported any pending offline sign-ins.
      pendingOfflineLogins: { count: 0, lastAt: null },
    };
    const all = await this.readAll();
    all[normalise(profile.userId)] = entry;
    await this.writeAll(all);
    return entry;
  }

  async passwordMatches(entry: CachedAccount, password: string) {
    const actual = await hash(password, entry.salt, entry.iterations);
    return constantTimeEqual(actual, entry.passwordHash);
  }

  async recordOfflineLogin(userId: string, at = new Date().toISOString()) {
    const all = await this.readAll();
    const entry = all[normalise(userId)];
    if (!entry) {
      return;
    }
    entry.pendingOfflineLogins = {
      count: entry.pendingOfflineLogins.count + 1,
      lastAt: at,
    };
    await this.writeAll(all);
  }

  /** Clears pending counts once the server has accepted the report. */
  async markReported(accountIds: string[]) {
    const all = await this.readAll();
    for (const entry of Object.values(all)) {
      if (accountIds.includes(entry.profile.accountId)) {
        entry.pendingOfflineLogins = { count: 0, lastAt: null };
      }
    }
    await this.writeAll(all);
  }

  async remove(userId: string) {
    const all = await this.readAll();
    delete all[normalise(userId)];
    await this.writeAll(all);
  }

  async removeAccounts(accountIds: string[]) {
    const all = await this.readAll();
    for (const [key, entry] of Object.entries(all)) {
      if (accountIds.includes(entry.profile.accountId)) {
        delete all[key];
      }
    }
    await this.writeAll(all);
  }
}
