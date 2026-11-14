/**
 * Splits a sealed package into QR-sized frames shown one after another on
 * the sending tablet, and reassembles them on the receiving tablet in any
 * order (a missed frame is simply caught on the next loop).
 *
 * Frame text: "CVXF1|<group>|<index>|<total>|<chunk>"
 *   group = 8 hex characters identifying this package (so frames from two
 *   different transfers are never mixed).
 * ~600 characters per frame keeps each QR easy to read from a screen.
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { strToU8 } from 'fflate';

const PREFIX = 'CVXF1';
export const FRAME_CHARS = 600;

function groupOf(envelope: string): string {
  return Array.from(sha256(strToU8(envelope)).slice(0, 4), b =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

export function toFrames(envelope: string, size = FRAME_CHARS): string[] {
  const group = groupOf(envelope);
  const total = Math.max(1, Math.ceil(envelope.length / size));
  const frames: string[] = [];
  for (let i = 0; i < total; i++) {
    frames.push(
      `${PREFIX}|${group}|${i + 1}|${total}|${envelope.slice(
        i * size,
        (i + 1) * size,
      )}`,
    );
  }
  return frames;
}

export function isFrame(text: string): boolean {
  return text.startsWith(`${PREFIX}|`);
}

export type AssemblyState =
  | { status: 'ignored' }
  | { status: 'progress'; have: number; total: number }
  | { status: 'complete'; envelope: string };

/** Collects scanned frames until the whole package is present. */
export class FrameAssembler {
  private group: string | null = null;
  private total = 0;
  private parts = new Map<number, string>();

  add(text: string): AssemblyState {
    const match = /^CVXF1\|([0-9a-f]{8})\|(\d{1,4})\|(\d{1,4})\|(.*)$/s.exec(
      text,
    );
    if (!match) {
      return { status: 'ignored' };
    }
    const [, group, indexText, totalText, chunk] = match;
    const index = Number(indexText);
    const total = Number(totalText);
    if (index < 1 || total < 1 || index > total) {
      return { status: 'ignored' };
    }
    if (group !== this.group || total !== this.total) {
      // A different transfer started: begin again.
      this.group = group;
      this.total = total;
      this.parts = new Map();
    }
    this.parts.set(index, chunk);
    if (this.parts.size < total) {
      return { status: 'progress', have: this.parts.size, total };
    }
    let envelope = '';
    for (let i = 1; i <= total; i++) {
      envelope += this.parts.get(i) ?? '';
    }
    if (groupOf(envelope) !== group) {
      // A damaged frame: start over rather than import something wrong.
      this.parts = new Map();
      return { status: 'progress', have: 0, total };
    }
    return { status: 'complete', envelope };
  }

  reset(): void {
    this.group = null;
    this.total = 0;
    this.parts = new Map();
  }
}
