/**
 * Proof that the next team's tablet actually received and verified a
 * transfer. The receiving tablet computes a 6-digit code from the unit key,
 * the transfer ID and its medic's ID; only a tablet holding the unit key can
 * produce it, so the sending tablet can trust "Received by MED-00045".
 *
 *   QR:        receiver shows "CVXACK1|<transferId>|<receiverId>|<code>"
 *              (or the medic types the receiver ID + 6 digits)
 *   Bluetooth: the same fields are sent back automatically.
 */
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { strToU8 } from 'fflate';
import type { TransferKey } from '../identity/provisioningStore';

export function receiptCode(
  unitKey: TransferKey,
  transferId: string,
  receiverId: string,
): string {
  const mac = hmac(
    sha256,
    unitKey.key,
    strToU8(`casevac-ack|${transferId}|${receiverId.trim().toUpperCase()}`),
  );
  const n =
    // eslint-disable-next-line no-bitwise
    ((mac[0] << 24) | (mac[1] << 16) | (mac[2] << 8) | mac[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, '0');
}

export interface Receipt {
  transferId: string;
  receiverId: string;
  code: string;
}

export function receiptQr(r: Receipt): string {
  return `CVXACK1|${r.transferId}|${r.receiverId}|${r.code}`;
}

export function parseReceiptQr(text: string): Receipt | null {
  const m = /^CVXACK1\|([0-9a-f]{16})\|([A-Za-z0-9-]{1,40})\|(\d{6})$/.exec(
    text.trim(),
  );
  return m ? { transferId: m[1], receiverId: m[2], code: m[3] } : null;
}

/** True when the code proves this transfer was received by receiverId. */
export function verifyReceipt(unitKey: TransferKey, r: Receipt): boolean {
  return receiptCode(unitKey, r.transferId, r.receiverId) === r.code;
}
