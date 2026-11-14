/**
 * M04 — Patient Identification (screen 3).
 *
 * Opens after a wristband scan (signature verified), a manual ID search, or a
 * field registration. Shows who the casualty is — photo, name, rank, gender,
 * age, blood group, unit — and the two next steps:
 *   Start Evacuation · Register New Patient
 * When this tablet has no details for the wristband / ID, it says so plainly
 * and makes Register New Patient the main action. Never invents details.
 *
 * Keeps the facts a medic must not confuse visibly separate:
 *   the wristband is genuine (signature) · not revoked as far as this tablet
 *   knows (directory date) · how the identity was found (scan / typed / field).
 */
import React, { useEffect, useState } from 'react';
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
import {
  AppHeader,
  Icon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  SectionPanel,
  StatusBadge,
} from '../components';
import {
  SERVER_STATUS_LABEL,
  useServerStatus,
} from '../services/connectivity/useServerStatus';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type {
  BloodGroup,
  PatientIdentity,
  RhFactor,
  Sex,
} from '../services/identity/types';
import type {
  FieldLink,
  FieldPatient,
  FieldRegistration,
} from '../services/patients/fieldRegistry';
import {
  getPatientHistoryStore,
  type HistoryEntry,
  type PatientHistoryStore,
} from '../services/patients/historyStore';
import type { VerifiedIdentification } from '../services/qr/identifyPatient';
import type { AssessmentPatient } from './AssessmentScreen';
import type { TransferIdentification } from './ReceivePatientScreen';
import {
  EvacuationBadge,
  type EvacuationBadgeKind,
} from '../components/evacuationBadges';
import {
  STAGE_TEXT,
  loadEvacuationStatuses,
  type EvacuationStatus,
} from '../services/evacuation/status';
import type { TransferPatient } from '../services/transfer/transferPackage';
import {
  colors,
  fonts,
  layout,
  radius,
  spacing,
  typography,
} from '../theme/tokens';
import { formatDateTime } from '../utils/format';

export type Identification =
  | VerifiedIdentification
  | ManualIdentification
  | FieldRegistration
  | TransferIdentification;

interface PatientIdentificationScreenProps {
  result: Identification;
  onBack: () => void;
  /** Opens Register New Patient, carrying what was scanned / typed. */
  onRegisterNew: (link: FieldLink) => void;
  /** Start Evacuation: opens the initial casualty assessment (screen 4). */
  onStartEvacuation: (patient: AssessmentPatient) => void;
  /** Opens a previous-history entry as a read-only report. */
  onOpenHistory: (entry: HistoryEntry) => void;
  /** Injected in tests; defaults to this tablet's history store. */
  historyStore?: PatientHistoryStore;
}

const BLOOD_LABEL: Record<BloodGroup, string> = {
  UNKNOWN: 'Unknown',
  A: 'A',
  B: 'B',
  AB: 'AB',
  O: 'O',
};
const RH_LABEL: Record<RhFactor, string> = {
  UNKNOWN: 'Rh unknown',
  POSITIVE: 'Rh positive',
  NEGATIVE: 'Rh negative',
};
const RH_SIGN: Record<RhFactor, string> = {
  UNKNOWN: '',
  POSITIVE: '+',
  NEGATIVE: '−',
};
const SEX_LABEL: Record<Sex, string> = {
  NOT_RECORDED: 'Not recorded',
  MALE: 'Male',
  FEMALE: 'Female',
};

/** One shape for directory patients and field registrations. */
interface PatientView {
  name: string | null;
  rank: string;
  idLabel: string;
  id: string;
  unit: string;
  sex: Sex;
  age: number | null;
  bloodGroup: BloodGroup;
  rhFactor: RhFactor;
  photo: string | null;
}

function ageFrom(dateOfBirth: string | null, now = new Date()): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  let age = now.getFullYear() - y;
  if (
    now.getMonth() + 1 < m ||
    (now.getMonth() + 1 === m && now.getDate() < d)
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
}

function fromDirectory(p: PatientIdentity): PatientView {
  return {
    name: p.fullName,
    rank: p.rank,
    idLabel: 'Patient ID',
    id: p.displayId,
    unit: p.unit,
    sex: p.sex,
    age: ageFrom(p.dateOfBirth),
    bloodGroup: p.bloodGroup,
    rhFactor: p.rhFactor,
    photo: p.photo,
  };
}

function fromField(p: FieldPatient): PatientView {
  return {
    name: p.fullName,
    rank: p.rank,
    idLabel: 'Temporary ID',
    id: p.tempId,
    unit: p.unit,
    sex: p.sex,
    age: p.age,
    bloodGroup: p.bloodGroup,
    rhFactor: p.rhFactor,
    photo: null,
  };
}

/** Status badges for one history row: handed over or not, and delivery. */
function historyBadges(
  status: EvacuationStatus | undefined,
  received: boolean,
): { kind: EvacuationBadgeKind; label: string }[] {
  const badges: { kind: EvacuationBadgeKind; label: string }[] = [];
  if (received) {
    badges.push({
      kind: 'RECEIVED_FROM',
      label: 'Received from another tablet',
    });
  }
  if (!status) {
    return badges;
  }
  badges.push({ kind: status.stage, label: STAGE_TEXT[status.stage] });
  if (status.transfer?.kind === 'RECEIVED') {
    badges.push({
      kind: 'RECEIVED_BY',
      label: `Received by ${status.transfer.receiverId}`,
    });
  } else if (status.transfer?.kind === 'SENT') {
    badges.push({
      kind: 'SENT_UNCONFIRMED',
      label: 'Sent to next team — not confirmed',
    });
  } else if (status.stage === 'HANDED_OVER') {
    badges.push({ kind: 'NOT_SENT', label: 'Not yet sent to next team' });
  }
  return badges;
}

/** A received casualty this tablet's directory does not know. */
function fromTransfer(p: TransferPatient): PatientView {
  return {
    name: p.name,
    rank: p.rank,
    idLabel: p.temporary ? 'Temporary ID' : 'Patient ID',
    id: p.displayId,
    unit: p.unit,
    sex: p.sex,
    age: p.age,
    bloodGroup: p.bloodGroup,
    rhFactor: p.rhFactor,
    photo: null,
  };
}

function initials(name: string | null): string {
  if (!name) {
    return '?';
  }
  const parts = name.split(/\s+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')
  ).toUpperCase();
}

/* -------------------------------- Pieces -------------------------------- */

function Fact({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View
      style={styles.fact}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function Photo({ photo, name }: { photo: string | null; name: string | null }) {
  return (
    <View style={styles.photo}>
      {photo ? (
        <Image
          source={{ uri: photo }}
          style={styles.photoImage}
          accessibilityLabel={`ID photo of ${name ?? 'the patient'}`}
        />
      ) : name ? (
        <Text
          style={styles.photoInitials}
          accessibilityLabel="No photo on file"
        >
          {initials(name)}
        </Text>
      ) : (
        <Icon name="user" size={56} color={colors.textSecondary} />
      )}
    </View>
  );
}

function PatientCard({ view, wide }: { view: PatientView; wide: boolean }) {
  const blood =
    view.bloodGroup === 'UNKNOWN'
      ? 'Unknown'
      : `${BLOOD_LABEL[view.bloodGroup]}${RH_SIGN[view.rhFactor]}`;
  return (
    <View style={[styles.patient, wide && styles.patientWide]}>
      <View style={styles.identity}>
        <Photo photo={view.photo} name={view.name} />
        <View style={styles.identityText}>
          <Text
            style={[styles.name, !view.name && styles.nameUnknown]}
            accessibilityRole="header"
          >
            {view.name ?? 'Unidentified casualty'}
          </Text>
          <Text style={styles.rank}>
            {[
              view.rank,
              view.age === null ? 'Age not recorded' : `${view.age} years`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          <Text style={styles.idLine}>
            {view.idLabel} <Text style={styles.mono}>{view.id}</Text>
          </Text>
        </View>
      </View>

      <View style={[styles.facts, wide && styles.factsWide]}>
        <View
          style={styles.bloodTile}
          accessible
          accessibilityLabel={`Blood group: ${BLOOD_LABEL[view.bloodGroup]} · ${
            RH_LABEL[view.rhFactor]
          }`}
        >
          <View style={styles.bloodHead}>
            <Icon name="droplet" size={18} color={colors.error} />
            <Text style={styles.bloodLabel}>Blood group</Text>
          </View>
          <Text style={styles.bloodValue}>{blood}</Text>
          <Text style={styles.bloodCaption}>
            {BLOOD_LABEL[view.bloodGroup]} · {RH_LABEL[view.rhFactor]}
          </Text>
        </View>
        <View style={styles.factGrid}>
          <Fact label="Rank / role" value={view.rank || 'Not recorded'} />
          <Fact label="Gender" value={SEX_LABEL[view.sex]} />
          <Fact label="Unit" value={view.unit || 'Not recorded'} />
        </View>
      </View>
    </View>
  );
}

/* --------------------------------- Screen --------------------------------- */

export function PatientIdentificationScreen({
  result,
  onBack,
  onRegisterNew,
  onStartEvacuation,
  onOpenHistory,
  historyStore,
}: PatientIdentificationScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const serverStatus = useServerStatus();

  const field = result.method === 'FIELD';
  const manual = result.method === 'MANUAL';
  const scanned = result.method === 'QR';
  const transferred = result.method === 'TRANSFER';

  const directoryPatient =
    result.method === 'MANUAL'
      ? result.patient
      : result.method === 'QR' && result.lookup.status === 'FOUND'
      ? result.lookup.patient
      : result.method === 'TRANSFER'
      ? result.directoryPatient
      : null;
  const view: PatientView | null =
    result.method === 'FIELD'
      ? fromField(result.patient)
      : directoryPatient
      ? fromDirectory(directoryPatient)
      : result.method === 'TRANSFER'
      ? fromTransfer(result.patient)
      : null;

  // Carried into Register New Patient only when this wristband / ID has no
  // details here; registering from a found patient is a different casualty.
  const link: FieldLink =
    result.method === 'QR'
      ? {
          credentialId: result.claims.credentialId,
          patientId: result.claims.patientId,
        }
      : result.method === 'MANUAL'
      ? { enteredId: result.enteredId }
      : {};

  // Every key this patient may be recorded under.
  const historyKeys: Array<string | null | undefined> =
    result.method === 'FIELD'
      ? [result.patient.tempId]
      : result.method === 'MANUAL'
      ? [result.patient.patientId, result.patient.displayId]
      : result.method === 'TRANSFER'
      ? [...result.patient.keys, result.patient.displayId]
      : [result.claims.patientId, directoryPatient?.displayId];
  const historyKeyString = historyKeys.filter(Boolean).join('|');
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [statuses, setStatuses] = useState<Record<string, EvacuationStatus>>(
    {},
  );
  useEffect(() => {
    let cancelled = false;
    (historyStore ?? getPatientHistoryStore())
      .listFor(historyKeyString.split('|'))
      .then(async entries => {
        if (!cancelled) {
          setHistory(entries);
        }
        // Status of each evacuation, from its saved records.
        const found = await loadEvacuationStatuses(entries.map(e => e.id));
        if (!cancelled) {
          setStatuses(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [historyKeyString, historyStore]);

  const startEvacuation = () =>
    onStartEvacuation({
      name: view?.name ?? null,
      idLabel: view?.idLabel ?? (scanned ? 'Wristband' : 'Entered ID'),
      id:
        view?.id ??
        (result.method === 'QR'
          ? result.claims.patientId.slice(0, 8).toUpperCase()
          : result.method === 'MANUAL'
          ? result.enteredId
          : ''),
      bloodGroup: view?.bloodGroup ?? 'UNKNOWN',
      rhFactor: view?.rhFactor ?? 'UNKNOWN',
      keys: historyKeys.filter((k): k is string => !!k),
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Patient Identification"
        onBack={onBack}
        right={
          <StatusBadge
            label={SERVER_STATUS_LABEL[serverStatus]}
            tone={serverStatus === 'online' ? 'success' : 'neutral'}
          />
        }
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* What is known, and how */}
        <View style={styles.badges}>
          {scanned ? (
            <StatusBadge label="Credential verified" tone="success" />
          ) : null}
          {manual ? (
            <>
              <StatusBadge label="Identified by manual ID" tone="warning" />
              <StatusBadge label="Wristband not verified" tone="warning" />
            </>
          ) : null}
          {transferred ? (
            <>
              <StatusBadge
                label="Received from another tablet"
                tone="success"
              />
              <StatusBadge label="Wristband not verified" tone="warning" />
              {result.patient.temporary ? (
                <StatusBadge label="Identity not verified" tone="warning" />
              ) : null}
            </>
          ) : field ? (
            <>
              <StatusBadge label="Registered on this tablet" tone="warning" />
              <StatusBadge label="Identity not verified" tone="warning" />
            </>
          ) : view ? (
            <StatusBadge label="Identity found on this tablet" tone="success" />
          ) : (
            <StatusBadge label="Details unavailable offline" tone="warning" />
          )}
        </View>

        {manual ? (
          <Notice
            tone="warning"
            title="Manual identification — wristband not verified"
            message={`This patient was found from the Patient ID typed in (${result.enteredId}). Confirm that the casualty is this person before recording care.`}
          />
        ) : null}
        {transferred ? (
          <Notice
            tone="warning"
            title="Received by transfer — confirm the casualty"
            message={`This record came from ${result.receivedFrom}, who gave initial care. Their records below are read only. Confirm the casualty is this person (scan the wristband if they have one), then use Start Evacuation to record your care.`}
          />
        ) : null}
        {view ? (
          <>
            <PatientCard view={view} wide={wide} />
            <View style={[styles.actions, wide && styles.actionsWide]}>
              <View style={wide ? styles.actionMain : undefined}>
                <PrimaryButton
                  title="Start Evacuation"
                  onPress={startEvacuation}
                  accessibilityHint="Opens the initial casualty assessment"
                />
              </View>
              <View style={wide ? styles.actionSide : undefined}>
                <SecondaryButton
                  title="Register New Patient"
                  icon={
                    <Icon name="userPlus" size={20} color={colors.primary} />
                  }
                  onPress={() => onRegisterNew({})}
                  accessibilityHint="Register a different casualty by hand"
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.missing}>
            <View style={styles.missingIcon}>
              <Icon name="user" size={40} color={colors.warning} />
            </View>
            <Text style={styles.missingTitle} accessibilityRole="header">
              {scanned
                ? 'Credential Verified — Patient Details Unavailable Offline'
                : 'No patient details on this tablet'}
            </Text>
            <Text style={styles.missingText}>
              {scanned
                ? 'The wristband signature is genuine, but this tablet has no identity record for it. Do not guess — register the casualty by hand so care can start now.'
                : 'Register the casualty by hand so care can start now.'}
            </Text>
            <View style={[styles.actions, wide && styles.actionsWide]}>
              <View style={wide ? styles.actionMain : undefined}>
                <PrimaryButton
                  title="Register New Patient"
                  onPress={() => onRegisterNew(link)}
                  accessibilityHint="Enter the casualty's details by hand"
                />
              </View>
              <View style={wide ? styles.actionSide : undefined}>
                <SecondaryButton
                  title="Start Evacuation"
                  onPress={startEvacuation}
                  accessibilityHint="Opens the initial casualty assessment without details"
                />
              </View>
            </View>
          </View>
        )}

        <SectionPanel
          title="Previous history"
          meta={history && history.length ? `${history.length}` : undefined}
        >
          {history === null ? (
            <Text style={styles.panelText}>Loading…</Text>
          ) : history.length === 0 ? (
            <Text style={styles.panelText}>No previous record found</Text>
          ) : (
            history.map((entry, i) => {
              const status = statuses[entry.id];
              const received = entry.id.startsWith('RCV-');
              const badges = historyBadges(status, received);
              return (
                <Pressable
                  key={entry.id}
                  onPress={() => onOpenHistory(entry)}
                  style={({ pressed }) => [
                    styles.historyRow,
                    i === history.length - 1 && styles.rowLast,
                    pressed && styles.historyPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateTime(entry.at)}: ${
                    entry.title
                  }${
                    badges.length
                      ? `, status ${badges.map(b => b.label).join(', ')}`
                      : ''
                  }${entry.detail ? `, ${entry.detail}` : ''}, by ${
                    entry.recordedBy
                  }`}
                  accessibilityHint="Opens the report, read only"
                >
                  <Text style={styles.historyWhen}>
                    {formatDateTime(entry.at)}
                  </Text>
                  <View style={styles.historyBody}>
                    <Text style={styles.historyTitle}>{entry.title}</Text>
                    {badges.length ? (
                      <View style={styles.historyBadges}>
                        {badges.map(b => (
                          <EvacuationBadge
                            key={b.label}
                            kind={b.kind}
                            label={b.label}
                          />
                        ))}
                      </View>
                    ) : null}
                    {entry.detail ? (
                      <Text style={styles.historyDetail}>{entry.detail}</Text>
                    ) : null}
                    <Text style={styles.historyBy}>
                      Recorded by {entry.recordedBy}
                    </Text>
                  </View>
                  <View style={styles.historyOpen}>
                    <Icon name="lock" size={16} color={colors.textSecondary} />
                    <Text style={styles.historyOpenText}>View</Text>
                    <Icon
                      name="chevronRight"
                      size={20}
                      color={colors.textSecondary}
                    />
                  </View>
                </Pressable>
              );
            })
          )}
        </SectionPanel>

        <Text style={styles.reminder}>
          {scanned
            ? 'A valid signature proves the registrar issued this wristband. Confirm that the casualty is the person wearing it.'
            : 'Confirm the casualty’s identity before recording care.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* --------------------------------- Styles --------------------------------- */

const PHOTO_SIZE = 132;

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
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },

  /* Patient card */
  patient: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  patientWide: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySurface,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
  },
  photoImage: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
  },
  photoInitials: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '700',
    color: colors.primary,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  nameUnknown: {
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  rank: {
    ...typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  idLine: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  facts: {
    gap: spacing.md,
  },
  factsWide: {
    flex: 1.3,
    flexDirection: 'row',
  },
  bloodTile: {
    minWidth: 150,
    justifyContent: 'center',
    gap: 2,
    padding: spacing.md,
    borderRadius: radius.md + 2,
    borderWidth: layout.borderWidth,
    borderColor: colors.errorBorder,
    backgroundColor: colors.errorSurface,
  },
  bloodHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bloodLabel: {
    ...typography.helper,
    fontWeight: '700',
    color: colors.error,
  },
  bloodValue: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    color: colors.error,
  },
  bloodCaption: {
    ...typography.helper,
    color: colors.textPrimary,
  },
  factGrid: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  fact: {
    flexGrow: 1,
    flexBasis: '45%',
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  factLabel: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  factValue: {
    ...typography.label,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  /* Actions */
  actions: {
    alignSelf: 'stretch',
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

  /* No details */
  missing: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.warningBorder,
    backgroundColor: colors.background,
  },
  missingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warningSurface,
  },
  missingTitle: {
    ...typography.heading,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  missingText: {
    ...typography.body,
    textAlign: 'center',
    color: colors.textSecondary,
    maxWidth: 640,
  },

  /* Details */
  rowLast: {
    borderBottomWidth: 0,
  },
  mono: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
  historyRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  historyWhen: {
    ...typography.caption,
    width: 170,
    color: colors.textSecondary,
  },
  historyBody: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyDetail: {
    ...typography.caption,
    color: colors.textPrimary,
  },
  historyBy: {
    ...typography.helper,
    color: colors.textSecondary,
  },
  historyPressed: {
    backgroundColor: colors.surface,
  },
  historyBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginVertical: 2,
  },
  historyOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 4,
  },
  historyOpenText: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  panelText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    padding: spacing.lg,
  },
  reminder: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
