/**
 * Login vault — reversible encryption of mobile sign-in passwords so an admin
 * can view one again on the dashboard after re-verifying (Windows Hello or
 * the admin password). Server side only.
 *
 *   CASEVAC_LOGIN_VAULT_KEY  32 random bytes, base64url (see .env.example)
 *
 * Format: "v1.<iv>.<tag>.<ciphertext>" (AES-256-GCM, base64url parts). The
 * mobile account ID is bound as additional authenticated data, so a vault
 * value copied onto another account fails to decrypt.
 *
 * Security trade-off (accepted by the client): anyone holding both the data
 * file and this key can recover every viewable password. Keep the key out of
 * the data store and out of source control.
 */
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

let testKey: Buffer | null | undefined;

/** Test helper: override the key (null = not configured, undefined = use env). */
export function setLoginVaultKeyForTesting(key: Buffer | null | undefined): void {
  testKey = key;
}

function vaultKey(): Buffer | null {
  if (testKey !== undefined) return testKey;
  const raw = process.env.CASEVAC_LOGIN_VAULT_KEY?.trim();
  if (!raw) return null;
  const key = Buffer.from(raw, "base64url");
  return key.length === 32 ? key : null;
}

export function isLoginVaultConfigured(): boolean {
  return vaultKey() !== null;
}

/** Returns the vault value, or null when no key is configured. */
export function sealPassword(password: string, accountId: string): string | null {
  const key = vaultKey();
  if (!key) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(accountId, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv, tag, ciphertext].map(p => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Returns the password, or null when the key is missing/wrong or the value is damaged. */
export function openPassword(vault: string, accountId: string): string | null {
  const key = vaultKey();
  if (!key) return null;
  const [version, iv, tag, ciphertext] = vault.split(".");
  if (version !== VERSION || !iv || !tag || ciphertext === undefined) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAAD(Buffer.from(accountId, "utf8"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
