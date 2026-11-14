/**
 * Pieces for tablet-to-tablet handover:
 *   QrCode        — draws a QR code with react-native-svg (black on white,
 *                   with the quiet zone scanners need)
 *   QrScannerView — camera that reads QR codes, with the same permission
 *                   handling as the wristband scanner
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import Svg, { Path, Rect } from 'react-native-svg';
import { create as createQr } from 'qrcode';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Notice } from './Notice';
import { SecondaryButton } from './SecondaryButton';

const QUIET = 4;

export function QrCode({
  value,
  size,
  label,
}: {
  value: string;
  size: number;
  /** Spoken description (the code itself is not readable aloud). */
  label: string;
}) {
  const { path, count } = useMemo(() => {
    const qr = createQr(value, { errorCorrectionLevel: 'M' });
    const n = qr.modules.size;
    let d = '';
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.modules.data[y * n + x]) {
          d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
        }
      }
    }
    return { path: d, count: n + QUIET * 2 };
  }, [value]);
  return (
    <View
      style={[styles.qrBox, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${count} ${count}`}>
        <Rect x={0} y={0} width={count} height={count} fill="#FFFFFF" />
        <Path d={path} fill="#000000" />
      </Svg>
    </View>
  );
}

type Permission = 'checking' | 'granted' | 'denied' | 'blocked';

async function cameraPermission(
  request: boolean,
): Promise<Exclude<Permission, 'checking'>> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }
  const p = PermissionsAndroid.PERMISSIONS.CAMERA;
  if (await PermissionsAndroid.check(p)) {
    return 'granted';
  }
  if (!request) {
    return 'denied';
  }
  const outcome = await PermissionsAndroid.request(p, {
    title: 'Camera access',
    message: 'Jeewan uses the camera to read QR codes from another tablet.',
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

/**
 * Camera that reports every QR it reads (each distinct text once per
 * second — the sending tablet loops its frames).
 */
export function QrScannerView({
  onCode,
  active,
  height = 320,
}: {
  onCode: (text: string) => void;
  active: boolean;
  height?: number;
}) {
  const [permission, setPermission] = useState<Permission>('checking');
  const [cameraError, setCameraError] = useState(false);
  const seen = useRef(new Map<string, number>());

  useEffect(() => {
    let cancelled = false;
    cameraPermission(true).then(p => !cancelled && setPermission(p));
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') {
        cameraPermission(false).then(p => {
          if (!cancelled && p === 'granted') {
            setPermission('granted');
          }
        });
      }
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const handle = (text: string | undefined) => {
    if (!text) {
      return;
    }
    const now = Date.now();
    const last = seen.current.get(text) ?? 0;
    if (now - last < 1000) {
      return;
    }
    seen.current.set(text, now);
    onCode(text);
  };

  if (permission === 'checking') {
    return <Text style={styles.status}>Checking camera permission…</Text>;
  }
  if (permission !== 'granted') {
    return (
      <View style={styles.gap}>
        <Notice
          tone="warning"
          title="Camera permission needed"
          message={
            permission === 'blocked'
              ? 'Camera access is turned off for Jeewan. Enable it in Android settings to read the QR code.'
              : 'Allow camera access to read the QR code on the other tablet.'
          }
        />
        <SecondaryButton
          title={permission === 'blocked' ? 'Open settings' : 'Allow camera'}
          onPress={() =>
            permission === 'blocked'
              ? Linking.openSettings()
              : cameraPermission(true).then(setPermission)
          }
        />
      </View>
    );
  }
  if (cameraError) {
    return (
      <Notice
        tone="error"
        title="Camera unavailable"
        message="The camera could not start. Close other camera apps and try again, or use Bluetooth."
      />
    );
  }
  return (
    <View style={[styles.camera, { height }]}>
      <Camera
        style={StyleSheet.absoluteFill}
        scanBarcode={active}
        allowedBarcodeTypes={['qr']}
        onReadCode={event => handle(event.nativeEvent.codeStringValue)}
        onError={() => setCameraError(true)}
        testID="transfer-camera"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  qrBox: {
    alignSelf: 'center',
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  camera: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  status: { ...typography.body, color: colors.textSecondary, padding: spacing.md },
  gap: { gap: spacing.md },
});
