/**
 * Register New Patient — field registration on this tablet.
 *
 * Used when a casualty has no wristband, the scanned wristband / typed ID has
 * no details on this tablet, or the medic chooses to register someone else.
 * Every field is optional so an unconscious, unidentified casualty can be
 * registered in seconds; choices are large tap targets (gloves).
 * Saved locally with a temporary ID (TEMP-…); marked "not verified".
 */
import React, { useState } from 'react';
import {
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
  FormField,
  Notice,
  PillToggle,
  PrimaryButton,
  SecondaryButton,
} from '../components';
import type { BloodGroup, RhFactor, Sex } from '../services/identity/types';
import {
  getFieldRegistry,
  validateFieldPatient,
  type FieldLink,
  type FieldPatient,
  type FieldPatientInput,
  type FieldRegistry,
} from '../services/patients/fieldRegistry';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';

interface RegisterPatientScreenProps {
  /** User ID of the signed-in medic (recorded on the registration). */
  registeredBy: string;
  /** What was scanned or typed before choosing to register, if anything. */
  link: FieldLink;
  onCancel: () => void;
  onRegistered: (patient: FieldPatient) => void;
  /** Injected in tests; defaults to the tablet's registry. */
  registry?: FieldRegistry;
}

type Errors = Partial<Record<keyof FieldPatientInput, string>>;

const EMPTY: FieldPatientInput = {
  fullName: '',
  rank: '',
  age: '',
  sex: 'NOT_RECORDED',
  bloodGroup: 'UNKNOWN',
  rhFactor: 'UNKNOWN',
  unit: '',
};

function Choice({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.choice}>
      <Text style={styles.choiceLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function RegisterPatientScreen({
  registeredBy,
  link,
  onCancel,
  onRegistered,
  registry,
}: RegisterPatientScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [input, setInput] = useState<FieldPatientInput>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof FieldPatientInput>(
    key: K,
    value: FieldPatientInput[K],
  ) => {
    setInput(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const save = async () => {
    if (saving) {
      return;
    }
    const check = validateFieldPatient(input);
    if (!check.ok) {
      setErrors(check.errors);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const patient = await (registry ?? getFieldRegistry()).register(
        input,
        registeredBy,
        link,
      );
      onRegistered(patient);
    } catch {
      setSaveError('The patient could not be saved on this tablet. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const linkNote = link.credentialId
    ? 'The scanned wristband is genuine but has no details on this tablet. It will be kept with this registration.'
    : link.enteredId
    ? `No patient with ID ${link.enteredId} on this tablet. The ID you typed will be kept with this registration.`
    : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Register New Patient"
        onBack={onCancel}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Notice
          tone="warning"
          title="Saved on this tablet only — not verified"
          message="Fill in what you know; every field can be left blank for an unidentified casualty. A temporary ID is created so care can start now."
        />
        {linkNote ? (
          <Notice tone="warning" title="Wristband / ID" message={linkNote} />
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            Patient details
          </Text>
          <View style={[styles.grid, wide && styles.gridWide]}>
            <View style={wide ? styles.cellWide : undefined}>
              <FormField
                label="Full name"
                value={input.fullName}
                onChangeText={v => set('fullName', v)}
                placeholder="Leave blank if unknown"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={100}
                error={errors.fullName}
              />
            </View>
            <View style={wide ? styles.cell : undefined}>
              <FormField
                label="Rank"
                value={input.rank}
                onChangeText={v => set('rank', v)}
                placeholder="e.g. Sepoy"
                autoCapitalize="words"
                maxLength={40}
                error={errors.rank}
              />
            </View>
            <View style={wide ? styles.cellNarrow : undefined}>
              <FormField
                label="Age (years)"
                value={input.age}
                onChangeText={v => set('age', v.replace(/[^0-9]/g, ''))}
                placeholder="e.g. 27"
                keyboardType="number-pad"
                maxLength={3}
                error={errors.age}
              />
            </View>
            <View style={wide ? styles.cellWide : undefined}>
              <FormField
                label="Unit"
                value={input.unit}
                onChangeText={v => set('unit', v)}
                placeholder="e.g. 2 Demo Rifles"
                autoCapitalize="words"
                maxLength={80}
                error={errors.unit}
              />
            </View>
          </View>

          <View style={[styles.choices, wide && styles.choicesWide]}>
            <Choice label="Gender">
              <PillToggle<Sex>
                label="Gender"
                value={input.sex}
                onChange={v => set('sex', v)}
                options={[
                  { value: 'MALE', label: 'Male' },
                  { value: 'FEMALE', label: 'Female' },
                  { value: 'NOT_RECORDED', label: 'Unknown' },
                ]}
              />
            </Choice>
            <Choice label="Blood group">
              <PillToggle<BloodGroup>
                label="Blood group"
                value={input.bloodGroup}
                onChange={v => set('bloodGroup', v)}
                options={[
                  { value: 'A', label: 'A' },
                  { value: 'B', label: 'B' },
                  { value: 'AB', label: 'AB' },
                  { value: 'O', label: 'O' },
                  { value: 'UNKNOWN', label: 'Unknown' },
                ]}
              />
            </Choice>
            <Choice label="Rh factor">
              <PillToggle<RhFactor>
                label="Rh factor"
                value={input.rhFactor}
                onChange={v => set('rhFactor', v)}
                options={[
                  { value: 'POSITIVE', label: 'Rh +' },
                  { value: 'NEGATIVE', label: 'Rh −' },
                  { value: 'UNKNOWN', label: 'Unknown' },
                ]}
              />
            </Choice>
          </View>
        </View>

        {saveError ? (
          <Notice tone="error" title="NOT SAVED" message={saveError} />
        ) : null}

        <View style={[styles.actions, wide && styles.actionsWide]}>
          <View style={wide ? styles.actionMain : undefined}>
            <PrimaryButton
              title="Save & Continue"
              onPress={save}
              loading={saving}
              accessibilityHint="Saves the patient on this tablet and opens their record"
            />
          </View>
          <View style={wide ? styles.actionSide : undefined}>
            <SecondaryButton title="Cancel" onPress={onCancel} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: '#F3F5F8',
  },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  card: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  cardTitle: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  grid: {
    gap: spacing.lg,
  },
  gridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cellWide: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  cell: {
    flexBasis: '28%',
    flexGrow: 1,
  },
  cellNarrow: {
    flexBasis: '16%',
    flexGrow: 1,
  },
  choices: {
    gap: spacing.lg,
  },
  choicesWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.xl,
  },
  choice: {
    gap: spacing.sm,
  },
  choiceLabel: {
    ...typography.label,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  actions: {
    gap: spacing.md,
  },
  actionsWide: {
    flexDirection: 'row',
  },
  actionMain: {
    flex: 1.4,
  },
  actionSide: {
    flex: 1,
  },
});
