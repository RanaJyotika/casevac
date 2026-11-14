/**
 * Unit transfer key — the shared secret medic tablets use to encrypt and
 * authenticate casualty records handed from one tablet to another (QR or
 * Bluetooth). Every tablet of the unit receives it at sign-in, so a record
 * from one CASEVAC tablet can only be read by another.
 *
 * DEVELOPMENT ONLY: the key lives in .env.local (`npm run transfer:keygen`).
 * Production needs device enrolment and protected key storage (see
 * INTEGRATION.md); rotating the key means every tablet must sign in online.
 */

export interface TransferKeyFile {
  format: "casevac.transfer-key";
  formatVersion: 1;
  generatedAt: string;
  notice: string;
  keyId: string;
  /** 32 random bytes, base64url. Secret. */
  key: string;
}

const KEY_ID = /^[a-z0-9][a-z0-9-]{0,31}$/;
const KEY = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url without padding

let testOverride: { keyId: string; key: string } | null | undefined;

/** Tests only. `null` = not configured; `undefined` = use the environment. */
export function setTransferKeyForTesting(value: { keyId: string; key: string } | null | undefined): void {
  testOverride = value;
}

export function getTransferKey(): { keyId: string; key: string } | null {
  if (testOverride !== undefined) return testOverride;
  const keyId = process.env.CASEVAC_TRANSFER_KEY_ID?.trim() ?? "";
  const key = process.env.CASEVAC_TRANSFER_KEY?.trim() ?? "";
  if (!KEY_ID.test(keyId) || !KEY.test(key)) return null;
  return { keyId, key };
}

/** What tablets receive at sign-in. Null when no key is configured. */
export function buildTransferKeyFile(): TransferKeyFile | null {
  const k = getTransferKey();
  if (!k) return null;
  return {
    format: "casevac.transfer-key",
    formatVersion: 1,
    generatedAt: new Date().toISOString(),
    notice: "DEVELOPMENT UNIT TRANSFER KEY — secret. Encrypts tablet-to-tablet casualty handover. Not for operational use.",
    keyId: k.keyId,
    key: k.key,
  };
}
