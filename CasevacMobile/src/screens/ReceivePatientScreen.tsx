/**
 * M21 — Receive patient (next team's tablet).
 *
 * Opens from Home. Two ways in, both verified the same way
 * (transferPackage.openPackage → importTransfer):
 *
 *   Scan QR — read the looping QR frames on the sending tablet. When the
 *     record is complete and verified, it is saved here and this screen shows
 *     a receipt QR + 6-digit code for the sender to confirm delivery.
 *   Bluetooth — turn on, become visible for 120 s as
 *     "JEEWAN|<medic ID>|<name>", accept the pairing (same number on both
 *     tablets), then Accept / Decline the patient offered. The receipt goes
 *     back automatically.
 * The received evacuation is read only; the team continues care with
 * Open patient record → Start Evacuation.
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
  Icon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TriagePill,
} from '../components';
import { BodyDiagram } from '../components/BodyDiagram';
import { QrCode, QrScannerView } from '../components/transferParts';
import {
  getActiveIdentityDirectory,
  getActiveTransferKey,
  type TransferKey,
} from '../services/identity/provisioningStore';
import type {
  IdentityDirectory,
  PatientIdentity,
} from '../services/identity/types';
import {
  DISCOVERABLE_SECONDS,
  encodeMessage,
  ensureBluetoothPermissions,
  listenBluetooth,
  nativeBluetooth,
  receiverDeviceName,
  type BtMessage,
} from '../services/transfer/bluetooth';
import {
  importTransfer,
  type ImportResult,
} from '../services/transfer/importTransfer';
import { FrameAssembler, isFrame } from '../services/transfer/qrFrames';
import { receiptQr } from '../services/transfer/receipt';
import type { TransferLog } from '../services/transfer/transferLog';
import {
  isTransferEnvelope,
  openPackage,
  TransferError,
  type PackageSources,
  type TransferPatient,
} from '../services/transfer/transferPackage';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import type { Clinician } from '../types';

/** Patient Identification for a casualty received from another tablet. */
export interface TransferIdentification {
  ok: true;
  method: 'TRANSFER';
  patient: TransferPatient;
  /** This tablet's directory record for the patient, when it has one. */
  directoryPatient: PatientIdentity | null;
  /** e.g. "Cpl. R. Demo (MED-00012)" */
  receivedFrom: string;
}

interface ReceivePatientScreenProps {
  clinician: Clinician;
  onBack: () => void;
  onOpenPatient: (result: TransferIdentification) => void;
  /**
   * Set when the wristband scanner read a transfer QR: open straight in
   * Scan QR mode and keep the part already read.
   */
  firstCode?: string;
  /** Injected in tests. */
  unitKey?: TransferKey | null;
  directory?: IdentityDirectory;
  sources?: PackageSources & { log?: TransferLog };
}

type Mode = 'choose' | 'qr' | 'bluetooth';

type BtState =
  | { kind: 'preparing' }
  | { kind: 'waiting'; secondsLeft: number }
  | { kind: 'connected' }
  | { kind: 'offer'; offer: Extract<BtMessage, { t: 'offer' }> }
  | { kind: 'receiving' }
  | { kind: 'failed'; message: string };

interface Received {
  result: ImportResult;
  channel: 'QR' | 'BLUETOOTH';
  patient: TransferPatient;
  receivedFrom: string;
}

export function ReceivePatientScreen({
  clinician,
  onBack,
  onOpenPatient,
  firstCode,
  unitKey,
  directory,
  sources,
}: ReceivePatientScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const key = unitKey === undefined ? getActiveTransferKey() : unitKey;
  const patients = useMemo(
    () => directory ?? getActiveIdentityDirectory(),
    [directory],
  );
  const native = nativeBluetooth();

  const [mode, setMode] = useState<Mode>(firstCode ? 'qr' : 'choose');
  const [progress, setProgress] = useState<{
    have: number;
    total: number;
  } | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [received, setReceived] = useState<Received | null>(null);
  const [bt, setBt] = useState<BtState>({ kind: 'preparing' });
  const assembler = useRef(new FrameAssembler());
  const busy = useRef(false);

  /** Opens, verifies and saves a sealed record. Throws TransferError. */
  const receive = useCallback(
    async (
      envelope: string,
      channel: 'QR' | 'BLUETOOTH',
    ): Promise<Received> => {
      const pkg = openPackage(envelope, key);
      const result = await importTransfer(
        pkg,
        clinician,
        key!,
        channel,
        sources,
      );
      const receivedFrom = `${[pkg.sender.rank, pkg.sender.name]
        .filter(Boolean)
        .join(' ')} (${pkg.sender.id})`;
      return { result, channel, patient: pkg.patient, receivedFrom };
    },
    [key, clinician, sources],
  );

  /* ------------------------------ QR ------------------------------ */

  const onScan = async (text: string) => {
    if (busy.current || received) {
      return;
    }
    const envelope = isFrame(text)
      ? (() => {
          const state = assembler.current.add(text);
          if (state.status === 'progress') {
            setProgress({ have: state.have, total: state.total });
            setScanError(null);
          }
          return state.status === 'complete' ? state.envelope : null;
        })()
      : isTransferEnvelope(text)
      ? text
      : null;
    if (!envelope) {
      if (!isFrame(text)) {
        setScanError(
          'That is not a Jeewan patient transfer. Scan the QR on the sending tablet’s Hand over screen.',
        );
      }
      return;
    }
    busy.current = true;
    setImporting(true);
    try {
      setReceived(await receive(envelope, 'QR'));
    } catch (e) {
      assembler.current.reset();
      setProgress(null);
      setScanError(
        e instanceof TransferError
          ? e.message
          : 'The record could not be saved on this tablet.',
      );
    } finally {
      busy.current = false;
      setImporting(false);
    }
  };

  // Opened from the wristband scanner: keep the QR part it already read.
  const firstHandled = useRef(false);
  useEffect(() => {
    if (firstCode && !firstHandled.current) {
      firstHandled.current = true;
      onScan(firstCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  /* --------------------------- Bluetooth --------------------------- */

  useEffect(() => {
    if (mode !== 'bluetooth' || !native) {
      return;
    }
    let countdown: ReturnType<typeof setInterval> | null = null;
    const unsubscribe = listenBluetooth({
      onConnected: () => {
        if (countdown) {
          clearInterval(countdown);
        }
        setBt({ kind: 'connected' });
      },
      onMessage: async m => {
        if (m.t === 'offer') {
          setBt({ kind: 'offer', offer: m });
        } else if (m.t === 'package') {
          setBt({ kind: 'receiving' });
          try {
            const r = await receive(m.envelope, 'BLUETOOTH');
            await native.send(
              encodeMessage({
                t: 'receipt',
                transferId: r.result.receipt.transferId,
                receiverId: r.result.receipt.receiverId,
                receiverName: [clinician.rank, clinician.displayName]
                  .filter(Boolean)
                  .join(' '),
                code: r.result.receipt.code,
              }),
            );
            setReceived(r);
          } catch (e) {
            const message =
              e instanceof TransferError
                ? e.message
                : 'The record could not be saved on this tablet.';
            native.send(encodeMessage({ t: 'error', message })).catch(() => {});
            setBt({ kind: 'failed', message });
          }
        }
      },
      onDisconnected: () =>
        setBt(s =>
          s.kind === 'receiving' || s.kind === 'offer' || s.kind === 'connected'
            ? {
                kind: 'failed',
                message:
                  'The Bluetooth connection was lost. Ask the sender to try again, or scan their QR.',
              }
            : s,
        ),
    });

    (async () => {
      try {
        if (!(await ensureBluetoothPermissions('receive'))) {
          setBt({
            kind: 'failed',
            message:
              'Bluetooth permission was not given. Allow “Nearby devices” for Jeewan, or scan the QR.',
          });
          return;
        }
        if (!(await native.requestEnable())) {
          setBt({
            kind: 'failed',
            message: 'Bluetooth is off. Turn it on to receive, or scan the QR.',
          });
          return;
        }
        await native.setDeviceName(
          receiverDeviceName(
            clinician.id,
            [clinician.rank, clinician.displayName].filter(Boolean).join(' '),
          ),
        );
        await native.startServer();
        if (!(await native.requestDiscoverable(DISCOVERABLE_SECONDS))) {
          setBt({
            kind: 'failed',
            message:
              'This tablet was not made visible. Allow it, or scan the QR instead.',
          });
          return;
        }
        let left = DISCOVERABLE_SECONDS;
        setBt({ kind: 'waiting', secondsLeft: left });
        countdown = setInterval(() => {
          left -= 1;
          setBt(s =>
            s.kind === 'waiting'
              ? { kind: 'waiting', secondsLeft: Math.max(0, left) }
              : s,
          );
          if (left <= 0 && countdown) {
            clearInterval(countdown);
          }
        }, 1000);
      } catch (e) {
        setBt({
          kind: 'failed',
          message:
            e instanceof Error ? e.message : 'Bluetooth could not start.',
        });
      }
    })();

    return () => {
      if (countdown) {
        clearInterval(countdown);
      }
      unsubscribe();
      native.stopServer().catch(() => {});
      native.disconnect().catch(() => {});
      native.restoreDeviceName().catch(() => {});
    };
  }, [mode, native, receive, clinician]);

  const startBluetooth = () => {
    if (!native) {
      setMode('bluetooth');
      setBt({
        kind: 'failed',
        message:
          'Bluetooth transfer needs the latest app build on this tablet. Scan the QR instead.',
      });
      return;
    }
    setBt({ kind: 'preparing' });
    setMode('bluetooth');
  };

  const answerOffer = (accept: boolean) => {
    if (!native || bt.kind !== 'offer') {
      return;
    }
    const transferId = bt.offer.transferId;
    native
      .send(
        encodeMessage(
          accept ? { t: 'accept', transferId } : { t: 'decline', transferId },
        ),
      )
      .catch(() => {});
    if (accept) {
      setBt({ kind: 'receiving' });
    } else {
      setBt({
        kind: 'failed',
        message: 'You declined the patient. Nothing was saved.',
      });
      native.disconnect().catch(() => {});
    }
  };

  const openPatient = async () => {
    if (!received) {
      return;
    }
    const p = received.patient;
    let found: PatientIdentity | null = null;
    for (const k of p.keys) {
      found =
        (await patients.findPatient(k.toLowerCase())) ??
        (await patients.findPatientByDisplayId(k));
      if (found) {
        break;
      }
    }
    onOpenPatient({
      ok: true,
      method: 'TRANSFER',
      patient: p,
      directoryPatient: found,
      receivedFrom: received.receivedFrom,
    });
  };

  /* ------------------------------ View ------------------------------ */

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader eyebrow={APP_BRAND} title="Receive Patient" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {!key ? (
          <Notice
            tone="error"
            title="NO UNIT TRANSFER KEY"
            message="This tablet cannot read transferred records yet. Sign in online once to download the unit key."
          />
        ) : received ? (
          <>
            <View style={styles.success}>
              <View style={styles.successIcon}>
                <Icon name="check" size={40} color={colors.onPrimary} />
              </View>
              <Text style={styles.successTitle} accessibilityRole="header">
                {received.result.duplicate
                  ? 'Already received'
                  : 'Patient received'}
              </Text>
              <Text style={styles.patientName}>
                {received.result.summary.patientLabel}
              </Text>
              <View style={styles.badges}>
                {received.result.summary.triage ? (
                  <TriagePill category={received.result.summary.triage} />
                ) : null}
                <EvacuationBadge
                  kind={
                    received.result.summary.handedOver
                      ? 'HANDED_OVER'
                      : 'NOT_HANDED_OVER'
                  }
                  label={
                    received.result.summary.handedOver
                      ? 'Evacuation handed over'
                      : 'Evacuation in progress'
                  }
                />
                <EvacuationBadge kind="RECEIVED_FROM" />
                {received.patient.temporary ? (
                  <StatusBadge
                    label="Field registration — not verified"
                    tone="warning"
                  />
                ) : null}
              </View>
              <Text style={styles.meta}>
                Initial care by {received.receivedFrom} · verified from tablet{' '}
                {received.result.summary.senderDevice}
              </Text>
            </View>

            <View style={styles.injuries}>
              <Text style={styles.injuriesTitle} accessibilityRole="header">
                Location of injury
              </Text>
              <BodyDiagram value={received.result.summary.injuryLocations} />
            </View>

            {received.channel === 'QR' ? (
              <View style={[styles.receipt, wide && styles.receiptWide]}>
                <QrCode
                  value={receiptQr(received.result.receipt)}
                  size={wide ? 240 : 220}
                  label="Receipt QR code for the sending tablet"
                />
                <View style={[styles.flex, styles.gap]}>
                  <Text style={styles.receiptTitle}>
                    Show this receipt to the sender
                  </Text>
                  <Text style={styles.lead}>
                    They scan it (or type your ID and code) to confirm the
                    patient reached you.
                  </Text>
                  <Text
                    style={styles.code}
                    accessibilityLabel={`Receipt code ${received.result.receipt.code
                      .split('')
                      .join(' ')}`}
                  >
                    {received.result.receipt.code}
                  </Text>
                  <Text style={styles.meta}>
                    Your ID: {received.result.receipt.receiverId}
                  </Text>
                </View>
              </View>
            ) : (
              <Notice
                tone="warning"
                title="Receipt sent"
                message="The sending tablet was told automatically that the record arrived and was verified. You can turn Bluetooth off now."
              />
            )}

            <View style={[styles.actions, wide && styles.actionsWide]}>
              <View style={wide ? styles.flex : undefined}>
                <PrimaryButton
                  title="Open patient record"
                  onPress={openPatient}
                  accessibilityHint="Shows the patient and their full history; continue care with Start Evacuation"
                />
              </View>
              <View style={wide ? styles.flex : undefined}>
                <SecondaryButton title="Done" onPress={onBack} />
              </View>
            </View>
          </>
        ) : mode === 'choose' ? (
          <>
            <Text style={styles.lead}>
              Ask the sending medic to open{' '}
              <Text style={styles.bold}>Hand over to next team</Text> on their
              tablet, then choose the same method.
            </Text>
            <View style={[styles.choices, wide && styles.choicesWide]}>
              <Pressable
                onPress={() => setMode('qr')}
                accessibilityRole="button"
                accessibilityLabel="Scan QR"
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="scan" size={40} color={colors.primary} />
                <Text style={styles.choiceTitle}>Scan QR</Text>
                <Text style={styles.choiceText}>
                  Point this camera at the QR on their screen.
                </Text>
              </Pressable>
              <Pressable
                onPress={startBluetooth}
                accessibilityRole="button"
                accessibilityLabel="Receive via Bluetooth"
                style={({ pressed }) => [
                  styles.choice,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="handover" size={40} color={colors.primary} />
                <Text style={styles.choiceTitle}>Receive via Bluetooth</Text>
                <Text style={styles.choiceText}>
                  Makes this tablet visible for {DISCOVERABLE_SECONDS} s to the
                  sending tablet.
                </Text>
              </Pressable>
            </View>
          </>
        ) : mode === 'qr' ? (
          <>
            <QrScannerView
              active={!importing}
              onCode={onScan}
              height={wide ? 420 : 340}
            />
            {importing ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.meta}>
                  Verifying and saving the record…
                </Text>
              </View>
            ) : progress ? (
              <View style={styles.progress} accessibilityLiveRegion="polite">
                <Text style={styles.progressText}>
                  Reading… {progress.have} of {progress.total} parts
                </Text>
                <View style={styles.bar}>
                  <View style={[styles.barFill, { flex: progress.have }]} />
                  <View
                    style={{
                      flex: Math.max(0, progress.total - progress.have),
                    }}
                  />
                </View>
              </View>
            ) : (
              <Text style={styles.meta}>
                Hold the camera 20–40 cm from the sending tablet’s screen.
              </Text>
            )}
            {scanError ? (
              <Notice tone="error" title="NOT RECEIVED" message={scanError} />
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
            ) : bt.kind === 'waiting' ? (
              <View style={styles.waiting}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.receiptTitle}>
                  Waiting for the sending tablet…
                </Text>
                <Text style={styles.lead}>
                  Visible as{' '}
                  <Text style={styles.bold}>
                    {clinician.id} ·{' '}
                    {[clinician.rank, clinician.displayName]
                      .filter(Boolean)
                      .join(' ')}
                  </Text>
                </Text>
                <Text style={styles.meta}>
                  {bt.secondsLeft > 0
                    ? `Visible for ${bt.secondsLeft} more seconds`
                    : 'No longer visible. Go back and choose Bluetooth again if the sender has not found you.'}
                </Text>
                <Notice
                  tone="warning"
                  title="When Android asks to pair"
                  message="Check that the 6-digit number matches the one on the sending tablet, then tap Pair."
                />
              </View>
            ) : bt.kind === 'connected' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.lead}>
                  Connected. Waiting for the patient details…
                </Text>
              </View>
            ) : bt.kind === 'offer' ? (
              <View style={styles.offer}>
                <Text style={styles.receiptTitle} accessibilityRole="header">
                  Accept this patient?
                </Text>
                <Text style={styles.lead}>
                  {[bt.offer.sender.rank, bt.offer.sender.name]
                    .filter(Boolean)
                    .join(' ')}{' '}
                  ({bt.offer.sender.id}) wants to send:
                </Text>
                <Text style={styles.patientName}>{bt.offer.patientLabel}</Text>
                {bt.offer.triage ? (
                  <TriagePill category={bt.offer.triage} />
                ) : null}
                <View style={[styles.actions, wide && styles.actionsWide]}>
                  <View style={wide ? styles.flex : undefined}>
                    <PrimaryButton
                      title="Accept"
                      onPress={() => answerOffer(true)}
                    />
                  </View>
                  <View style={wide ? styles.flex : undefined}>
                    <SecondaryButton
                      title="Decline"
                      onPress={() => answerOffer(false)}
                    />
                  </View>
                </View>
              </View>
            ) : bt.kind === 'receiving' ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.lead}>
                  Receiving and verifying the record…
                </Text>
              </View>
            ) : (
              <>
                <Notice
                  tone="error"
                  title="NOT RECEIVED"
                  message={bt.message}
                />
                <SecondaryButton
                  title="Try Bluetooth again"
                  onPress={() => {
                    setMode('choose');
                    setTimeout(startBluetooth, 0);
                  }}
                />
              </>
            )}
            <SecondaryButton
              title="Scan QR instead"
              onPress={() => setMode('qr')}
            />
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
  gap: { gap: spacing.sm },
  pressed: { backgroundColor: colors.surface },
  bold: { fontWeight: '700' },
  center: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  lead: { ...typography.body, color: colors.textPrimary },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
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

  progress: { gap: spacing.sm },
  progressText: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bar: {
    height: 12,
    flexDirection: 'row',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.divider,
  },
  barFill: { backgroundColor: colors.primary },

  waiting: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  offer: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
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
  injuries: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  injuriesTitle: {
    ...typography.label,
    fontSize: 18,
    color: colors.textPrimary,
  },

  receipt: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  receiptWide: { flexDirection: 'row', alignItems: 'center' },
  receiptTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  code: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: 8,
    color: colors.textPrimary,
  },

  actions: { gap: spacing.md, alignSelf: 'stretch' },
  actionsWide: { flexDirection: 'row' },
});
