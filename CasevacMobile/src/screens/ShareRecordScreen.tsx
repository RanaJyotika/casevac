/**
 * M20 — Hand over to next team (sending tablet).
 *
 * Opens from Evacuation Completed (or a handed-over record in history).
 * Seals the whole evacuation once (transferPackage.ts) and sends it either:
 *
 *   Show QR — the screen loops through the QR frames; the next team scans
 *     them with Receive patient. Delivery is confirmed only when this tablet
 *     scans the receipt QR from their screen (or the medic types their ID and
 *     6-digit code) and the code checks out.
 *   Bluetooth — turn on → search → only CASEVAC tablets in Receive mode are
 *     listed → pick one → Android pairs them (same 6-digit number on both
 *     tablets, first time only) → the next team accepts → the record is sent
 *     and their receipt comes back automatically.
 * Until a valid receipt arrives the record says "Sent — not yet confirmed".
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_BRAND } from '../brand';
import {
  AppHeader,
  EvacuationBadge,
  FormField,
  Icon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  TriagePill,
} from '../components';
import { QrCode, QrScannerView } from '../components/transferParts';
import {
  getActiveTransferKey,
  type TransferKey,
} from '../services/identity/provisioningStore';
import {
  DISCOVERABLE_SECONDS,
  encodeMessage,
  ensureBluetoothPermissions,
  listenBluetooth,
  nativeBluetooth,
  parseCasevacDevice,
  type CasevacDevice,
} from '../services/transfer/bluetooth';
import { toFrames } from '../services/transfer/qrFrames';
import {
  parseReceiptQr,
  verifyReceipt,
  type Receipt,
} from '../services/transfer/receipt';
import {
  getTransferLog,
  type SentTransfer,
  type TransferChannel,
  type TransferLog,
} from '../services/transfer/transferLog';
import {
  buildTransferPackage,
  sealPackage,
  summarise,
  TransferError,
  type PackageSources,
  type TransferSummary,
} from '../services/transfer/transferPackage';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import type { Clinician } from '../types';
import { formatDateTime } from '../utils/format';

interface ShareRecordScreenProps {
  assessmentId: string;
  clinician: Clinician;
  onBack: () => void;
  /** Injected in tests. */
  unitKey?: TransferKey | null;
  log?: TransferLog;
  sources?: PackageSources;
  frameIntervalMs?: number;
}

type Mode = 'choose' | 'qr' | 'bluetooth';

type BtState =
  | { kind: 'idle' }
  | { kind: 'preparing' }
  | { kind: 'searching'; done: boolean }
  | { kind: 'connecting'; device: CasevacDevice }
  | { kind: 'waiting-accept'; device: CasevacDevice }
  | { kind: 'sending'; device: CasevacDevice }
  | { kind: 'declined'; device: CasevacDevice }
  | { kind: 'failed'; message: string };

interface Sealed {
  envelope: string;
  frames: string[];
  summary: TransferSummary;
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNo}>
        <Text style={styles.stepNoText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

export function ShareRecordScreen({
  assessmentId,
  clinician,
  onBack,
  unitKey,
  log,
  sources,
  frameIntervalMs = 450,
}: ShareRecordScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const transfers = useMemo(() => log ?? getTransferLog(), [log]);
  const key = unitKey === undefined ? getActiveTransferKey() : unitKey;

  const [sealed, setSealed] = useState<Sealed | null>(null);
  const [sealError, setSealError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('choose');
  const [frame, setFrame] = useState(0);
  const [confirm, setConfirm] = useState<'none' | 'scan' | 'type'>('none');
  const [typedId, setTypedId] = useState('');
  const [typedCode, setTypedCode] = useState('');
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [delivered, setDelivered] = useState<SentTransfer | null>(null);
  const [bt, setBt] = useState<BtState>({ kind: 'idle' });
  const [devices, setDevices] = useState<CasevacDevice[]>([]);
  const btDevice = useRef<CasevacDevice | null>(null);
  const native = nativeBluetooth();

  // Seal once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pkg = await buildTransferPackage(
          assessmentId,
          clinician,
          sources,
        );
        const envelope = await sealPackage(pkg, key);
        if (!cancelled) {
          setSealed({
            envelope,
            frames: toFrames(envelope),
            summary: summarise(pkg),
          });
        }
      } catch (e) {
        if (!cancelled) {
          setSealError(
            e instanceof TransferError
              ? e.message
              : 'The record could not be prepared for transfer.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seal once per screen
  }, [assessmentId]);

  // Loop the QR frames.
  useEffect(() => {
    if (mode !== 'qr' || !sealed || sealed.frames.length < 2 || delivered) {
      return;
    }
    const timer = setInterval(
      () => setFrame(f => (f + 1) % sealed.frames.length),
      frameIntervalMs,
    );
    return () => clearInterval(timer);
  }, [mode, sealed, delivered, frameIntervalMs]);

  const record = useCallback(
    async (channel: TransferChannel) => {
      if (sealed) {
        await transfers.recordSent({
          transferId: sealed.summary.transferId,
          assessmentId,
          patientLabel: sealed.summary.patientLabel,
          channel,
          sentAt: new Date().toISOString(),
        });
      }
    },
    [sealed, transfers, assessmentId],
  );

  /** Accepts a receipt only if its code proves delivery of this transfer. */
  const acceptReceipt = useCallback(
    async (r: Receipt, receiverName: string | null) => {
      if (!sealed || !key) {
        return false;
      }
      if (
        r.transferId !== sealed.summary.transferId ||
        !verifyReceipt(key, r)
      ) {
        setReceiptError(
          'That receipt does not match this transfer. Ask the next team to show the receipt for this patient.',
        );
        return false;
      }
      setReceiptError(null);
      const updated = await transfers.markReceived(
        r.transferId,
        r.receiverId,
        receiverName,
      );
      setDelivered(updated);
      return true;
    },
    [sealed, key, transfers],
  );

  /* ------------------------------ QR ------------------------------ */

  const startQr = async () => {
    setMode('qr');
    setFrame(0);
    await record('QR');
  };

  const onReceiptScan = (text: string) => {
    const r = parseReceiptQr(text);
    if (!r) {
      setReceiptError('That is not a Jeewan receipt QR.');
      return;
    }
    acceptReceipt(r, null);
  };

  const confirmTyped = () => {
    if (!sealed) {
      return;
    }
    acceptReceipt(
      {
        transferId: sealed.summary.transferId,
        receiverId: typedId.trim().toUpperCase(),
        code: typedCode.trim(),
      },
      null,
    );
  };

  /* --------------------------- Bluetooth --------------------------- */

  const stopBluetooth = useCallback(() => {
    native?.cancelDiscovery().catch(() => {});
    native?.disconnect().catch(() => {});
  }, [native]);

  useEffect(() => {
    if (mode !== 'bluetooth' || !native) {
      return;
    }
    const unsubscribe = listenBluetooth({
      onDevice: (name, address) => {
        const d = parseCasevacDevice(name, address);
        if (d) {
          setDevices(prev =>
            prev.some(p => p.address === d.address)
              ? prev.map(p => (p.address === d.address ? d : p))
              : [...prev, d],
          );
        }
      },
      onDiscoveryFinished: () =>
        setBt(s =>
          s.kind === 'searching' ? { kind: 'searching', done: true } : s,
        ),
      onMessage: async m => {
        const device = btDevice.current;
        if (!device || !sealed) {
          return;
        }
        if (m.t === 'accept' && m.transferId === sealed.summary.transferId) {
          setBt({ kind: 'sending', device });
          await record('BLUETOOTH');
          native
            .send(encodeMessage({ t: 'package', envelope: sealed.envelope }))
            .catch(() =>
              setBt({
                kind: 'failed',
                message: 'Sending was interrupted. Try again or use QR.',
              }),
            );
        } else if (m.t === 'decline') {
          setBt({ kind: 'declined', device });
          native.disconnect().catch(() => {});
        } else if (m.t === 'receipt') {
          const ok = await acceptReceipt(
            {
              transferId: m.transferId,
              receiverId: m.receiverId,
              code: m.code,
            },
            m.receiverName,
          );
          if (!ok) {
            setBt({
              kind: 'failed',
              message:
                'The receipt from the other tablet could not be verified.',
            });
          }
          native.disconnect().catch(() => {});
        } else if (m.t === 'error') {
          setBt({
            kind: 'failed',
            message: `The other tablet could not import the record: ${m.message}`,
          });
          native.disconnect().catch(() => {});
        }
      },
      onDisconnected: () =>
        setBt(s =>
          s.kind === 'waiting-accept' || s.kind === 'sending'
            ? {
                kind: 'failed',
                message:
                  'The Bluetooth connection was lost. Try again or use QR.',
              }
            : s,
        ),
    });
    return () => {
      unsubscribe();
      stopBluetooth();
    };
  }, [mode, native, sealed, record, acceptReceipt, stopBluetooth]);

  const startBluetooth = async () => {
    setMode('bluetooth');
    if (!native) {
      setBt({
        kind: 'failed',
        message:
          'Bluetooth transfer needs the latest app build on this tablet. Use QR instead.',
      });
      return;
    }
    setBt({ kind: 'preparing' });
    setDevices([]);
    try {
      if (!(await ensureBluetoothPermissions('send'))) {
        setBt({
          kind: 'failed',
          message:
            'Bluetooth permission was not given. Allow “Nearby devices” for Jeewan, or use QR.',
        });
        return;
      }
      if (!(await native.requestEnable())) {
        setBt({
          kind: 'failed',
          message: 'Bluetooth is off. Turn it on to send, or use QR.',
        });
        return;
      }
      setBt({ kind: 'searching', done: false });
      await native.startDiscovery();
    } catch (e) {
      setBt({
        kind: 'failed',
        message: e instanceof Error ? e.message : 'Bluetooth could not start.',
      });
    }
  };

  const connectTo = async (device: CasevacDevice) => {
    if (!native || !sealed) {
      return;
    }
    btDevice.current = device;
    setBt({ kind: 'connecting', device });
    try {
      await native.connect(device.address);
      setBt({ kind: 'waiting-accept', device });
      await native.send(
        encodeMessage({
          t: 'offer',
          transferId: sealed.summary.transferId,
          sender: sealed.summary.sender,
          patientLabel: sealed.summary.patientLabel,
          triage: sealed.summary.triage,
        }),
      );
    } catch {
      setBt({
        kind: 'failed',
        message: `Could not connect to ${device.label}. Check that pairing was allowed and the other tablet is still waiting, then try again.`,
      });
    }
  };

  /* ------------------------------ View ------------------------------ */

  const qrSize = Math.min(wide ? 420 : width - spacing.lg * 4, 460);
  const summary = sealed?.summary;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Hand Over to Next Team"
        onBack={onBack}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {summary ? (
          <View style={styles.patient}>
            <Icon name="user" size={26} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.patientName}>{summary.patientLabel}</Text>
              <Text style={styles.meta}>
                Initial care by{' '}
                {[clinician.rank, clinician.displayName]
                  .filter(Boolean)
                  .join(' ')}{' '}
                ({clinician.id})
              </Text>
            </View>
            {summary.triage ? <TriagePill category={summary.triage} /> : null}
          </View>
        ) : null}

        {sealError ? (
          <Notice
            tone="error"
            title="CANNOT PREPARE TRANSFER"
            message={sealError}
          />
        ) : !sealed ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.meta}>Preparing the record…</Text>
          </View>
        ) : delivered ? (
          <View style={styles.success}>
            <View style={styles.successIcon}>
              <Icon name="check" size={40} color={colors.onPrimary} />
            </View>
            <Text style={styles.successTitle} accessibilityRole="header">
              Received by{' '}
              {delivered.receiverName ? `${delivered.receiverName} ` : ''}(
              {delivered.receiverId})
            </Text>
            <Text style={styles.meta}>
              Confirmed{' '}
              {delivered.receivedAt ? formatDateTime(delivered.receivedAt) : ''}{' '}
              · {delivered.channel === 'QR' ? 'QR' : 'Bluetooth'}. The next
              team’s tablet verified the record.
            </Text>
            <PrimaryButton title="Done" onPress={onBack} />
          </View>
        ) : mode === 'choose' ? (
          <>
            <Text style={styles.lead}>
              How will you hand this record to the next team’s tablet? Ask them
              to open <Text style={styles.bold}>Receive patient</Text> on their
              Home screen first.
            </Text>
            <View style={[styles.choices, wide && styles.choicesWide]}>
              <Pressable
                onPress={startQr}
                accessibilityRole="button"
                accessibilityLabel="Show QR"
                accessibilityHint="Shows the record as QR codes for the other tablet to scan"
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="scan" size={40} color={colors.primary} />
                <Text style={styles.choiceTitle}>Show QR</Text>
                <Text style={styles.choiceText}>
                  No radio signal, no pairing. The other tablet scans this
                  screen.
                </Text>
              </Pressable>
              <Pressable
                onPress={startBluetooth}
                accessibilityRole="button"
                accessibilityLabel="Share via Bluetooth"
                accessibilityHint="Finds the other Jeewan tablet nearby and sends the record"
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="handover" size={40} color={colors.primary} />
                <Text style={styles.choiceTitle}>Share via Bluetooth</Text>
                <Text style={styles.choiceText}>
                  Sends to a nearby Jeewan tablet. Uses radio — follow your
                  unit’s rules.
                </Text>
              </Pressable>
            </View>
          </>
        ) : mode === 'qr' ? (
          <>
            <View style={[styles.qrLayout, wide && styles.qrLayoutWide]}>
              <View style={styles.qrPanel}>
                <QrCode
                  value={sealed.frames[frame % sealed.frames.length]}
                  size={qrSize}
                  label={`Patient transfer QR code, part ${frame + 1} of ${
                    sealed.frames.length
                  }`}
                />
                <Text style={styles.frameText}>
                  {sealed.frames.length > 1
                    ? `Part ${(frame % sealed.frames.length) + 1} of ${
                        sealed.frames.length
                      } — keep the camera on the screen until it finishes`
                    : 'Single QR code'}
                </Text>
              </View>
              <View style={[styles.flex, styles.gap]}>
                <Step
                  n={1}
                  text="On the next team’s tablet: Home → Receive patient → Scan QR."
                />
                <Step
                  n={2}
                  text="Hold their camera 20–40 cm from this screen. Turn your screen brightness up in sunlight."
                />
                <Step
                  n={3}
                  text="Their tablet shows a receipt QR and a 6-digit code. Confirm it here."
                />
                <EvacuationBadge
                  kind="SENT_UNCONFIRMED"
                  label="Sent — not yet confirmed"
                />
              </View>
            </View>

            {confirm === 'none' ? (
              <View style={[styles.actions, wide && styles.actionsWide]}>
                <View style={wide ? styles.flex : undefined}>
                  <PrimaryButton
                    title="Scan their receipt"
                    onPress={() => setConfirm('scan')}
                  />
                </View>
                <View style={wide ? styles.flex : undefined}>
                  <SecondaryButton
                    title="Type their code"
                    onPress={() => setConfirm('type')}
                  />
                </View>
              </View>
            ) : confirm === 'scan' ? (
              <View style={styles.gap}>
                <QrScannerView active onCode={onReceiptScan} height={260} />
                <SecondaryButton
                  title="Type their code instead"
                  onPress={() => setConfirm('type')}
                />
              </View>
            ) : (
              <View style={styles.gap}>
                <View style={[styles.grid, wide && styles.gridWide]}>
                  <View style={wide ? styles.flex : undefined}>
                    <FormField
                      label="Receiving medic ID"
                      value={typedId}
                      onChangeText={setTypedId}
                      autoCapitalize="characters"
                      placeholder="e.g. MED-00045"
                      maxLength={40}
                    />
                  </View>
                  <View style={wide ? styles.flex : undefined}>
                    <FormField
                      label="6-digit receipt code"
                      value={typedCode}
                      onChangeText={v => setTypedCode(v.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                </View>
                <PrimaryButton
                  title="Confirm receipt"
                  onPress={confirmTyped}
                  disabled={!typedId.trim() || typedCode.length !== 6}
                />
              </View>
            )}
            {receiptError ? (
              <Notice
                tone="error"
                title="NOT CONFIRMED"
                message={receiptError}
              />
            ) : null}
            <SecondaryButton
              title="Use Bluetooth instead"
              onPress={startBluetooth}
            />
          </>
        ) : (
          <>
            {bt.kind === 'preparing' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.meta}>Turning on Bluetooth…</Text>
              </View>
            ) : bt.kind === 'searching' ? (
              <View style={styles.gap}>
                <Text style={styles.lead}>
                  Choose the next team’s tablet. Only Jeewan tablets waiting in{' '}
                  <Text style={styles.bold}>Receive patient</Text> are listed.
                </Text>
                {devices.length === 0 ? (
                  <View style={styles.center}>
                    {bt.done ? null : (
                      <ActivityIndicator color={colors.primary} />
                    )}
                    <Text style={styles.meta}>
                      {bt.done
                        ? 'No Jeewan tablet found. Check the other tablet is on Receive patient → Bluetooth and visible.'
                        : 'Searching for nearby Jeewan tablets…'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.list}>
                    {devices.map(d => (
                      <Pressable
                        key={d.address}
                        onPress={() => connectTo(d)}
                        accessibilityRole="button"
                        accessibilityLabel={`Send to ${d.label}, ${d.medicId}`}
                        style={({ pressed }) => [
                          styles.device,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Icon name="user" size={28} color={colors.primary} />
                        <View style={styles.flex}>
                          <Text style={styles.deviceName}>{d.label}</Text>
                          <Text style={styles.meta}>{d.medicId}</Text>
                        </View>
                        <Icon
                          name="chevronRight"
                          size={22}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
                {bt.done ? (
                  <SecondaryButton
                    title="Search again"
                    onPress={startBluetooth}
                  />
                ) : null}
              </View>
            ) : bt.kind === 'connecting' ? (
              <View style={styles.gap}>
                <View style={styles.center}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.lead}>
                    Connecting to {bt.device.label}…
                  </Text>
                </View>
                <Notice
                  tone="warning"
                  title="Check the pairing number"
                  message="If Android asks to pair, make sure the same 6-digit number is shown on both tablets before tapping Pair."
                />
              </View>
            ) : bt.kind === 'waiting-accept' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.lead}>
                  Waiting for {bt.device.label} to accept the patient…
                </Text>
              </View>
            ) : bt.kind === 'sending' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.lead}>
                  Sending the record to {bt.device.label}…
                </Text>
              </View>
            ) : bt.kind === 'declined' ? (
              <Notice
                tone="warning"
                title="Declined"
                message={`${bt.device.label} declined the patient. Nothing was sent.`}
              />
            ) : bt.kind === 'failed' ? (
              <Notice
                tone="error"
                title="BLUETOOTH TRANSFER FAILED"
                message={bt.message}
              />
            ) : null}
            {bt.kind === 'declined' || bt.kind === 'failed' ? (
              <SecondaryButton
                title="Try Bluetooth again"
                onPress={startBluetooth}
              />
            ) : null}
            <SecondaryButton title="Use QR instead" onPress={startQr} />
            <Text style={styles.small}>
              Bluetooth stays visible for at most {DISCOVERABLE_SECONDS} s on
              the receiving tablet. Turn Bluetooth off after the handover if
              your unit requires radio silence.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: spacing.md },
  pressed: { backgroundColor: colors.surface },
  bold: { fontWeight: '700' },
  center: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  lead: { ...typography.body, color: colors.textPrimary },
  meta: { ...typography.caption, color: colors.textSecondary },
  small: { ...typography.helper, color: colors.textSecondary },

  patient: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg + 2,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  patientName: {
    ...typography.label,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  choices: { gap: spacing.md },
  choicesWide: { flexDirection: 'row' },
  choice: {
    flex: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  choiceTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  choiceText: {
    ...typography.caption,
    textAlign: 'center',
    color: colors.textSecondary,
  },

  qrLayout: { gap: spacing.lg },
  qrLayoutWide: { flexDirection: 'row', alignItems: 'center' },
  qrPanel: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    backgroundColor: '#FFFFFF',
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
  },
  frameText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  stepNo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  stepNoText: { fontWeight: '800', color: colors.onPrimary },
  stepText: { ...typography.body, flex: 1, color: colors.textPrimary },

  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row' },
  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },

  list: {
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    overflow: 'hidden',
  },
  device: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  deviceName: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  success: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: colors.success,
    backgroundColor: colors.background,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  successTitle: {
    ...typography.heading,
    textAlign: 'center',
    color: colors.textPrimary,
  },
});
