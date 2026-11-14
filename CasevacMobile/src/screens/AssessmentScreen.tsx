/**
 * M06 — Initial Casualty Assessment (screen 4).
 *
 * Opens from Start Evacuation on Patient Identification. First question:
 *   "Is the casualty conscious and able to provide details?"  Yes / No
 * Answering opens the assessment, in collapsible sections:
 *   A Incident details · B MARCH assessment · C Vitals · D Additional information
 * (If No, the same sections open: an unconscious casualty still needs MARCH
 * and vitals; incident details may come from witnesses or stay blank.)
 *
 * Saved on this tablet and added to the patient's previous history.
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
import {
  AppHeader,
  FormField,
  Icon,
  Notice,
  PillToggle,
  PrimaryButton,
  SecondaryButton,
  TriagePill,
} from '../components';
import { DateField, TimeField } from '../components/pickers';
import {
  EMPTY_ASSESSMENT,
  MARCH_ITEMS,
  MOI_OPTIONS,
  getAssessmentStore,
  validateAssessment,
  type AssessmentErrors,
  type AssessmentForm,
  type AssessmentStore,
  type MarchKey,
  type SystemicExam,
} from '../services/evacuation/assessment';
import type { BloodGroup, RhFactor } from '../services/identity/types';
import {
  colors,
  layout,
  radius,
  spacing,
  triage,
  typography,
} from '../theme/tokens';
import type { TriageCategory } from '../types';

/** Who is being assessed (from screen 3). */
export interface AssessmentPatient {
  name: string | null;
  idLabel: string;
  id: string;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  /** Every key the patient is known by, for history. */
  keys: string[];
}

interface AssessmentScreenProps {
  patient: AssessmentPatient;
  recordedBy: string;
  onCancel: () => void;
  onSaved: () => void;
  /** Injected in tests; defaults to this tablet's store. */
  store?: AssessmentStore;
}

type SectionKey = 'A' | 'B' | 'C' | 'D';

const RH_SIGN: Record<RhFactor, string> = {
  UNKNOWN: '',
  POSITIVE: '+',
  NEGATIVE: '−',
};

/* -------------------------------- Pieces -------------------------------- */

function Section({
  letter,
  title,
  open,
  onToggle,
  children,
}: {
  letter: SectionKey;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel={`${letter}. ${title}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.sectionHead, pressed && styles.pressed]}
      >
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
        <View style={open ? styles.chevronOpen : undefined}>
          <Icon name="chevronDown" size={22} color={colors.textSecondary} />
        </View>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function Unit({ text }: { text: string }) {
  return <Text style={styles.unit}>{text}</Text>;
}

function Checkbox({
  number,
  letter,
  label,
  checked,
  onToggle,
}: {
  number: number;
  letter: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityLabel={`${letter} – ${label}`}
      accessibilityState={{ checked }}
      style={({ pressed }) => [
        styles.check,
        checked && styles.checkOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.checkNumber}>{number}</Text>
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <Icon name="check" size={18} color="#FFFFFF" /> : null}
      </View>
      <Text style={styles.checkLetter}>{letter}</Text>
      <Text style={styles.checkLabel}>– {label}</Text>
    </Pressable>
  );
}

/* -------------------------------- Screen -------------------------------- */

export function AssessmentScreen({
  patient,
  recordedBy,
  onCancel,
  onSaved,
  store,
}: AssessmentScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const [form, setForm] = useState<AssessmentForm>(EMPTY_ASSESSMENT);
  const [errors, setErrors] = useState<AssessmentErrors>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const set = <K extends keyof AssessmentForm>(
    key: K,
    value: AssessmentForm[K],
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };
  const toggleMarch = (key: MarchKey) =>
    setForm(prev => ({
      ...prev,
      march: { ...prev.march, [key]: !prev.march[key] },
    }));
  const toggleSection = (key: SectionKey) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (saving) {
      return;
    }
    const result = validateAssessment(form);
    if (!result.ok) {
      setErrors(result.errors);
      // Make sure the fields with problems are visible.
      setOpen({ A: true, B: true, C: true, D: true });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await (store ?? getAssessmentStore()).save(result.value, {
        patientKeys: patient.keys,
        patientLabel: `${patient.name ?? 'Unidentified casualty'} (${
          patient.id
        })`,
        recordedBy,
      });
      onSaved();
    } catch {
      setSaveError(
        'The assessment could not be saved on this tablet. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const blood =
    patient.bloodGroup === 'UNKNOWN'
      ? 'Blood group unknown'
      : `${patient.bloodGroup}${RH_SIGN[patient.rhFactor]}`;
  const errorCount = Object.values(errors).filter(Boolean).length;
  const half = wide ? styles.half : undefined;
  const third = wide ? styles.third : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow="CASEVAC"
        title="Initial Casualty Assessment"
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
          <View style={styles.bloodChip}>
            <Icon name="droplet" size={16} color={colors.error} />
            <Text style={styles.bloodText}>{blood}</Text>
          </View>
        </View>

        {/* First question */}
        <View style={styles.question}>
          <Text style={styles.questionText} accessibilityRole="header">
            Is the casualty conscious and able to provide details?
          </Text>
          <View style={styles.answers}>
            {(['YES', 'NO'] as const).map(answer => {
              const selected = form.conscious === answer;
              return (
                <Pressable
                  key={answer}
                  onPress={() => set('conscious', answer)}
                  accessibilityRole="radio"
                  accessibilityLabel={answer === 'YES' ? 'Yes' : 'No'}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.answer,
                    selected && styles.answerOn,
                    pressed && !selected && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.answerText, selected && styles.answerTextOn]}
                  >
                    {answer === 'YES' ? 'Yes' : 'No'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {errors.conscious ? (
            <Text style={styles.error}>{errors.conscious}</Text>
          ) : null}
        </View>

        {form.conscious ? (
          <>
            <Text style={styles.heading} accessibilityRole="header">
              Enter initial casualty assessment
            </Text>
            {form.conscious === 'NO' ? (
              <Notice
                tone="warning"
                title="Casualty cannot provide details"
                message="Record what you observe. Incident details can come from witnesses or be left blank."
              />
            ) : null}

            {/* A — Incident details */}
            <Section
              letter="A"
              title="Incident Details"
              open={open.A}
              onToggle={() => toggleSection('A')}
            >
              <View style={styles.grid}>
                <View style={half}>
                  <DateField
                    label="1. Date of occurrence"
                    value={form.occurredDate}
                    onChange={v => set('occurredDate', v)}
                    maximumDate={new Date()}
                    error={errors.occurredDate}
                  />
                </View>
                <View style={half}>
                  <TimeField
                    label="Time of occurrence"
                    value={form.occurredTime}
                    onChange={v => set('occurredTime', v)}
                  />
                </View>
                <View style={half}>
                  <TimeField
                    label="2. Time of injury"
                    value={form.injuryTime}
                    onChange={v => set('injuryTime', v)}
                  />
                </View>
                <View style={half}>
                  <FormField
                    label="4. Number of injuries"
                    value={form.injuryCount}
                    onChangeText={v =>
                      set('injuryCount', v.replace(/[^0-9]/g, ''))
                    }
                    keyboardType="number-pad"
                    maxLength={2}
                    placeholder="e.g. 2"
                    error={errors.injuryCount}
                  />
                </View>
              </View>

              <View style={styles.choice}>
                <Text style={styles.choiceLabel}>
                  3. Mechanism of injury (MOI)
                </Text>
                <View style={styles.wrap}>
                  {MOI_OPTIONS.map(option => {
                    const selected = form.mechanism === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() =>
                          set('mechanism', selected ? null : option)
                        }
                        accessibilityRole="radio"
                        accessibilityLabel={option}
                        accessibilityState={{ selected }}
                        style={({ pressed }) => [
                          styles.option,
                          selected && styles.optionOn,
                          pressed && !selected && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selected && styles.optionTextOn,
                          ]}
                        >
                          {option}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {form.mechanism === 'Other' ? (
                  <FormField
                    label="Describe the mechanism"
                    value={form.mechanismOther}
                    onChangeText={v => set('mechanismOther', v)}
                    maxLength={120}
                    error={errors.mechanismOther}
                  />
                ) : null}
              </View>

              <View style={styles.choice}>
                <Text style={styles.choiceLabel}>
                  5. Initial casualty status
                </Text>
                <View style={styles.wrap}>
                  {(
                    ['RED', 'YELLOW', 'GREEN', 'BLACK'] as TriageCategory[]
                  ).map(category => {
                    const selected = form.status === category;
                    return (
                      <Pressable
                        key={category}
                        onPress={() =>
                          set('status', selected ? null : category)
                        }
                        accessibilityRole="radio"
                        accessibilityLabel={`Status ${category}`}
                        accessibilityState={{ selected }}
                        style={[
                          styles.status,
                          selected && { borderColor: triage[category].fill },
                        ]}
                      >
                        <TriagePill category={category} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Section>

            {/* B — MARCH */}
            <Section
              letter="B"
              title="MARCH Assessment"
              open={open.B}
              onToggle={() => toggleSection('B')}
            >
              <Text style={styles.hint}>Tick all that apply.</Text>
              <View style={styles.checks}>
                {MARCH_ITEMS.map((item, i) => (
                  <Checkbox
                    key={item.key}
                    number={i + 1}
                    letter={item.key}
                    label={item.label}
                    checked={form.march[item.key]}
                    onToggle={() => toggleMarch(item.key)}
                  />
                ))}
              </View>
              <FormField
                label="6. Additional injury"
                value={form.additionalInjury}
                onChangeText={v => set('additionalInjury', v)}
                placeholder="Describe any other injury"
                multiline
                maxLength={500}
              />
            </Section>

            {/* C — Vitals */}
            <Section
              letter="C"
              title="Vitals"
              open={open.C}
              onToggle={() => toggleSection('C')}
            >
              <View style={styles.grid}>
                <View style={third}>
                  <FormField
                    label="1. HR"
                    value={form.hr}
                    onChangeText={v => set('hr', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                    trailing={<Unit text="bpm" />}
                    error={errors.hr}
                  />
                </View>
                <View style={third}>
                  <FormField
                    label="2. RR"
                    value={form.rr}
                    onChangeText={v => set('rr', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={2}
                    trailing={<Unit text="/min" />}
                    error={errors.rr}
                  />
                </View>
                <View style={third}>
                  <Text style={styles.choiceLabel}>3. BP</Text>
                  <View style={styles.bp}>
                    <View style={styles.flex}>
                      <FormField
                        label="Systolic"
                        value={form.bpSys}
                        onChangeText={v =>
                          set('bpSys', v.replace(/[^0-9]/g, ''))
                        }
                        keyboardType="number-pad"
                        maxLength={3}
                      />
                    </View>
                    <Text style={styles.slash}>/</Text>
                    <View style={styles.flex}>
                      <FormField
                        label="Diastolic"
                        value={form.bpDia}
                        onChangeText={v =>
                          set('bpDia', v.replace(/[^0-9]/g, ''))
                        }
                        keyboardType="number-pad"
                        maxLength={3}
                        trailing={<Unit text="mmHg" />}
                      />
                    </View>
                  </View>
                  {errors.bpSys || errors.bpDia ? (
                    <Text style={styles.error}>
                      {errors.bpSys ?? errors.bpDia}
                    </Text>
                  ) : null}
                </View>
                <View style={third}>
                  <FormField
                    label="4. SpO₂"
                    value={form.spo2}
                    onChangeText={v => set('spo2', v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                    trailing={<Unit text="%" />}
                    error={errors.spo2}
                  />
                </View>
                <View style={third}>
                  <FormField
                    label="5. Temp"
                    value={form.temp}
                    onChangeText={v => set('temp', v.replace(/[^0-9.,]/g, ''))}
                    keyboardType="decimal-pad"
                    maxLength={5}
                    trailing={<Unit text="°C" />}
                    error={errors.temp}
                  />
                </View>
              </View>

              <View style={styles.choice}>
                <Text style={styles.choiceLabel}>
                  6. S/E (systemic examination)
                </Text>
                <PillToggle<SystemicExam>
                  label="Systemic examination"
                  value={form.systemicExam ?? ('' as SystemicExam)}
                  onChange={v => set('systemicExam', v)}
                  options={[
                    { value: 'RECORDABLE', label: 'Recordable' },
                    { value: 'NOT_RECORDABLE', label: 'Not recordable' },
                  ]}
                />
                {form.systemicExam === 'RECORDABLE' ? (
                  <View style={styles.grid}>
                    {(
                      [
                        ['rs', 'RS (respiratory)'],
                        ['cvs', 'CVS (cardiovascular)'],
                        ['pa', 'P/A (per abdomen)'],
                        ['cns', 'CNS (nervous system)'],
                      ] as const
                    ).map(([key, label]) => (
                      <View key={key} style={half}>
                        <FormField
                          label={label}
                          value={form[key]}
                          onChangeText={v => set(key, v)}
                          maxLength={200}
                          placeholder="Findings"
                        />
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </Section>

            {/* D — Additional information */}
            <Section
              letter="D"
              title="Additional Information"
              open={open.D}
              onToggle={() => toggleSection('D')}
            >
              <FormField
                label="Details"
                value={form.additionalInfo}
                onChangeText={v => set('additionalInfo', v)}
                placeholder="Anything else the next medic should know"
                multiline
                maxLength={1000}
              />
            </Section>

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
                  title="Save Assessment"
                  onPress={save}
                  loading={saving}
                  accessibilityHint="Saves on this tablet and adds it to the patient's history"
                />
              </View>
              <View style={wide ? styles.actionSide : undefined}>
                <SecondaryButton title="Cancel" onPress={onCancel} />
              </View>
            </View>
          </>
        ) : null}
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

  question: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.background,
  },
  questionText: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  answers: { flexDirection: 'row', gap: spacing.md },
  answer: {
    flex: 1,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  answerOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  answerText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  answerTextOn: { color: colors.onPrimary },

  heading: { ...typography.sectionTitle, color: colors.textMuted },

  section: {
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sectionHead: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  letter: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  letterText: { fontSize: 16, fontWeight: '800', color: colors.onPrimary },
  sectionTitle: {
    flex: 1,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chevronOpen: { transform: [{ rotate: '180deg' }] },
  sectionBody: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingTop: spacing.sm,
    borderTopWidth: layout.borderWidth,
    borderTopColor: colors.divider,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  half: { flexBasis: '45%', flexGrow: 1, minWidth: 0 },
  third: { flexBasis: '30%', flexGrow: 1, minWidth: 0 },

  choice: { gap: spacing.sm },
  choiceLabel: { ...typography.label, color: colors.textPrimary },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: 48,
    justifyContent: 'center',
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
  status: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: 'transparent',
  },

  hint: { ...typography.helper, color: colors.textSecondary },
  checks: { gap: spacing.sm },
  check: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  checkOn: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  checkNumber: {
    width: 18,
    ...typography.label,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  box: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  boxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  checkLetter: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    width: 20,
  },
  checkLabel: { ...typography.body, flex: 1, color: colors.textPrimary },

  unit: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
  },
  bp: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  slash: { fontSize: 24, lineHeight: 52, color: colors.textSecondary },

  error: { ...typography.helper, fontWeight: '700', color: colors.error },
  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },
  actionMain: { flex: 1.4 },
  actionSide: { flex: 1 },
});
