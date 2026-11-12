/**
 * M01 — Medic Login (CASEVAC_DOCS/SCREEN_SPECIFICATIONS.md)
 * Demo authentication only; clearly labelled as such.
 */
import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInputInstance,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppHeader,
  BrandMark,
  FormField,
  Notice,
  PrimaryButton,
  StatusBadge,
} from '../components';
import { MOCK_CONNECTIVITY } from '../data/mockData';
import { demoSignIn } from '../services/demoAuth';
import { colors, fonts, spacing, typography } from '../theme/tokens';
import type { Clinician } from '../types';

interface LoginScreenProps {
  onSignIn: (clinician: Clinician) => void;
}

interface FieldErrors {
  clinicianId?: string;
  pin?: string;
}

const PIN_PATTERN = /^\d{4,6}$/;

export function LoginScreen({ onSignIn }: LoginScreenProps) {
  const [clinicianId, setClinicianId] = useState('');
  const [pin, setPin] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const pinRef = useRef<TextInputInstance>(null);

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!clinicianId.trim()) {
      errors.clinicianId = 'Enter your clinician ID.';
    }
    if (!pin) {
      errors.pin = 'Enter your PIN.';
    } else if (!PIN_PATTERN.test(pin)) {
      errors.pin = 'PIN must be 4–6 digits.';
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
    if (errors.clinicianId || errors.pin) {
      return;
    }

    setSubmitting(true);
    try {
      const clinician = await demoSignIn(clinicianId, pin);
      if (clinician) {
        setPin('');
        onSignIn(clinician);
      } else {
        setAuthError(
          'Clinician ID or PIN not recognised. Only the demo account is available.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow="CASEVAC"
        right={
          <StatusBadge
            label={MOCK_CONNECTIVITY === 'offline' ? 'Offline' : 'Online'}
          />
        }
      />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.intro}>
            <BrandMark />
            <View style={styles.introText}>
              <Text style={styles.title} accessibilityRole="header">
                Medic Sign In
              </Text>
              <Text style={styles.subtitle}>
                Digital Evacuation Program — casualty documentation from Point
                A to Point B.
              </Text>
            </View>
          </View>

          <Notice
            title="DEMO MODE"
            message="Credentials are not verified. Use fictional data only."
          />

          <View style={styles.form}>
            <FormField
              label="Clinician ID"
              value={clinicianId}
              onChangeText={text => {
                setClinicianId(text);
                if (fieldErrors.clinicianId) {
                  setFieldErrors(prev => ({ ...prev, clinicianId: undefined }));
                }
              }}
              placeholder="e.g. MED-DEMO-01"
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="next"
              onSubmitEditing={() => pinRef.current?.focus()}
              submitBehavior="submit"
              error={fieldErrors.clinicianId}
              editable={!submitting}
            />
            <FormField
              ref={pinRef}
              label="PIN"
              value={pin}
              onChangeText={text => {
                setPin(text.replace(/\D/g, ''));
                if (fieldErrors.pin) {
                  setFieldErrors(prev => ({ ...prev, pin: undefined }));
                }
              }}
              placeholder="4–6 digits"
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              helper="Demo account: MED-DEMO-01 · PIN 1234"
              error={fieldErrors.pin}
              editable={!submitting}
            />

            {authError ? (
              <Notice tone="error" title="SIGN-IN FAILED" message={authError} />
            ) : null}

            <PrimaryButton
              title="Sign in"
              onPress={handleSubmit}
              loading={submitting}
              accessibilityHint="Signs in with the demo account and opens the medic dashboard"
              style={styles.submit}
            />
          </View>

          <Text style={styles.help}>
            Trouble signing in? Contact your unit registrar.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Synthetic data only</Text>
        <Text style={[styles.footerText, styles.mono]}>v0.1.0-demo</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: spacing.xxl + spacing.sm,
    paddingBottom: spacing.xl,
    gap: 28,
  },
  intro: {
    gap: spacing.lg,
  },
  introText: {
    gap: 6,
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  form: {
    gap: 18,
  },
  submit: {
    marginTop: 6,
  },
  help: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  mono: {
    fontFamily: fonts.mono,
  },
});
