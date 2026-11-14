/**
 * Cryptographically secure random bytes for keys and nonces.
 *
 * Hermes has no crypto.getRandomValues, so on the tablet the bytes come from
 * Android's SecureRandom through the app's own native module
 * (CasevacBluetooth.randomBytes). Under Jest / Node, globalThis.crypto is
 * used. There is deliberately NO Math.random fallback: without a secure
 * source, transfer fails loudly instead of producing guessable keys.
 */
import { NativeModules } from 'react-native';

const STD = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Standard base64 (with padding) → bytes. */
function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/[=]+$/, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of clean) {
    const value = STD.indexOf(char);
    if (value < 0) {
      throw new Error('Invalid base64 from native random source');
    }
    // eslint-disable-next-line no-bitwise
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      // eslint-disable-next-line no-bitwise
      out[index++] = (buffer >> bits) & 0xff;
    }
  }
  return out;
}

export async function randomBytes(count: number): Promise<Uint8Array> {
  const webCrypto = (
    globalThis as {
      crypto?: { getRandomValues?: (b: Uint8Array) => Uint8Array };
    }
  ).crypto;
  if (webCrypto?.getRandomValues) {
    return webCrypto.getRandomValues(new Uint8Array(count));
  }
  const native = NativeModules.CasevacBluetooth as
    | { randomBytes?: (n: number) => Promise<string> }
    | undefined;
  if (!native?.randomBytes) {
    throw new Error(
      'No secure random source on this tablet. Reinstall the latest app build.',
    );
  }
  const bytes = fromBase64(await native.randomBytes(count));
  if (bytes.length !== count) {
    throw new Error('Secure random source returned the wrong length');
  }
  return bytes;
}
