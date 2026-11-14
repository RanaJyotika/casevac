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

interface Active {
  trustStore: TrustStore;
  directory: IdentityDirectory;
}

/** Raw JSON as sent by the dashboard. */
export interface RawProvisioning {
  directory?: unknown;
  trustedKeys?: unknown;
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
