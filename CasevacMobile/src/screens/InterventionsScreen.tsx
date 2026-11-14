/**
 * M07B — Interventions & Triage (client screens 6 + 7, combined).
 *
 * Opens after Save & Continue on the casualty assessment. One screen for
 * what the medic did and the decision taken:
 *   A Initial interventions — bleeding control (method, tourniquet time),
 *     airway, breathing, splinting, oxygen, medication given
 *   B Casualty condition — triage priority (1 RED · 2 YELLOW · 3 GREEN ·
 *     4 BLACK), location of injury (front/back body diagram → codes such
 *     as THR-F), provisional diagnosis
 *   C Additional remarks
 * The triage starts from the status recorded in the assessment; changing it
 * here is a re-triage and both are kept.
 */
import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_BRAND } from '../brand';
import { useDraftState } from '../services/navigation/drafts';
import {
  AppHeader,
  FormField,
  Icon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
} from '../components';
import {
  ChoiceQuestion,
  FormSection,
  TriageCards,
  YES_NO,
  YES_NO_NA,
} from '../components/formParts';
import { BodyDiagram } from '../components/BodyDiagram';
import { TimeField } from '../components/pickers';
import {
  BLEEDING_METHODS,
  EMPTY_MEDICATION,
  emptyInterventions,
  getInterventionsStore,
  validateInterventions,
  type BleedingMethod,
  type InterventionsErrors,
  type InterventionsForm,
  type InterventionsRecord,
  type InterventionsStore,
  type MedicationRow,
} from '../services/evacuation/interventions';
import type { RhFactor } from '../services/identity/types';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import type { TriageCategory } from '../types';
import { patientLabel, type AssessmentPatient } from './AssessmentScreen';

interface InterventionsScreenProps {
  patient: AssessmentPatient;
  /** The assessment just saved (id + the status it recorded). */
  assessment: { id: string; status: TriageCategory | null };
  recordedBy: string;
  onCancel: () => void;
  /** Called with the saved record; the flow continues to handover. */
  onSaved: (record: InterventionsRecord) => void;
  /** Injected in tests; defaults to this tablet's store. */
  store?: InterventionsStore;
  /** Keeps unsaved input across tab switches and restarts (patient tabs). */
  draftKey?: string;
}

type SectionKey = 'A' | 'B' | 'C';

const RH_SIGN: Record<RhFactor, string> = {
  UNKNOWN: '',
  POSITIVE: '+',
  NEGATIVE: '−',
};

export function InterventionsScreen({
  patient,
  assessment,
  recordedBy,
  onCancel,
  onSaved,
  store,
  draftKey,
}: InterventionsScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [form, setForm, clearDraft] = useDraftState<InterventionsForm>(
    draftKey,
    () => emptyInterventions(assessment.status),
  );
  const [errors, setErrors] = useState<InterventionsErrors>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    A: true,
    B: true,
    C: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof InterventionsForm>(
    key: K,
    value: InterventionsForm[K],
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };
  const toggleMethod = (method: BleedingMethod) =>
    setForm(prev => ({
      ...prev,
      bleedingMethods: prev.bleedingMethods.includes(method)
        ? prev.bleedingMethods.filter(m => m !== method)
        : [...prev.bleedingMethods, method],
    }));
  const setMedicationAnswer = (value: InterventionsForm['medication']) => {
    setForm(prev => ({
      ...prev,
      medication: value,
      // Open one empty row the first time "Yes" is chosen.
      medications:
        value === 'YES' && prev.medications.length === 0
          ? [{ ...EMPTY_MEDICATION }]
          : prev.medications,
    }));
    setErrors(prev => ({
      ...prev,
      medications: undefined,
      medicationRows: undefined,
    }));
  };
  const setMedication = (index: number, patch: Partial<MedicationRow>) => {
    setForm(prev => ({
      ...prev,
      medications: prev.medications.map((m, i) =>
        i === index ? { ...m, ...patch } : m,
      ),
    }));
    setErrors(prev => ({
      ...prev,
      medications: undefined,
      medicationRows: undefined,
    }));
  };
  const addMedication = () =>
    setForm(prev => ({
      ...prev,
      medications: [...prev.medications, { ...EMPTY_MEDICATION }],
    }));
  const removeMedication = (index: number) =>
    setForm(prev => ({
      ...prev,
      medications: prev.medications.filter((_, i) => i !== index),
    }));
  const toggleSection = (key: SectionKey) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (saving) {
      return;
    }
    const result = validateInterventions(form);
    if (!result.ok) {
      setErrors(result.errors);
      setOpen({ A: true, B: true, C: true });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const record = await (store ?? getInterventionsStore()).save(
        result.value,
        {
          assessmentId: assessment.id,
          initialStatus: assessment.status,
          patientKeys: patient.keys,
          patientLabel: patientLabel(patient),
          recordedBy,
        },
      );
      clearDraft();
      onSaved(record);
    } catch {
      setSaveError(
        'Interventions could not be saved on this tablet. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const blood =
    patient.bloodGroup === 'UNKNOWN'
      ? 'Blood group unknown'
      : `${patient.bloodGroup}${RH_SIGN[patient.rhFactor]}`;
  const bleeding = form.bleedingControl === 'YES';
  const tourniquet = bleeding && form.bleedingMethods.includes('Tourniquet');
  const retriaged =
    assessment.status !== null &&
    form.triage !== null &&
    form.triage !== assessment.status;
  const errorCount =
    Object.entries(errors).filter(
      ([key, v]) => key !== 'medicationRows' && Boolean(v),
    ).length + Object.keys(errors.medicationRows ?? {}).length;
  const half = wide ? styles.half : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Interventions & Triage"
        onBack={onCancel}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Who */}
        <View style={styles.patient}>
          <Icon name="user" size={26} color={colors.primary} />
          <View style={styles.flex}>
            <Text style={styles.patientName}>
              {patient.name ?? 'Unidentified casualty'}
            </Text>
            <Text style={styles.patientMeta}>
              {patient.idLabel} {patient.id}
            </Text>
          </View>
          <StatusBadge label="Assessment saved" tone="success" />
          <View style={styles.bloodChip}>
            <Icon name="droplet" size={16} color={colors.error} />
            <Text style={styles.bloodText}>{blood}</Text>
          </View>
        </View>

        {/* A — Initial interventions (client screen 6) */}
        <FormSection
          letter="A"
          title="Initial Interventions"
          open={open.A}
          onToggle={() => toggleSection('A')}
        >
          <ChoiceQuestion
            label="1. Massive bleeding control performed?"
            value={form.bleedingControl}
            options={YES_NO}
            onChange={v => set('bleedingControl', v)}
          />
          {bleeding ? (
            <View style={styles.nested}>
              <Text style={styles.choiceLabel}>Method</Text>
              <Text style={styles.hint}>Select all that apply.</Text>
              <View style={styles.wrap}>
                {BLEEDING_METHODS.map(method => {
                  const selected = form.bleedingMethods.includes(method);
                  return (
                    <Pressable
                      key={method}
                      onPress={() => toggleMethod(method)}
                      accessibilityRole="checkbox"
                      accessibilityLabel={method}
                      accessibilityState={{ checked: selected }}
                      style={({ pressed }) => [
                        styles.option,
                        selected && styles.optionOn,
                        pressed && !selected && styles.pressed,
                      ]}
                    >
                      {selected ? (
                        <Icon name="check" size={16} color={colors.onPrimary} />
                      ) : null}
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextOn,
                        ]}
                      >
                        {method}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {form.bleedingMethods.includes('Other') ? (
                <FormField
                  label="Describe the method"
                  value={form.bleedingOther}
                  onChangeText={v => set('bleedingOther', v)}
                  maxLength={120}
                  error={errors.bleedingOther}
                />
              ) : null}
              {tourniquet ? (
                <View style={half}>
                  <TimeField
                    label="Tourniquet — time of application"
                    value={form.tourniquetTime}
                    onChange={v => set('tourniquetTime', v)}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.grid}>
            <View style={half}>
              <ChoiceQuestion
                label="2. Airway intervention performed?"
                value={form.airway}
                options={YES_NO}
                onChange={v => set('airway', v)}
              />
            </View>
            <View style={half}>
              <ChoiceQuestion
                label="3. Breathing supported?"
                value={form.breathing}
                options={YES_NO}
                onChange={v => set('breathing', v)}
              />
            </View>
            <View style={half}>
              <ChoiceQuestion
                label="4. Splinting performed?"
                value={form.splinting}
                options={YES_NO}
                onChange={v => set('splinting', v)}
              />
            </View>
            <View style={half}>
              <ChoiceQuestion
                label="5. O₂ administered?"
                value={form.oxygen}
                options={YES_NO_NA}
                onChange={v => set('oxygen', v)}
              />
            </View>
          </View>

          <ChoiceQuestion
            label="6. Any medication given?"
            value={form.medication}
            options={YES_NO}
            onChange={setMedicationAnswer}
            error={errors.medications}
          />
          {form.medication === 'YES' ? (
            <View style={styles.nested}>
              {form.medications.map((m, i) => (
                <View key={i} style={styles.medRow}>
                  <View style={styles.medHead}>
                    <Text style={styles.choiceLabel}>Medicine {i + 1}</Text>
                    {form.medications.length > 1 ? (
                      <Pressable
                        onPress={() => removeMedication(i)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove medicine ${i + 1}`}
                        style={({ pressed }) => [
                          styles.remove,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.grid}>
                    <View style={half}>
                      <FormField
                        label={`Medicine ${i + 1} name`}
                        value={m.name}
                        onChangeText={v => setMedication(i, { name: v })}
                        placeholder="e.g. Inj TT, Morphine"
                        maxLength={80}
                        error={errors.medicationRows?.[i]}
                      />
                    </View>
                    <View style={half}>
                      <FormField
                        label={`Medicine ${i + 1} dose`}
                        value={m.dose}
                        onChangeText={v => setMedication(i, { dose: v })}
                        placeholder="e.g. 10 mg IM"
                        maxLength={40}
                      />
                    </View>
                    <View style={half}>
                      <TimeField
                        label={`Medicine ${i + 1} time given`}
                        value={m.time}
                        onChange={v => setMedication(i, { time: v })}
                      />
                    </View>
                  </View>
                </View>
              ))}
              <SecondaryButton
                title="Add another medicine"
                onPress={addMedication}
              />
            </View>
          ) : null}
        </FormSection>

        {/* B — Casualty condition / triage (client screen 7) */}
        <FormSection
          letter="B"
          title="Casualty Condition (Triage)"
          open={open.B}
          onToggle={() => toggleSection('B')}
        >
          <Text style={styles.hint}>
            {assessment.status
              ? `Assessment recorded ${assessment.status}. Change it if the casualty’s condition has changed.`
              : 'Select the triage priority.'}
          </Text>
          <TriageCards
            label="Triage priority"
            value={form.triage}
            onChange={v => set('triage', v)}
            wide={wide}
          />
          {errors.triage ? (
            <Text style={styles.error}>{errors.triage}</Text>
          ) : null}
          {retriaged ? (
            <Notice
              tone="warning"
              title={`Re-triaged: ${assessment.status} → ${form.triage}`}
              message="Both are kept on the patient’s record."
            />
          ) : null}
          <View style={styles.field}>
            <Text style={styles.choiceLabel} accessibilityRole="header">
              Location of injury
            </Text>
            <BodyDiagram
              value={form.injuryLocations ?? []}
              onChange={v => set('injuryLocations', v)}
            />
          </View>
          <FormField
            label="Provisional diagnosis"
            value={form.provisionalDiagnosis}
            onChangeText={v => set('provisionalDiagnosis', v)}
            placeholder="Enter provisional diagnosis"
            multiline
            maxLength={500}
          />
        </FormSection>

        {/* C — Additional remarks */}
        <FormSection
          letter="C"
          title="Additional Remarks"
          open={open.C}
          onToggle={() => toggleSection('C')}
        >
          <FormField
            label="Remarks"
            value={form.remarks}
            onChangeText={v => set('remarks', v)}
            placeholder="Anything else the next medic should know"
            multiline
            maxLength={1000}
          />
        </FormSection>

        {errorCount ? (
          <Notice
            tone="error"
            title="CHECK THE HIGHLIGHTED FIELDS"
            message={`${errorCount} ${
              errorCount === 1 ? 'field needs' : 'fields need'
            } attention before saving.`}
          />
        ) : null}
        {saveError ? (
          <Notice tone="error" title="NOT SAVED" message={saveError} />
        ) : null}

        <View style={[styles.actions, wide && styles.actionsWide]}>
          <View style={wide ? styles.actionMain : undefined}>
            <PrimaryButton
              title="Save"
              onPress={save}
              loading={saving}
              accessibilityHint="Saves interventions and triage on this tablet and adds them to the patient's history"
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

/* -------------------------------- Styles -------------------------------- */

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  pressed: { backgroundColor: colors.surface },

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
  patientMeta: { ...typography.caption, color: colors.textSecondary },
  bloodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.errorSurface,
  },
  bloodText: { ...typography.label, fontWeight: '800', color: colors.error },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  half: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  nested: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: '#F7F9FC',
  },
  choiceLabel: { ...typography.label, color: colors.textPrimary },
  field: { gap: spacing.sm },
  hint: { ...typography.helper, color: colors.textSecondary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionTextOn: { color: colors.onPrimary, fontWeight: '700' },

  medRow: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  medHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  remove: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  removeText: { ...typography.caption, fontWeight: '700', color: colors.error },

  error: { ...typography.helper, fontWeight: '700', color: colors.error },
  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },
  actionMain: { flex: 1.4 },
  actionSide: { flex: 1 },
});
