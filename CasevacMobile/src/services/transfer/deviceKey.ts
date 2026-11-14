/**
 * This tablet's own signing key (Ed25519), created on first use. Every
 * transfer package is signed with it, so the receiving tablet can tell the
 * record was not altered after it left this tablet, and which tablet sent it
 * (by its public-key fingerprint).
 *
 * Stored in app-private storage. Hardening still needed: keep it in the
 * Android Keystore and register each tablet's public key with the dashboard.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ed25519 } from '@noble/curves/ed25519.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { decodeBase64Url, encodeBase64Url } from '../qr/base64url';
import { randomBytes } from './random';

const STORAGE_KEY = 'casevac.deviceSigningKey.v1';

export interface DeviceKey {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

let cached: DeviceKey | null = null;

export async function getDeviceKey(
  storage: KeyValueStorage = AsyncStorage,
): Promise<DeviceKey> {
  if (cached) {
    return cached;
  }
  const saved = await storage.getItem(STORAGE_KEY);
  const secret = saved ? decodeBase64Url(saved) : null;
  if (secret && secret.length === 32) {
    cached = { secretKey: secret, publicKey: ed25519.getPublicKey(secret) };
    return cached;
  }
  const secretKey = await randomBytes(32);
  await storage.setItem(STORAGE_KEY, encodeBase64Url(secretKey));
  cached = { secretKey, publicKey: ed25519.getPublicKey(secretKey) };
  return cached;
}

/** Short, readable fingerprint of a public key, e.g. "3F9A-0C21". */
export function fingerprint(publicKey: Uint8Array): string {
  const h = sha256(publicKey);
  const hex = Array.from(h.slice(0, 4), b =>
    b.toString(16).padStart(2, '0'),
  ).join('');
  return `${hex.slice(0, 4)}-${hex.slice(4)}`.toUpperCase();
}

/** Tests only. */
export function resetDeviceKeyCacheForTesting(): void {
  cached = null;
}
