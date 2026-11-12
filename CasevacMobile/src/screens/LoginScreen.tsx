/**
 * M01 — Medic Login (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 *
 * Tablet landscape split layout (UI_DESIGN_GUIDELINES.md §5):
 *   left  — Jeevan branding and short instructions
 *   right — bordered login box: User ID, Password, Login, Forgot Password
 * Falls back to a stacked layout if the window is narrow or portrait.
 *
 * Demo authentication only (services/demoAuth.ts) and labelled as such.
 * Forgot Password is a placeholder until account recovery exists.
 */
import React, { useRef, useState } from 'react';
import {
  Alert,
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
import {
  BrandMark,
  EyeIcon,
  FormField,
  LockIcon,
  Notice,
  PrimaryButton,
  StatusBadge,
  UserIcon,
} from '../components';
import { MOCK_CONNECTIVITY } from '../data/mockData';
import { demoSignIn } from '../services/demoAuth';
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

const APP_NAME = 'Jeevan';

const INSTRUCTIONS = [
  'Sign in with the user ID and password issued by your unit registrar.',
  'Jeevan works without a network. Records are saved on this tablet.',
  'Demonstration build: use fictional casualty data only.',
];

interface LoginScreenProps {
  onSignIn: (clinician: Clinician) => void;
}

interface FieldErrors {
  userId?: string;
  password?: string;
}

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const { width, height } = useWindowDimensions();
  const split = width >= layout.splitBreakpoint && width > height;
  // Panels run edge to edge; insets (status bar, cutout) pad their content.
  const insets = useSafeAreaInsets();

  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const passwordRef = useRef<TextInputInstance>(null);

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
      const clinician = await demoSignIn(userId, password);
      if (clinician) {
        setPassword('');
        onSignIn(clinician);
      } else {
        setAuthError('User ID or password not recognised.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert(
      'Forgot password',
      'Password reset is not available yet. Contact your unit registrar.',
    );
  };

  const connectivity = MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online';

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.page, split && styles.pageSplit]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Left: branding and instructions */}
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
            <View style={styles.brandMain}>
              <View style={styles.brandTop}>
                <View style={styles.brandRow}>
                  <BrandMark />
                  <Text style={styles.brandName} accessibilityRole="header">
                    {APP_NAME.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.tagline}>
                  Casualty evacuation records, from point of injury to medical
                  handover.
                </Text>
              </View>

              <View style={styles.instructions}>
                <Text style={styles.instructionsTitle}>BEFORE YOU SIGN IN</Text>
                {INSTRUCTIONS.map((text, index) => (
                  <View key={text} style={styles.instructionRow}>
                    <Text style={styles.instructionNumber}>{index + 1}</Text>
                    <Text style={styles.instructionText}>{text}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={[styles.meta, styles.mono]}>v0.1.0-demo</Text>
          </View>

          {/* Right: login form */}
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
              <StatusBadge label={connectivity} />
            </View>

            <View style={styles.formCenter}>
              <View style={styles.formBox}>
                <Text style={styles.formTitle} accessibilityRole="header">
                  Medic Login
                </Text>

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
                />

                <Pressable
                  onPress={handleForgotPassword}
                  accessibilityRole="button"
                  accessibilityLabel="Forgot Password?"
                  accessibilityHint="Password reset is not available yet"
                  style={({ pressed }) => [
                    styles.forgot,
                    pressed && styles.forgotPressed,
                  ]}
                >
                  <Text style={styles.forgotText}>Forgot Password?</Text>
                </Pressable>
              </View>

              <Text style={styles.demo}>
                Demo mode · login not verified · MED-DEMO-01 / 1234
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const PANEL_PADDING = layout.contentPadding + spacing.sm;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  page: {
    flexGrow: 1,
  },
  pageSplit: {
    flexDirection: 'row',
  },

  /* Branding panel */
  brandPanel: {
    paddingRight: PANEL_PADDING,
    gap: spacing.xl,
    backgroundColor: colors.surface,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.border,
  },
  brandPanelSplit: {
    width: '42%',
    maxWidth: 560,
    borderBottomWidth: 0,
    borderRightWidth: layout.borderWidth,
    borderRightColor: colors.border,
  },
  brandMain: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  brandTop: {
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  brandName: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: 3,
    color: colors.textPrimary,
  },
  tagline: {
    ...typography.body,
    fontSize: 18,
    lineHeight: 26,
    color: colors.textSecondary,
    maxWidth: 440,
  },
  instructions: {
    padding: layout.cardPadding,
    gap: spacing.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  instructionsTitle: {
    ...typography.sectionTitle,
    color: colors.textSecondary,
  },
  instructionRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  instructionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    textAlign: 'center',
    textAlignVertical: 'center',
    ...typography.label,
    lineHeight: 26,
    color: colors.textPrimary,
  },
  instructionText: {
    ...typography.body,
    flex: 1,
    color: colors.textPrimary,
  },
  meta: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  mono: {
    fontFamily: fonts.mono,
  },

  /* Form panel */
  formPanel: {
    paddingLeft: layout.contentPadding,
    gap: spacing.lg,
    alignItems: 'center',
  },
  formPanelSplit: {
    flex: 1,
  },
  formCenter: {
    flexGrow: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  statusRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  formBox: {
    width: '100%',
    maxWidth: 480,
    padding: spacing.xl,
    gap: 20,
    borderWidth: layout.borderWidth,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
  },
  formTitle: {
    ...typography.title,
    color: colors.textPrimary,
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
  demo: {
    ...typography.helper,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
