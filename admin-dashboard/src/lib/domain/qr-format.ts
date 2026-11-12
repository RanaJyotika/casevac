/**
 * Versioned QR payload format — the shared contract with the mobile app.
 *
 *   CASEVAC:1:<token>
 *
 * - "CASEVAC" namespace lets the scanner reject unrelated QR codes.
 * - "1" is the format version; future formats (or NFC records) can carry the
 *   same token under a new version without changing the Person identity.
 * - <token> is 128-bit random base64url (22 chars). It contains no name,
 *   service number, contact details or medical data.
 *
 * The mobile app resolves the token against a provisioned identity directory
 * (see INTEGRATION.md). Scanning alone never reveals identity offline.
 */

export const QR_NAMESPACE = "CASEVAC";
export const QR_FORMAT_VERSION = 1 as const;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function buildQrPayload(token: string): string {
  if (!TOKEN_PATTERN.test(token)) {
    throw new Error("Invalid QR token format");
  }
  return `${QR_NAMESPACE}:${QR_FORMAT_VERSION}:${token}`;
}

export type ParsedQrPayload =
  | { ok: true; version: typeof QR_FORMAT_VERSION; token: string }
  | { ok: false; reason: "NOT_CASEVAC" | "UNSUPPORTED_VERSION" | "MALFORMED" };

export function parseQrPayload(raw: string): ParsedQrPayload {
  const parts = raw.trim().split(":");
  if (parts[0] !== QR_NAMESPACE) {
    return { ok: false, reason: "NOT_CASEVAC" };
  }
  if (parts.length !== 3) {
    return { ok: false, reason: "MALFORMED" };
  }
  if (parts[1] !== String(QR_FORMAT_VERSION)) {
    return { ok: false, reason: "UNSUPPORTED_VERSION" };
  }
  if (!TOKEN_PATTERN.test(parts[2])) {
    return { ok: false, reason: "MALFORMED" };
  }
  return { ok: true, version: QR_FORMAT_VERSION, token: parts[2] };
}
