/**
 * What this tablet sent and received.
 *
 * Sent: one entry per handover attempt. "Sent — not yet confirmed" until a
 * valid receipt (receipt.ts) arrives; never shown as received without proof.
 * Received: transfer IDs already imported, so scanning the same QR twice or a
 * repeated Bluetooth send never imports a record twice.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const SENT_KEY = 'casevac.transfers.sent.v1';
const RECEIVED_KEY = 'casevac.transfers.received.v1';

export type TransferChannel = 'QR' | 'BLUETOOTH';

export interface SentTransfer {
  transferId: string;
  assessmentId: string;
  patientLabel: string;
  channel: TransferChannel;
  sentAt: string;
  status: 'SENT' | 'RECEIVED';
  receiverId: string | null;
  receiverName: string | null;
  receivedAt: string | null;
}

export interface ReceivedTransfer {
  transferId: string;
  assessmentId: string;
  patientLabel: string;
  channel: TransferChannel;
  senderId: string;
  senderName: string;
  receivedAt: string;
  receivedBy: string;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export class TransferLog {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  private async read<T>(key: string): Promise<T[]> {
    try {
      const raw = await this.storage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  sent(): Promise<SentTransfer[]> {
    return this.read<SentTransfer>(SENT_KEY);
  }

  received(): Promise<ReceivedTransfer[]> {
    return this.read<ReceivedTransfer>(RECEIVED_KEY);
  }

  /** Latest handover attempt for an evacuation (received ones first). */
  async latestFor(assessmentId: string): Promise<SentTransfer | null> {
    const mine = (await this.sent()).filter(
      s => s.assessmentId === assessmentId,
    );
    return (
      [...mine].reverse().find(s => s.status === 'RECEIVED') ??
      mine[mine.length - 1] ??
      null
    );
  }

  async recordSent(
    entry: Omit<
      SentTransfer,
      'status' | 'receiverId' | 'receiverName' | 'receivedAt'
    >,
  ): Promise<SentTransfer> {
    const all = await this.sent();
    const existing = all.find(s => s.transferId === entry.transferId);
    if (existing) {
      return existing;
    }
    const sent: SentTransfer = {
      ...entry,
      status: 'SENT',
      receiverId: null,
      receiverName: null,
      receivedAt: null,
    };
    await this.storage.setItem(SENT_KEY, JSON.stringify([...all, sent]));
    return sent;
  }

  /** Marks a sent transfer received (call only with a verified receipt). */
  async markReceived(
    transferId: string,
    receiverId: string,
    receiverName: string | null,
  ): Promise<SentTransfer | null> {
    const all = await this.sent();
    let updated: SentTransfer | null = null;
    const next = all.map(s => {
      if (s.transferId !== transferId) {
        return s;
      }
      updated = {
        ...s,
        status: 'RECEIVED',
        receiverId: receiverId.toUpperCase(),
        receiverName,
        receivedAt: s.receivedAt ?? new Date().toISOString(),
      };
      return updated;
    });
    if (updated) {
      await this.storage.setItem(SENT_KEY, JSON.stringify(next));
    }
    return updated;
  }

  async wasReceived(transferId: string): Promise<boolean> {
    return (await this.received()).some(r => r.transferId === transferId);
  }

  async recordReceived(entry: ReceivedTransfer): Promise<void> {
    const all = await this.received();
    if (all.some(r => r.transferId === entry.transferId)) {
      return;
    }
    await this.storage.setItem(RECEIVED_KEY, JSON.stringify([...all, entry]));
  }
}

let defaultLog: TransferLog | null = null;
export function getTransferLog(): TransferLog {
  defaultLog ??= new TransferLog();
  return defaultLog;
}
