/**
 * Identity provisioning downloaded from the dashboard at medic sign-in.
 *
 * Wristband QR codes carry only random IDs and a signature — no personal or
 * medical data — so a stray scan reveals nothing. A tablet resolves a scan
 * against this directory, which it receives only through a password-
 * authenticated sign-in (admin-dashboard mobileSignIn → `provisioning`):
 *   - trusted issuer public key(s): verify QR signatures offline
 *   - identity directory: patient details + revoked / replaced wristbands
 *
 * Saved in the app's private storage so offline sign-ins and scans keep
 * working; refreshed on every online sign-in. Until a tablet has signed in
 * online once, the bundled demo files are used.
 *
 * Hardening still needed: encrypt the saved directory with a hardware-backed
 * key (Android Keystore) and define how long a stale directory is trusted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import transferKeyJson from '../../provisioning/transfer-key.json';
import { decodeBase64Url } from '../qr/base64url';
import {
  StaticIdentityDirectory,
  StaticTrustStore,
  getBundledIdentityDirectory,
  getBundledTrustStore,
  parseDirectory,
  parseTrustedKeys,
} from './bundledDemoProvisioning';
import type { IdentityDirectory, TrustStore } from './types';

const STORAGE_KEY = 'casevac.provisioning.v1';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

/** Unit key used to encrypt tablet-to-tablet casualty handover. */
export interface TransferKey {
  keyId: string;
  /** 32 bytes. Secret. */
  key: Uint8Array;
}

interface Active {
  trustStore: TrustStore;
  directory: IdentityDirectory;
  transferKey: TransferKey | null;
}

/** Raw JSON as sent by the dashboard. */
export interface RawProvisioning {
  directory?: unknown;
  trustedKeys?: unknown;
  /** Unit transfer key file (casevac.transfer-key); absent on older dashboards. */
  transferKey?: unknown;
}

/** Parses a casevac.transfer-key file; null if missing or malformed. */
export function parseTransferKey(json: unknown): TransferKey | null {
  if (!json || typeof json !== 'object') {
    return null;
  }
  const f = json as Record<string, unknown>;
  if (
    f.format !== 'casevac.transfer-key' ||
    f.formatVersion !== 1 ||
    typeof f.keyId !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{0,31}$/.test(f.keyId) ||
    typeof f.key !== 'string'
  ) {
    return null;
  }
  const key = decodeBase64Url(f.key);
  return key && key.length === 32 ? { keyId: f.keyId, key } : null;
}

let bundledTransferKey: TransferKey | null | undefined;
function getBundledTransferKey(): TransferKey | null {
  if (bundledTransferKey === undefined) {
    bundledTransferKey = parseTransferKey(transferKeyJson);
  }
  return bundledTransferKey;
}

function build(raw: RawProvisioning): Active | null {
  const parsedDirectory = parseDirectory(raw.directory);
  const keys = parseTrustedKeys(raw.trustedKeys);
  // A directory without the expected format, or no usable key, is rejected
  // whole rather than half-applied.
  if (
    !raw.directory ||
    parsedDirectory.generatedAt === null ||
    keys.length === 0
  ) {
    return null;
  }
  return {
    trustStore: new StaticTrustStore(keys),
    directory: new StaticIdentityDirectory(parsedDirectory, 'BACKEND'),
    transferKey: parseTransferKey(raw.transferKey),
  };
}

export class ProvisioningStore {
  private active: Active | null = null;

  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  /** Validates, saves and activates provisioning from an online sign-in. */
  async saveFromServer(raw: RawProvisioning | undefined): Promise<boolean> {
    if (!raw) {
      return false;
    }
    const next = build(raw);
    if (!next) {
      return false;
    }
    this.active = next;
    try {
      await this.storage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          directory: raw.directory,
          trustedKeys: raw.trustedKeys,
          transferKey: raw.transferKey,
          savedAt: new Date().toISOString(),
        }),
      );
    } catch {
      // Still active for this session; the next online sign-in retries.
    }
    return true;
  }

  /** Activates the last saved download (offline sign-in, app restart). */
  async loadSaved(): Promise<boolean> {
    try {
      const text = await this.storage.getItem(STORAGE_KEY);
      if (!text) {
        return false;
      }
      const next = build(JSON.parse(text) as RawProvisioning);
      if (next) {
        this.active = next;
      }
      return next !== null;
    } catch {
      return false;
    }
  }

  trustStore(): TrustStore {
    return this.active?.trustStore ?? getBundledTrustStore();
  }

  directory(): IdentityDirectory {
    return this.active?.directory ?? getBundledIdentityDirectory();
  }

  /**
   * Unit key for casualty handover between tablets: the one downloaded at
   * sign-in, else the bundled development key. Null if neither is usable.
   */
  transferKey(): TransferKey | null {
    return this.active?.transferKey ?? getBundledTransferKey();
  }
}

let defaultStore: ProvisioningStore | null = null;

export function getProvisioningStore(): ProvisioningStore {
  defaultStore ??= new ProvisioningStore();
  return defaultStore;
}

/** Trust store and directory the scanner and ID search should use now. */
export function getActiveTrustStore(): TrustStore {
  return getProvisioningStore().trustStore();
}

export function getActiveIdentityDirectory(): IdentityDirectory {
  return getProvisioningStore().directory();
}

export function getActiveTransferKey(): TransferKey | null {
  return getProvisioningStore().transferKey();
}
