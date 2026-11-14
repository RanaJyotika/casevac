/**
 * M13B — Prepare Evacuation (client screen 9). The final step.
 *
 * Opens after Save & Continue on Handover Details (8). Sections:
 *   A Date & time of evacuation — pickers, filled with now
 *   B Assisted by medical officer (MO)? — Yes / No
 *   C Assisted by nursing assistant (NA)? — Yes / No
 *   D Patient condition during evacuation — triage colour, pre-filled with
 *     the latest triage recorded for this evacuation; optional notes
 *   E Mode of evacuation — Ambulance (ground) · Helicopter (air) ·
 *     Stretcher (manual / on-site), one choice
 * Save completes the evacuation record: it shows "Handed over" and is read
 * only from then on.
 */
import React, { useEffect, useMemo, useState } from 'react';
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
  EvacuationBadge,
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
} from '../components/formParts';
import { DateField, TimeField } from '../components/pickers';
import {
  getAssessmentStore,
  toDateValue,
  toTimeValue,
  type AssessmentStore,
} from '../services/evacuation/assessment';
import {
  MODES,
  getEvacuationStore,
  validateEvacuation,
  type EvacuationErrors,
  type EvacuationForm,
  type EvacuationStore,
} from '../services/evacuation/evacuation';
import {
  getInterventionsStore,
  type InterventionsStore,
} from '../services/evacuation/interventions';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import type { TriageCategory } from '../types';
import { patientLabel, type AssessmentPatient } from './AssessmentScreen';

interface PrepareEvacuationScreenProps {
  patient: AssessmentPatient;
  assessmentId: string;
  handoverId: string | null;
  recordedBy: string;
  onCancel: () => void;
  onSaved: () => void;
  /** Injected in tests; default to this tablet's stores. */
  store?: EvacuationStore;
  /** Keeps unsaved input across tab switches and restarts (patient tabs). */
  draftKey?: string;
  interventionsStore?: InterventionsStore;
  assessmentStore?: AssessmentStore;
}

type SectionKey = 'A' | 'B' | 'C' | 'D' | 'E';

export function PrepareEvacuationScreen({
  patient,
  assessmentId,
  handoverId,
  recordedBy,
  onCancel,
  onSaved,
  store,
  draftKey,
  interventionsStore,
  assessmentStore,
}: PrepareEvacuationScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const evacuations = useMemo(() => store ?? getEvacuationStore(), [store]);

  const [form, setForm, clearDraft] = useDraftState<EvacuationForm>(
    draftKey,
    () => {
      const now = new Date();
      return {
        date: toDateValue(now),
        time: toTimeValue(now),
        assistedByMo: null,
        assistedByNa: null,
        condition: null,
        conditionNotes: '',
        mode: null,
      };
    },
  );
  const [latestTriage, setLatestTriage] = useState<TriageCategory | null>(null);
  const [errors, setErrors] = useState<EvacuationErrors>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
    E: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-fill the condition with the latest triage of this evacuation.
  useEffect(() => {
    let cancelled = false;
    const find = async (): Promise<TriageCategory | null> => {
      const r = await (
        interventionsStore ?? getInterventionsStore()
      ).findByAssessment(assessmentId);
      if (r) {
        return r.triage.category;
      }
      const a = await (assessmentStore ?? getAssessmentStore()).get(
        assessmentId,
      );
      return a?.incident.status ?? null;
    };
    find()
      .then(latest => {
        if (!cancelled && latest) {
          setLatestTriage(latest);
          setForm(prev =>
            prev.condition ? prev : { ...prev, condition: latest },
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [assessmentId, interventionsStore, assessmentStore, setForm]);

  const set = <K extends keyof EvacuationForm>(
    key: K,
    value: EvacuationForm[K],
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };
  const toggleSection = (key: SectionKey) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (saving) {
      return;
    }
    const result = validateEvacuation(form);
    if (!result.ok) {
      setErrors(result.errors);
      setOpen({ A: true, B: true, C: true, D: true, E: true });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await evacuations.save(result.value, {
        assessmentId,
        handoverId,
        patientKeys: patient.keys,
        patientLabel: patientLabel(patient),
        recordedBy,
      });
      clearDraft();
      onSaved();
    } catch {
      setSaveError(
        'The evacuation could not be saved on this tablet. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const half = wide ? styles.half : undefined;
  const changed =
    latestTriage !== null &&
    form.condition !== null &&
    form.condition !== latestTriage;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Prepare Evacuation"
        onBack={onCancel}
        right={<EvacuationBadge kind="IN_TRANSIT" label="In transit" />}
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
          <StatusBadge label="Handover details saved" tone="success" />
        </View>

        {/* A — Date and time of evacuation */}
        <FormSection
          letter="A"
          title="Date & Time of Evacuation"
          open={open.A}
          onToggle={() => toggleSection('A')}
        >
          <View style={styles.grid}>
            <View style={half}>
              <DateField
                label="Date of evacuation"
                value={form.date}
                onChange={v => set('date', v)}
                maximumDate={new Date()}
                error={errors.date}
              />
            </View>
            <View style={half}>
              <TimeField
                label="Time of evacuation"
                value={form.time}
                onChange={v => set('time', v)}
                error={errors.time}
              />
            </View>
          </View>
        </FormSection>

        {/* B — Assisted by MO */}
        <FormSection
          letter="B"
          title="Assisted by Medical Officer (MO)"
          open={open.B}
          onToggle={() => toggleSection('B')}
        >
          <ChoiceQuestion
            label="Assisted by medical officer?"
            value={form.assistedByMo}
            options={YES_NO}
            onChange={v => set('assistedByMo', v)}
            error={errors.assistedByMo}
          />
        </FormSection>

        {/* C — Assisted by NA */}
        <FormSection
          letter="C"
          title="Assisted by Nursing Assistant (NA)"
          open={open.C}
          onToggle={() => toggleSection('C')}
        >
          <ChoiceQuestion
            label="Assisted by nursing assistant?"
            value={form.assistedByNa}
            options={YES_NO}
            onChange={v => set('assistedByNa', v)}
            error={errors.assistedByNa}
          />
        </FormSection>

        {/* D — Patient condition during evacuation */}
        <FormSection
          letter="D"
          title="Patient Condition During Evacuation"
          open={open.D}
          onToggle={() => toggleSection('D')}
        >
          <Text style={styles.hint}>
            {latestTriage
              ? `Latest triage: ${latestTriage}. Change it if the casualty’s condition has changed.`
              : 'Select the casualty’s condition.'}
          </Text>
          <TriageCards
            label="Patient condition during evacuation"
            value={form.condition}
            onChange={v => set('condition', v)}
            wide={wide}
          />
          {errors.condition ? (
            <Text style={styles.error}>{errors.condition}</Text>
          ) : null}
          {changed ? (
            <Notice
              tone="warning"
              title={`Condition changed: ${latestTriage} → ${form.condition}`}
              message="Both are kept on the patient’s record."
            />
          ) : null}
          <FormField
            label="Condition notes"
            value={form.conditionNotes}
            onChangeText={v => set('conditionNotes', v)}
            placeholder="e.g. stable, under monitoring"
            multiline
            maxLength={300}
          />
        </FormSection>

        {/* E — Mode of evacuation */}
        <FormSection
          letter="E"
          title="Mode of Evacuation"
          open={open.E}
          onToggle={() => toggleSection('E')}
        >
          <Text style={styles.hint}>Select one.</Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Mode of evacuation"
          >
            {MODES.map(m => {
              const selected = form.mode === m.value;
              return (
                <Pressable
                  key={m.value}
                  onPress={() => set('mode', m.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={`${m.label} (${m.meaning})`}
                  accessibilityState={{ selected, checked: selected }}
                  style={({ pressed }) => [
                    styles.mode,
                    selected && styles.modeOn,
                    pressed && !selected && styles.pressed,
                  ]}
                >
                  <View style={[styles.box, selected && styles.boxOn]}>
                    {selected ? (
                      <Icon name="check" size={18} color={colors.onPrimary} />
                    ) : null}
                  </View>
                  <Text style={styles.modeLabel}>{m.label}</Text>
                  <Text style={styles.modeMeaning}>({m.meaning})</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.mode ? <Text style={styles.error}>{errors.mode}</Text> : null}
        </FormSection>

        <Notice
          tone="warning"
          title="Final step"
          message="Saving completes the evacuation record. The casualty shows as Handed over and the record becomes read only."
        />
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
              accessibilityHint="Completes the evacuation record; it becomes read only"
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  half: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  hint: { ...typography.helper, color: colors.textSecondary },
  error: { ...typography.helper, fontWeight: '700', color: colors.error },

  mode: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  modeOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  box: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  boxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  modeLabel: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  modeMeaning: { ...typography.body, color: colors.textSecondary },

  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },
  actionMain: { flex: 1.4 },
  actionSide: { flex: 1 },
});
