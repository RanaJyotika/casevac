/* eslint-disable no-bitwise -- base64 decoding is bit manipulation by definition */
/**
 * Strict base64url (RFC 4648 §5, no padding) decoder.
 * React Native has no Buffer; this avoids a dependency for one function.
 * Returns null for any invalid or non-canonical input, so each byte string
 * has exactly one accepted encoding.
 */
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const LOOKUP: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  LOOKUP[ALPHABET[i]] = i;
}

export function decodeBase64Url(input: string): Uint8Array | null {
  if (input.length % 4 === 1) {
    return null;
  }
  const out = new Uint8Array(Math.floor((input.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of input) {
    const value = LOOKUP[char];
    if (value === undefined) {
      return null;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  // Leftover bits must be zero (canonical encoding).
  if ((buffer & ((1 << bits) - 1)) !== 0) {
    return null;
  }
  return out;
}

/** Encodes an ASCII-only string (validated by the caller) as bytes. */
export function asciiBytes(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x7f) {
      throw new Error('Non-ASCII input');
    }
    out[i] = code;
  }
  return out;
}
