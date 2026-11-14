/**
 * M13 — Handover Details (client screen 8).
 *
 * Opens after Save on Interventions & Triage. Sections:
 *   A Place of initiation — RAP / ADS / FSC (pre-selected with the place this
 *     tablet last handed over from)
 *   B Date and time of initiation — pickers, filled with now
 *   C Receiving medical officer — search the staff list (name or personnel
 *     ID), pick one, see their photo, name, rank, designation, age, ID, unit;
 *     or enter details by hand when they are not on the list
 *   D Next course of action — one choice; "Other" asks for details
 * Save & Continue marks the casualty "In transit" and opens Prepare
 * Evacuation (9), whose Save completes the record.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
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
import { FormSection } from '../components/formParts';
import { DateField, TimeField } from '../components/pickers';
import { toDateValue, toTimeValue } from '../services/evacuation/assessment';
import {
  EMPTY_MANUAL_OFFICER,
  NEXT_ACTIONS,
  PLACES,
  getHandoverStore,
  officerFromStaff,
  validateHandover,
  type HandoverErrors,
  type HandoverForm,
  type HandoverRecord,
  type HandoverStore,
  type ManualOfficer,
  type ReceivingOfficer,
} from '../services/evacuation/handover';
import { getActiveIdentityDirectory } from '../services/identity/provisioningStore';
import type {
  IdentityDirectory,
  StaffMember,
} from '../services/identity/types';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import { ageFrom } from '../utils/format';
import { patientLabel, type AssessmentPatient } from './AssessmentScreen';

interface HandoverScreenProps {
  patient: AssessmentPatient;
  assessmentId: string;
  interventionsId: string | null;
  recordedBy: string;
  onCancel: () => void;
  /** Called with the saved record; the flow continues to Prepare Evacuation. */
  onSaved: (record: HandoverRecord) => void;
  /** Injected in tests; default to this tablet's store / staff list. */
  store?: HandoverStore;
  /** Keeps unsaved input across tab switches and restarts (patient tabs). */
  draftKey?: string;
  directory?: IdentityDirectory;
}

type SectionKey = 'A' | 'B' | 'C' | 'D';

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

function Avatar({
  photo,
  name,
  size,
}: {
  photo: string | null;
  name: string;
  size: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 6 },
      ]}
    >
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={{ width: size, height: size }}
          accessibilityLabel={`Photo of ${name}`}
        />
      ) : (
        <Text
          style={[styles.avatarText, { fontSize: size / 2.8 }]}
          accessibilityLabel="No photo on file"
        >
          {initials(name) || '?'}
        </Text>
      )}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const shown = value || 'Not recorded';
  return (
    <View
      style={styles.detail}
      accessible
      accessibilityLabel={`${label}: ${shown}`}
    >
      <Text style={styles.detailLabel}>{label}</Text>
      <Text
        style={[styles.detailValue, !value && styles.muted]}
        numberOfLines={2}
      >
        {shown}
      </Text>
    </View>
  );
}

/** Full details of the receiving officer. Also used by the history report. */
export function OfficerCard({ officer }: { officer: ReceivingOfficer }) {
  const age = ageFrom(officer.dateOfBirth);
  return (
    <View style={styles.officer}>
      <Avatar photo={officer.photo} name={officer.fullName} size={112} />
      <View style={styles.officerBody}>
        <View style={styles.officerHead}>
          <Text style={styles.officerName} accessibilityRole="header">
            {officer.fullName}
          </Text>
          {officer.source === 'MANUAL' ? (
            <StatusBadge
              label="Entered by hand — not verified"
              tone="warning"
            />
          ) : (
            <StatusBadge label="From staff list" tone="success" />
          )}
        </View>
        <View style={styles.details}>
          <Detail label="Rank" value={officer.rank} />
          <Detail label="Designation" value={officer.designation} />
          <Detail label="Role" value={officer.roleLabel} />
          <Detail label="Age" value={age === null ? '' : `${age} years`} />
          <Detail label="Personnel ID" value={officer.displayId} />
          <Detail label="Unit / facility" value={officer.unit} />
          <Detail label="Contact phone" value={officer.contactPhone} />
        </View>
      </View>
    </View>
  );
}

function StaffRow({
  staff,
  onPress,
}: {
  staff: StaffMember;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Select ${staff.rank} ${staff.fullName}, ${staff.displayId}`}
      style={({ pressed }) => [styles.staffRow, pressed && styles.pressed]}
    >
      <Avatar photo={staff.photo} name={staff.fullName} size={52} />
      <View style={styles.flex}>
        <Text style={styles.staffName} numberOfLines={1}>
          {[staff.rank, staff.fullName].filter(Boolean).join(' ')}
        </Text>
        <Text style={styles.staffMeta} numberOfLines={1}>
          {[staff.designation || staff.roleLabel, staff.unit]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
      <Text style={styles.staffId}>{staff.displayId}</Text>
      <Icon name="chevronRight" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

export function HandoverScreen({
  patient,
  assessmentId,
  interventionsId,
  recordedBy,
  onCancel,
  onSaved,
  store,
  draftKey,
  directory,
}: HandoverScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const handovers = useMemo(() => store ?? getHandoverStore(), [store]);
  const staffList = useMemo(
    () => directory ?? getActiveIdentityDirectory(),
    [directory],
  );

  const [form, setForm, clearDraft] = useDraftState<HandoverForm>(
    draftKey,
    () => {
      const now = new Date();
      return {
        place: null,
        date: toDateValue(now),
        time: toTimeValue(now),
        officer: null,
        manualEntry: false,
        manual: EMPTY_MANUAL_OFFICER,
        nextAction: null,
        nextActionOther: '',
      };
    },
  );
  const [placeHint, setPlaceHint] = useState(false);
  const [errors, setErrors] = useState<HandoverErrors>({});
  const [open, setOpen] = useState<Record<SectionKey, boolean>>({
    A: true,
    B: true,
    C: true,
    D: true,
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StaffMember[]>([]);
  const [staffCount, setStaffCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Pre-select the place this tablet last handed over from.
  useEffect(() => {
    let cancelled = false;
    handovers.lastPlace().then(last => {
      if (!cancelled && last) {
        setForm(prev => (prev.place ? prev : { ...prev, place: last }));
        setPlaceHint(true);
      }
    });
    staffList
      .staffCount()
      .then(n => !cancelled && setStaffCount(n))
      .catch(() => !cancelled && setStaffCount(0));
    return () => {
      cancelled = true;
    };
  }, [handovers, staffList, setForm]);

  useEffect(() => {
    let cancelled = false;
    staffList
      .searchStaff(query, 8)
      .then(found => !cancelled && setResults(found))
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, [query, staffList]);

  const set = <K extends keyof HandoverForm>(
    key: K,
    value: HandoverForm[K],
  ) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };
  const setManual = (patch: Partial<ManualOfficer>) => {
    setForm(prev => ({ ...prev, manual: { ...prev.manual, ...patch } }));
    setErrors(prev => ({ ...prev, manualName: undefined, officer: undefined }));
  };
  const selectStaff = (s: StaffMember) => {
    setForm(prev => ({
      ...prev,
      officer: officerFromStaff(s),
      manualEntry: false,
    }));
    setErrors(prev => ({ ...prev, officer: undefined }));
    setQuery('');
  };
  const toggleSection = (key: SectionKey) =>
    setOpen(prev => ({ ...prev, [key]: !prev[key] }));

  const save = async () => {
    if (saving) {
      return;
    }
    const result = validateHandover(form);
    if (!result.ok) {
      setErrors(result.errors);
      setOpen({ A: true, B: true, C: true, D: true });
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const record = await handovers.save(result.value, {
        assessmentId,
        interventionsId,
        patientKeys: patient.keys,
        patientLabel: patientLabel(patient),
        recordedBy,
      });
      clearDraft();
      onSaved(record);
    } catch {
      setSaveError(
        'The handover could not be saved on this tablet. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const errorCount = Object.values(errors).filter(Boolean).length;
  const half = wide ? styles.half : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Handover Details"
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
          <StatusBadge label="Assessment & triage saved" tone="success" />
        </View>

        {/* A — Place of initiation */}
        <FormSection
          letter="A"
          title="Place of Initiation"
          open={open.A}
          onToggle={() => toggleSection('A')}
        >
          <View
            style={[styles.places, wide && styles.placesWide]}
            accessibilityRole="radiogroup"
            accessibilityLabel="Place of initiation"
          >
            {PLACES.map((p, i) => {
              const selected = form.place === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => {
                    set('place', p.value);
                    setPlaceHint(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityLabel={`${i + 1}. ${p.label}, ${p.meaning}`}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.place,
                    selected && styles.placeOn,
                    pressed && !selected && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.placeNumber, selected && styles.onPrimary]}
                  >
                    {i + 1}
                  </Text>
                  <View style={styles.flex}>
                    <Text
                      style={[styles.placeLabel, selected && styles.onPrimary]}
                    >
                      {p.label}
                    </Text>
                    <Text
                      style={[
                        styles.placeMeaning,
                        selected && styles.onPrimary,
                      ]}
                    >
                      {p.meaning}
                    </Text>
                  </View>
                  {selected ? (
                    <Icon name="check" size={22} color={colors.onPrimary} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {placeHint && form.place ? (
            <Text style={styles.hint}>
              Pre-selected: last place used on this tablet. Change it if needed.
            </Text>
          ) : null}
          {errors.place ? (
            <Text style={styles.error}>{errors.place}</Text>
          ) : null}
        </FormSection>

        {/* B — Date and time of initiation */}
        <FormSection
          letter="B"
          title="Date & Time of Initiation"
          open={open.B}
          onToggle={() => toggleSection('B')}
        >
          <View style={styles.grid}>
            <View style={half}>
              <DateField
                label="Date of initiation"
                value={form.date}
                onChange={v => set('date', v)}
                maximumDate={new Date()}
                error={errors.date}
              />
            </View>
            <View style={half}>
              <TimeField
                label="Time of initiation"
                value={form.time}
                onChange={v => set('time', v)}
                error={errors.time}
              />
            </View>
          </View>
        </FormSection>

        {/* C — Receiving medical officer */}
        <FormSection
          letter="C"
          title="Details of Medical Officer"
          open={open.C}
          onToggle={() => toggleSection('C')}
        >
          <Text style={styles.hint}>The officer receiving the casualty.</Text>
          {form.officer && !form.manualEntry ? (
            <>
              <OfficerCard officer={form.officer} />
              <SecondaryButton
                title="Change officer"
                onPress={() => set('officer', null)}
              />
            </>
          ) : form.manualEntry ? (
            <View style={styles.nested}>
              <Notice
                tone="warning"
                title="Officer not on the staff list"
                message="Enter what you know. These details are marked as not verified."
              />
              <View style={styles.grid}>
                <View style={half}>
                  <FormField
                    label="Officer name"
                    required
                    value={form.manual.fullName}
                    onChangeText={v => setManual({ fullName: v })}
                    maxLength={100}
                    error={errors.manualName}
                  />
                </View>
                <View style={half}>
                  <FormField
                    label="Officer rank"
                    value={form.manual.rank}
                    onChangeText={v => setManual({ rank: v })}
                    maxLength={40}
                  />
                </View>
                <View style={half}>
                  <FormField
                    label="Officer ID"
                    value={form.manual.displayId}
                    onChangeText={v => setManual({ displayId: v })}
                    autoCapitalize="characters"
                    maxLength={30}
                  />
                </View>
                <View style={half}>
                  <FormField
                    label="Officer unit / facility"
                    value={form.manual.unit}
                    onChangeText={v => setManual({ unit: v })}
                    maxLength={80}
                  />
                </View>
                <View style={half}>
                  <FormField
                    label="Officer designation"
                    value={form.manual.designation}
                    onChangeText={v => setManual({ designation: v })}
                    maxLength={60}
                  />
                </View>
              </View>
              <SecondaryButton
                title="Search the staff list instead"
                onPress={() => set('manualEntry', false)}
              />
            </View>
          ) : (
            <>
              <FormField
                label="Search officer by name or ID"
                value={query}
                onChangeText={setQuery}
                placeholder="e.g. Meera or MED-00003"
                autoCorrect={false}
                leading={
                  <Icon name="search" size={20} color={colors.textSecondary} />
                }
                error={errors.officer}
              />
              {staffCount === 0 ? (
                <Notice
                  tone="warning"
                  title="No staff list on this tablet"
                  message="Sign in online once to download the medical officers from the dashboard, or enter the officer’s details by hand."
                />
              ) : query.trim() && results.length === 0 ? (
                <Text style={styles.hint}>
                  No officer matches “{query.trim()}”.
                </Text>
              ) : null}
              {results.length ? (
                <View style={styles.results}>
                  {results.map(s => (
                    <StaffRow
                      key={s.staffId}
                      staff={s}
                      onPress={() => selectStaff(s)}
                    />
                  ))}
                </View>
              ) : null}
              <SecondaryButton
                title="Officer not in list — enter details"
                icon={<Icon name="userPlus" size={20} color={colors.primary} />}
                onPress={() => {
                  set('manualEntry', true);
                  setErrors(prev => ({ ...prev, officer: undefined }));
                }}
              />
            </>
          )}
        </FormSection>

        {/* D — Next course of action */}
        <FormSection
          letter="D"
          title="Next Course of Action"
          open={open.D}
          onToggle={() => toggleSection('D')}
        >
          <Text style={styles.hint}>Select one.</Text>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Next course of action"
          >
            {NEXT_ACTIONS.map(a => {
              const selected = form.nextAction === a.value;
              return (
                <Pressable
                  key={a.value}
                  onPress={() => set('nextAction', a.value)}
                  accessibilityRole="radio"
                  accessibilityLabel={a.label}
                  accessibilityState={{ selected, checked: selected }}
                  style={({ pressed }) => [
                    styles.action,
                    selected && styles.actionOn,
                    pressed && !selected && styles.pressed,
                  ]}
                >
                  <View style={[styles.box, selected && styles.boxOn]}>
                    {selected ? (
                      <Icon name="check" size={18} color={colors.onPrimary} />
                    ) : null}
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {form.nextAction === 'OTHER' ? (
            <FormField
              label="Enter details"
              value={form.nextActionOther}
              onChangeText={v => set('nextActionOther', v)}
              maxLength={200}
              error={errors.nextActionOther}
            />
          ) : null}
          {errors.nextAction ? (
            <Text style={styles.error}>{errors.nextAction}</Text>
          ) : null}
        </FormSection>

        <Notice
          tone="warning"
          title="Next: Prepare Evacuation"
          message="Saving marks the casualty In transit. The handover is complete once Prepare Evacuation is saved."
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
              title="Save & Continue"
              onPress={save}
              loading={saving}
              accessibilityHint="Saves the handover details and opens Prepare Evacuation"
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
  muted: { color: colors.textSecondary, fontWeight: '400' },
  onPrimary: { color: colors.onPrimary },

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
  nested: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.warning,
    backgroundColor: '#FFFBF2',
  },

  places: { gap: spacing.sm },
  placesWide: { flexDirection: 'row' },
  place: {
    flex: 1,
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  placeOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  placeNumber: {
    width: 22,
    fontSize: 18,
    fontWeight: '800',
    color: colors.textSecondary,
  },
  placeLabel: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  placeMeaning: { ...typography.caption, color: colors.textSecondary },

  results: {
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  staffRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.background,
  },
  staffName: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  staffMeta: { ...typography.caption, color: colors.textSecondary },
  staffId: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.textSecondary,
  },

  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
  },
  avatarText: { fontWeight: '700', color: colors.primary },

  officer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySurface,
  },
  officerBody: { flex: 1, minWidth: 260, gap: spacing.md },
  officerHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  officerName: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  details: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  detail: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 150,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  detailLabel: { ...typography.helper, color: colors.textSecondary },
  detailValue: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  action: {
    minHeight: 56,
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
  actionOn: {
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
  actionLabel: { ...typography.body, flex: 1, color: colors.textPrimary },

  actions: { gap: spacing.md },
  actionsWide: { flexDirection: 'row' },
  actionMain: { flex: 1.4 },
  actionSide: { flex: 1 },
});
