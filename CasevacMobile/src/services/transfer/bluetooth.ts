/**
 * Bluetooth handover — JS side of android/…/transfer/CasevacBluetoothModule.
 *
 * Receiver: permissions → turn on → rename to "JEEWAN|<medic ID>|<name>"
 *   → visible 120 s → listen. Senders list only "JEEWAN|" names, so other
 *   phones and radios never appear.
 * Sender: permissions → turn on → search → pick → connect. Android shows its
 *   pairing dialog (same 6-digit number on both tablets) on first contact.
 *
 * Conversation (one JSON message per line):
 *   sender → offer   {transferId, sender, patientLabel, triage}
 *   receiver → accept | decline
 *   sender → package {envelope}            (sealed: transferPackage.ts)
 *   receiver → receipt {transferId, receiverId, receiverName, code}
 *            | error {message}
 */
import {
  DeviceEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  type EmitterSubscription,
} from 'react-native';
import type { TriageCategory } from '../../types';
import type { TransferSender } from './transferPackage';

interface NativeBluetooth {
  isSupported(): Promise<boolean>;
  isEnabled(): Promise<boolean>;
  requestEnable(): Promise<boolean>;
  requestDiscoverable(seconds: number): Promise<boolean>;
  setDeviceName(name: string): Promise<boolean>;
  restoreDeviceName(): Promise<boolean>;
  startDiscovery(): Promise<boolean>;
  cancelDiscovery(): Promise<boolean>;
  startServer(): Promise<boolean>;
  stopServer(): Promise<boolean>;
  connect(address: string): Promise<{ address: string; name: string | null }>;
  send(line: string): Promise<boolean>;
  disconnect(): Promise<boolean>;
}

export function nativeBluetooth(): NativeBluetooth | null {
  const m = NativeModules.CasevacBluetooth as NativeBluetooth | undefined;
  return Platform.OS === 'android' && m?.isSupported ? m : null;
}

export const DISCOVERABLE_SECONDS = 120;
const NAME_PREFIX = 'JEEWAN|';

/** Name this tablet shows while waiting: "JEEWAN|MED-00045|Maj Meera Iyer". */
export function receiverDeviceName(id: string, label: string): string {
  return `${NAME_PREFIX}${id}|${label}`.slice(0, 48);
}

export interface CasevacDevice {
  address: string;
  medicId: string;
  label: string;
}

/** Only CASEVAC tablets in Receive mode are offered; null for anything else. */
export function parseCasevacDevice(
  name: string | null | undefined,
  address: string,
): CasevacDevice | null {
  if (!name || !name.startsWith(NAME_PREFIX)) {
    return null;
  }
  const [, medicId = '', label = ''] = name.split('|');
  return medicId ? { address, medicId, label: label || medicId } : null;
}

/** Runtime permissions for the role. False if the medic refused any. */
export async function ensureBluetoothPermissions(
  role: 'send' | 'receive',
): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const P = PermissionsAndroid.PERMISSIONS;
  const wanted =
    Number(Platform.Version) >= 31
      ? role === 'send'
        ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT]
        : [P.BLUETOOTH_CONNECT, P.BLUETOOTH_ADVERTISE]
      : role === 'send'
      ? [P.ACCESS_FINE_LOCATION]
      : [];
  if (wanted.length === 0) {
    return true;
  }
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every(p => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/* ------------------------------ Messages ------------------------------ */

export type BtMessage =
  | {
      t: 'offer';
      transferId: string;
      sender: TransferSender;
      patientLabel: string;
      triage: TriageCategory | null;
    }
  | { t: 'accept'; transferId: string }
  | { t: 'decline'; transferId: string }
  | { t: 'package'; envelope: string }
  | {
      t: 'receipt';
      transferId: string;
      receiverId: string;
      receiverName: string;
      code: string;
    }
  | { t: 'error'; message: string };

export function encodeMessage(m: BtMessage): string {
  return JSON.stringify(m);
}

export function decodeMessage(line: string): BtMessage | null {
  try {
    const m = JSON.parse(line) as BtMessage;
    return m && typeof m === 'object' && typeof m.t === 'string' ? m : null;
  } catch {
    return null;
  }
}

/* ------------------------------- Events ------------------------------- */

export interface BtEvents {
  onDevice?: (name: string | null, address: string) => void;
  onDiscoveryFinished?: () => void;
  onConnected?: (name: string | null, address: string) => void;
  onMessage?: (m: BtMessage) => void;
  onDisconnected?: (reason: string) => void;
}

/** Subscribes to the native events; call the returned function to stop. */
export function listenBluetooth(handlers: BtEvents): () => void {
  const subs: EmitterSubscription[] = [
    DeviceEventEmitter.addListener(
      'CasevacBtDeviceFound',
      (e: { name: string | null; address: string }) =>
        handlers.onDevice?.(e.name, e.address),
    ),
    DeviceEventEmitter.addListener('CasevacBtDiscoveryFinished', () =>
      handlers.onDiscoveryFinished?.(),
    ),
    DeviceEventEmitter.addListener(
      'CasevacBtConnected',
      (e: { name: string | null; address: string }) =>
        handlers.onConnected?.(e.name, e.address),
    ),
    DeviceEventEmitter.addListener('CasevacBtLine', (e: { line: string }) => {
      const m = decodeMessage(e.line);
      if (m) {
        handlers.onMessage?.(m);
      }
    }),
    DeviceEventEmitter.addListener(
      'CasevacBtDisconnected',
      (e: { reason: string }) => handlers.onDisconnected?.(e.reason),
    ),
  ];
  return () => subs.forEach(s => s.remove());
}
