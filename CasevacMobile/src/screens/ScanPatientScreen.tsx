/**
 * M03 — Scan Patient QR (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 *
 * Reads the wristband QR with the camera and verifies it entirely on this
 * phone (signature + local revocation/identity directory). Only a verified
 * credential navigates onward; every failure stays on this screen with a
 * plain-language reason and never shows another person's profile.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppHeader,
  GlyphIcon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from '../components';
import { MOCK_CONNECTIVITY } from '../data/mockData';
import {
  getBundledIdentityDirectory,
  getBundledTrustStore,
} from '../services/identity/bundledDemoProvisioning';
import type { DirectoryInfo } from '../services/identity/types';
import { describeFailure } from '../services/qr/identificationMessages';
import {
  identifyPatient,
  type FailedIdentification,
  type IdentificationDeps,
  type VerifiedIdentification,
} from '../services/qr/identifyPatient';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { formatDateTime } from '../utils/format';

interface ScanPatientScreenProps {
  onBack: () => void;
  onIdentified: (result: VerifiedIdentification) => void;
  /** Injected in tests; defaults to the bundled demo provisioning. */
  deps?: IdentificationDeps;
}

type Phase =
  | { kind: 'checking-permission' }
  | { kind: 'permission-denied'; blocked: boolean }
  | { kind: 'scanning' }
  | { kind: 'verifying' }
  | { kind: 'failed'; result: FailedIdentification }
  | { kind: 'camera-error' };

/** After "Scan again", ignore the same code for a moment so it isn't re-read instantly. */
const SAME_CODE_COOLDOWN_MS = 2500;

async function checkCameraPermission(
  request: boolean,
): Promise<'granted' | 'denied' | 'blocked'> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }
  const permission = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(permission)) {
    return 'granted';
  }
  if (!request) {
    return 'denied';
  }
  const outcome = await PermissionsAndroid.request(permission, {
    title: 'Camera access',
    message: 'CASEVAC uses the camera only to read patient wristband QR codes.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (outcome === PermissionsAndroid.RESULTS.GRANTED) {
    return 'granted';
  }
  return outcome === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ? 'blocked'
    : 'denied';
}

export function ScanPatientScreen({
  onBack,
  onIdentified,
  deps,
}: ScanPatientScreenProps) {
  const services = useMemo<IdentificationDeps>(
    () =>
      deps ?? {
        trustStore: getBundledTrustStore(),
        directory: getBundledIdentityDirectory(),
      },
    [deps],
  );
  const [phase, setPhase] = useState<Phase>({ kind: 'checking-permission' });
  const [torchOn, setTorchOn] = useState(false);
  const [provisioning, setProvisioning] = useState<{
    keyIds: string[];
    directory: DirectoryInfo;
  } | null>(null);

  const mounted = useRef(true);
  const busy = useRef(false);
  const ignore = useRef<{ value: string; until: number } | null>(null);
  const lastValue = useRef<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const resolvePermission = useCallback(async (request: boolean) => {
    try {
      const status = await checkCameraPermission(request);
      if (!mounted.current) {
        return;
      }
      setPhase(
        status === 'granted'
          ? { kind: 'scanning' }
          : { kind: 'permission-denied', blocked: status === 'blocked' },
      );
    } catch {
      if (mounted.current) {
        setPhase({ kind: 'permission-denied', blocked: false });
      }
    }
  }, []);

  useEffect(() => {
    resolvePermission(true);
  }, [resolvePermission]);

  // Returning from system settings: re-check without prompting again.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && phase.kind === 'permission-denied') {
        resolvePermission(false);
      }
    });
    return () => sub.remove();
  }, [phase.kind, resolvePermission]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([services.trustStore.listKeyIds(), services.directory.info()])
      .then(([keyIds, directory]) => {
        if (!cancelled) {
          setProvisioning({ keyIds, directory });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [services]);

  const handleCode = useCallback(
    async (value: string) => {
      if (busy.current) {
        return;
      }
      const skip = ignore.current;
      if (skip && skip.value === value && Date.now() < skip.until) {
        return;
      }
      busy.current = true;
      lastValue.current = value;
      setPhase({ kind: 'verifying' });
      let result;
      try {
        result = await identifyPatient(value, services);
      } catch {
        result = { ok: false as const, failure: 'MALFORMED' as const };
      }
      if (!mounted.current) {
        return;
      }
      if (result.ok) {
        // Stay busy: this screen is replaced by Patient Identification.
        onIdentified(result);
      } else {
        setTorchOn(false);
        setPhase({ kind: 'failed', result });
      }
    },
    [onIdentified, services],
  );

  const scanAgain = () => {
    if (lastValue.current) {
      ignore.current = {
        value: lastValue.current,
        until: Date.now() + SAME_CODE_COOLDOWN_MS,
      };
    }
    busy.current = false;
    setPhase({ kind: 'scanning' });
  };

  const showUnknownCasualty = () =>
    Alert.alert(
      'Unknown Casualty — coming later',
      'Screen M05 is not built yet in this demo build. No data has been changed.',
    );

  const cameraActive = phase.kind === 'scanning' || phase.kind === 'verifying';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow="CASEVAC"
        title="Scan Patient QR"
        onBack={onBack}
        right={
          <StatusBadge
            label={MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online'}
          />
        }
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {cameraActive ? (
          <>
            <View style={styles.cameraBox}>
              <Camera
                style={StyleSheet.absoluteFill}
                scanBarcode={phase.kind === 'scanning'}
                allowedBarcodeTypes={['qr']}
                onReadCode={event =>
                  handleCode(event.nativeEvent.codeStringValue)
                }
                onError={() => {
                  busy.current = true;
                  setPhase({ kind: 'camera-error' });
                }}
                torchMode={torchOn ? 'on' : 'off'}
                testID="qr-camera"
              />
              <View
                style={styles.viewfinder}
                pointerEvents="none"
                accessible={false}
                importantForAccessibility="no-hide-descendants"
              >
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              {phase.kind === 'verifying' ? (
                <View style={styles.verifyingOverlay}>
                  <Text style={styles.verifyingText}>Verifying credential…</Text>
                </View>
              ) : null}
            </View>
            <Text
              style={styles.status}
              accessibilityLiveRegion="polite"
              accessibilityRole="text"
            >
              {phase.kind === 'verifying'
                ? 'Verifying credential on this phone…'
                : 'Point the camera at the wristband QR code.'}
            </Text>
            <SecondaryButton
              title={torchOn ? 'Turn torch off' : 'Turn torch on'}
              onPress={() => setTorchOn(on => !on)}
              disabled={phase.kind !== 'scanning'}
            />
          </>
        ) : null}

        {phase.kind === 'checking-permission' ? (
          <Text style={styles.status}>Checking camera permission…</Text>
        ) : null}

        {phase.kind === 'permission-denied' ? (
          <View style={styles.block}>
            <Notice
              tone="warning"
              title="Camera permission needed"
              message={
                phase.blocked
                  ? 'Camera access is turned off for CASEVAC. Enable it in Android settings to scan wristbands.'
                  : 'CASEVAC needs the camera to read wristband QR codes. Nothing is recorded or stored from the camera.'
              }
            />
            {phase.blocked ? (
              <PrimaryButton
                title="Open settings"
                onPress={() => Linking.openSettings()}
              />
            ) : (
              <PrimaryButton
                title="Allow camera"
                onPress={() => resolvePermission(true)}
              />
            )}
          </View>
        ) : null}

        {phase.kind === 'camera-error' ? (
          <View style={styles.block}>
            <Notice
              tone="error"
              title="Camera unavailable"
              message="The camera could not be started. Close other camera apps and try again."
            />
            <PrimaryButton title="Try again" onPress={scanAgain} />
          </View>
        ) : null}

        {phase.kind === 'failed' ? (
          <View style={styles.block}>
            <Notice tone="error" {...describeFailure(phase.result)} />
            <PrimaryButton title="Scan again" onPress={scanAgain} />
          </View>
        ) : null}

        <SecondaryButton
          title="Unknown Casualty"
          icon={<GlyphIcon glyph="+" />}
          onPress={showUnknownCasualty}
          accessibilityHint="Start care without a wristband"
        />

        <View style={styles.infoPanel}>
          <Text style={styles.infoTitle}>VERIFICATION ON THIS PHONE</Text>
          <Text style={styles.infoText}>
            Trusted issuer keys:{' '}
            {provisioning
              ? provisioning.keyIds.length > 0
                ? provisioning.keyIds.join(', ')
                : 'none provisioned'
              : '…'}
          </Text>
          <Text style={styles.infoText}>
            Identity directory (demo):{' '}
            {provisioning
              ? provisioning.directory.generatedAt
                ? `${provisioning.directory.patientCount} patients, updated ${formatDateTime(
                    provisioning.directory.generatedAt,
                  )}`
                : 'not provisioned'
              : '…'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const CORNER = 28;
const CORNER_WIDTH = 3;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  cameraBox: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 420,
    alignSelf: 'center',
    backgroundColor: '#000000',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  viewfinder: {
    position: 'absolute',
    top: '18%',
    left: '18%',
    right: '18%',
    bottom: '18%',
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#FFFFFF',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
  },
  verifyingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyingText: {
    ...typography.body,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  status: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  block: {
    gap: spacing.md,
  },
  infoPanel: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    gap: spacing.xs,
  },
  infoTitle: {
    ...typography.sectionTitle,
    color: colors.textSecondary,
  },
  infoText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
