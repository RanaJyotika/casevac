/**
 * M01 — Medic Login (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 *
 * Tablet landscape split layout (UI_DESIGN_GUIDELINES.md §5):
 *   left  — Jeevan branding over a radar sweep and bundled mountain scene
 *   right — floating login card: User ID, Password, station, Login,
 *           Forgot Password, Emergency Record
 * Falls back to a stacked layout if the window is narrow or portrait.
 * The scene image is packed into the app so it still shows offline.
 *
 * Sign-in (services/auth/signIn.ts): credentials are issued on the admin
 * dashboard. The first sign-in must be online; the tablet then saves a hashed
 * copy so later sign-ins work offline. Emergency Record opens the app without
 * signing in (forgotten password / no network), marked as unverified.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { loginMountainScene } from '../assets/login';
import {
  BrandMark,
  CaduceusMark,
  EyeIcon,
  FormField,
  Icon,
  LockIcon,
  Notice,
  PrimaryButton,
  UserIcon,
} from '../components';
import { RadarBackdrop } from '../components/RadarBackdrop';
import {
  getDefaultAuthDeps,
  signIn,
  startEmergencySession,
  syncSavedSignIns,
  type AuthDeps,
} from '../services/auth/signIn';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  touchTarget,
  typography,
} from '../theme/tokens';
import type { Clinician } from '../types';
import { APP_FULL_NAME, APP_NAME } from '../brand';
import {
  DEFAULT_STATION,
  LOGIN_STATIONS,
  type LoginStation,
} from '../services/auth/station';

// The app's name (Jeevan) lives in src/brand.ts.

interface LoginScreenProps {
  onSignIn: (clinician: Clinician) => void;
  /** Emergency Record: opens the app without signing in. */
  onEmergencyAccess: (session: Clinician) => void;
  /** Injected in tests; defaults to the dashboard server + tablet storage. */
  authDeps?: AuthDeps;
}

type Connectivity = 'checking' | 'online' | 'offline';

interface FieldErrors {
  userId?: string;
  password?: string;
}

export function LoginScreen({
  onSignIn,
  onEmergencyAccess,
  authDeps,
}: LoginScreenProps) {
  const { width, height } = useWindowDimensions();
  const split = width >= layout.splitBreakpoint && width > height;
  // Panels run edge to edge; insets (status bar, cutout) pad their content.
  const insets = useSafeAreaInsets();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [station, setStation] = useState<LoginStation>(DEFAULT_STATION);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);
  const [connectivity, setConnectivity] = useState<Connectivity>('checking');
  const deps = authDeps ?? getDefaultAuthDeps();

  // Check the base server once; when reachable, report offline sign-ins and
  // drop saved copies the dashboard has revoked.
  useEffect(() => {
    let cancelled = false;
    deps.server.isReachable().then(reachable => {
      if (cancelled) {
        return;
      }
      setConnectivity(reachable ? 'online' : 'offline');
      if (reachable) {
        syncSavedSignIns(deps);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per mount
  }, []);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!userId.trim()) {
      errors.userId = 'Enter your user ID.';
    }
    if (!password) {
      errors.password = 'Enter your password.';
    }
    return errors;
  };

  const handleSubmit = async () => {
    if (submitting) {
      return;
    }
    setAuthError(null);
    const errors = validate();
    setFieldErrors(errors);
    if (errors.userId || errors.password) {
      return;
    }

    setSubmitting(true);
    try {
      const result = await signIn(userId, password, deps, station);
      if (result.ok) {
        setPassword('');
        if (result.clinician.signInMode === 'online') {
          setConnectivity('online');
        }
        onSignIn(result.clinician);
      } else {
        setAuthError(result.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot password',
      'Ask your unit registrar to reset your password on the admin dashboard, then sign in once while online at base camp.\n\nIf a casualty needs care now, use Emergency Record.',
    );
  };

  const handleEmergency = () => {
    Alert.alert(
      'Start emergency record?',
      `Opens ${APP_NAME} without signing in. Records are marked as unverified emergency entries and this access is logged on the tablet.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start emergency record',
          style: 'destructive',
          onPress: async () => {
            setPassword('');
            onEmergencyAccess(await startEmergencySession(undefined, station));
          },
        },
      ],
    );
  };

  const connectivityLabel =
    connectivity === 'checking'
      ? 'Checking…'
      : connectivity === 'online'
      ? 'Online'
      : 'Offline';

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView
  style={styles.flex}
  contentContainerStyle={[
    styles.page,
    split && styles.pageSplit,
    {minHeight: height},
  ]}
  keyboardShouldPersistTaps="handled"
>
  {/* Full-screen background */}
  <Image
    source={loginMountainScene}
    resizeMode="cover"
    style={styles.fullScreenScene}
    accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants"
  />

  <SceneScrim />
          {/* Left: radar, brand, bundled mountain scene (offline-safe). */}
          <View
            style={[
              styles.brandPanel,
              split && styles.brandPanelSplit,
              {
                paddingTop: insets.top + PANEL_PADDING,
                paddingBottom: (split ? insets.bottom : 0) + PANEL_PADDING,
                paddingLeft: insets.left + PANEL_PADDING,
              },
            ]}
          >
            
            <View
  pointerEvents="none"
  style={styles.radarContainer}>
  <RadarBackdrop
    active={submitting}
    anchor="topLeft"
  />
</View>
            <View style={styles.brandMain}>
              <View style={styles.brandTop}>
                <View style={styles.brandRow}>
                  <BrandMark />
                  <View style={styles.brandDivider} />
                  <Text style={styles.brandName} accessibilityRole="header">
                    {APP_NAME.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.fullName}>{APP_FULL_NAME}</Text>
                
              </View>
            </View>

            <Text style={[styles.meta, styles.mono]}>v0.1.0-demo</Text>
          </View>

          {/* Right: floating login card */}
          <View
            style={[
              styles.formPanel,
              split && styles.formPanelSplit,
              {
                paddingTop: (split ? insets.top : 0) + layout.contentPadding,
                paddingBottom: insets.bottom + layout.contentPadding,
                paddingRight: insets.right + layout.contentPadding,
              },
            ]}
          >
            <View style={styles.statusRow}>
              <View
                accessible
                accessibilityLabel={`Status: ${connectivityLabel}`}
                style={styles.connectivityChip}
              >
                <Icon
                  name={connectivity === 'online' ? 'wifi' : 'wifiOff'}
                  size={14}
                  color={colors.textMuted}
                />
                <Text style={styles.connectivityLabel}>
                  {connectivityLabel}
                </Text>
              </View>
            </View>

            <View style={styles.formCenter}>
              <View style={styles.formBox}>
                <View style={styles.formHeader}>
                  <CaduceusMark />
                  <View style={styles.formHeaderDivider} />
                  <Text style={styles.formTitle} accessibilityRole="header">
                    Medic Login
                  </Text>
                </View>

                <FormField
                  label="User ID"
                  value={userId}
                  onChangeText={text => {
                    setUserId(text);
                    if (fieldErrors.userId) {
                      setFieldErrors(prev => ({ ...prev, userId: undefined }));
                    }
                  }}
                  placeholder="Enter User ID"
                  leading={<UserIcon />}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  submitBehavior="submit"
                  error={fieldErrors.userId}
                  editable={!submitting}
                />
                <FormField
                  ref={passwordRef}
                  label="Password"
                  value={password}
                  onChangeText={text => {
                    setPassword(text);
                    if (fieldErrors.password) {
                      setFieldErrors(prev => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  placeholder="Enter Password"
                  leading={<LockIcon />}
                  trailing={
                    <Pressable
                      onPress={() => setPasswordVisible(v => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        passwordVisible ? 'Hide password' : 'Show password'
                      }
                      style={({ pressed }) => [
                        styles.eyeButton,
                        pressed && styles.eyeButtonPressed,
                      ]}
                    >
                      <EyeIcon crossed={passwordVisible} />
                    </Pressable>
                  }
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  error={fieldErrors.password}
                  editable={!submitting}
                />

                <View style={styles.stationField}>
                  <Text style={styles.stationLabel} nativeID="login-station">
                    Login Station
                  </Text>
                  <View
                    style={styles.stationRow}
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Login station"
                  >
                    {LOGIN_STATIONS.map(s => {
                      const selected = station === s.value;
                      return (
                        <Pressable
                          key={s.value}
                          onPress={() => {
                            setStation(s.value);
                            setAuthError(null);
                          }}
                          disabled={submitting}
                          accessibilityRole="radio"
                          accessibilityLabel={`${s.label}, ${s.meaning}`}
                          accessibilityState={{ selected, checked: selected }}
                          style={({ pressed }) => [
                            styles.station,
                            selected && styles.stationOn,
                            pressed && !selected && styles.eyeButtonPressed,
                          ]}
                        >
                          <View
                            style={[styles.radio, selected && styles.radioOn]}
                          >
                            {selected ? <View style={styles.radioDot} /> : null}
                          </View>
                          <View style={styles.stationText}>
                            <Text style={styles.stationCode}>{s.label}</Text>
                            <Text style={styles.stationMeaning}>
                              {s.meaning}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {authError ? (
                  <Notice
                    tone="error"
                    title="LOGIN FAILED"
                    message={authError}
                  />
                ) : null}

                <PrimaryButton
                  title="Login"
                  onPress={handleSubmit}
                  loading={submitting}
                  accessibilityHint="Signs in and opens the medic dashboard"
                  style={styles.loginButton}
                />

                <Pressable
                  onPress={handleForgotPassword}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password?"
                  accessibilityHint="Explains how to get a new password"
                  style={({ pressed }) => [
                    styles.forgot,
                    pressed && styles.forgotPressed,
                  ]}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>

                <Pressable
                  onPress={handleEmergency}
                  disabled={submitting}
                  accessibilityRole="button"
                  accessibilityLabel="Emergency Record"
                  accessibilityHint="Start a casualty record without signing in"
                  style={({ pressed }) => [
                    styles.emergencyButton,
                    pressed && styles.emergencyButtonPressed,
                  ]}
                >
                  <Icon name="plus" size={18} color={colors.error} />
                  <Text style={styles.emergencyText}>Emergency Record</Text>
                </Pressable>
              </View>

              <Text style={styles.demo}>
                Demo mode · login not verified · MED-DEMO-01 / 1234 (empty
                tablet) · MED-DEMO-02 / 1234 (with sample casualties)
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Light wash so brand text stays readable over the bundled scene. */
function SceneScrim() {
  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient
          id="loginSceneScrim"
          x1="0"
          y1="0"
          x2="0"
          y2="1">
          <Stop
            offset="0"
            stopColor="#FFFFFF"
            stopOpacity="0.25"
          />
          <Stop
            offset="0.5"
            stopColor="#FFFFFF"
            stopOpacity="0.20"
          />
          <Stop
            offset="1"
            stopColor="#FFFFFF"
            stopOpacity="0.14"
          />
        </LinearGradient>
      </Defs>

      <Rect
        width="100"
        height="100"
        fill="url(#loginSceneScrim)"
      />
    </Svg>
  );
}

const PANEL_PADDING = layout.contentPadding + spacing.sm;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  flex: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
    position: 'relative',
  },
  
  pageSplit: {
    flexDirection: 'row',
  },

  /* Branding panel */
  brandPanel: {
    paddingRight: PANEL_PADDING,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    minHeight: 280,
    position: 'relative',
  },
  
  brandPanelSplit: {
    width: '56%',
    flex: 0,
  },
  radarContainer: {
    position: 'absolute',
    width: 440,
    height: 440,
    left: '50%',
    top: '50%',
    transform: [
      {translateX: -220},
      {translateY: -220},
    ],
    opacity: 0.28,
    overflow: 'visible',
  },
  
  fullScreenScene: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
  },
  brandMain: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  
  brandTop: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    width: '100%',
  },
  
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  
  brandDivider: {
    width: 2,
    height: 40,
    backgroundColor: '#081F49',
    opacity: 0.85,
  },
  
  brandName: {
    fontSize: 46,
    lineHeight: 54,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#081F49',
    textAlign: 'center',
  },
  
  fullName: {
    fontSize: 20,
    lineHeight: 29,
    fontWeight: '700',
    color: '#123366',
    textAlign: 'center',
    maxWidth: 460,
  },

  
  meta: {
    ...typography.helper,
    color: colors.textSecondary,
    zIndex: 1,
  },
  mono: {
    fontFamily: fonts.mono,
  },

  /* Form panel */
  formPanel: {
    paddingLeft: 24,
    paddingRight: 24,
    gap: 12,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  
  formPanelSplit: {
    width: '44%',
    flex: 0,
  },
  formCenter: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  statusRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  connectivityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectivityLabel: {
    ...typography.helper,
    fontWeight: '600',
    color: colors.textMuted,
  },
  formBox: {
    width: '100%',
    maxWidth: 480,
  
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 22,
    gap: 14,
  
    borderWidth: 1,
    borderColor: '#E1E7F0',
  
    shadowColor: '#102C63',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  formHeaderDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: colors.border,
  },
  formTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  loginButton: {
    borderRadius: 12,
  },
  eyeButton: {
    width: touchTarget,
    height: layout.inputHeight - 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  eyeButtonPressed: {
    backgroundColor: colors.surface,
  },
  stationField: {
    gap: spacing.sm,
  },
  stationLabel: {
    ...typography.label,
    color: colors.textPrimary,
  },
  stationRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  station: {
    flex: 1,
    minHeight: touchTarget + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  stationOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  stationText: {
    flex: 1,
    minWidth: 0,
  },
  stationCode: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stationMeaning: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  forgot: {
    alignSelf: 'center',
    minHeight: touchTarget,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  forgotPressed: {
    backgroundColor: colors.surface,
  },
  forgotText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  emergencyButton: {
    minHeight: layout.buttonHeight,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.error,
    backgroundColor: colors.errorSurface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  emergencyButtonPressed: {
    backgroundColor: colors.errorBorder,
  },
  emergencyText: {
    ...typography.button,
    color: colors.error,
    letterSpacing: 0.5,
  },
  demo: {
    ...typography.helper,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
