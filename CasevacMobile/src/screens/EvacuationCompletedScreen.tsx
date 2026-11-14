/**
 * M19 — Evacuation Completed (client screen 10).
 *
 * Opens after Save on Prepare Evacuation (9). Confirms the record is
 * complete and handed over (read only), shows whether it has reached the next
 * team's tablet yet, and offers:
 *   Hand over to next team (QR / Bluetooth) · Summary of total evacuation ·
 *   Track case · Generate report · Record next casualty
 * Delivery is shown only as confirmed by the receiving tablet's receipt —
 * never "sent" as "received".
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
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
  EvacuationBadge,
  Icon,
  Notice,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  TriagePill,
} from '../components';
import {
  MODE_LABEL,
  getEvacuationStore,
  type EvacuationRecord,
  type EvacuationStore,
} from '../services/evacuation/evacuation';
import {
  getPatientHistoryStore,
  type HistoryEntry,
  type PatientHistoryStore,
} from '../services/patients/historyStore';
import {
  getTransferLog,
  type SentTransfer,
  type TransferLog,
} from '../services/transfer/transferLog';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import { formatDateTime } from '../utils/format';
import type { AssessmentPatient } from './AssessmentScreen';

interface EvacuationCompletedScreenProps {
  patient: AssessmentPatient;
  assessmentId: string;
  onHandOver: () => void;
  onSummary: (entry: HistoryEntry) => void;
  onNextCasualty: () => void;
  onHome: () => void;
  /** Injected in tests. */
  evacuationStore?: EvacuationStore;
  historyStore?: PatientHistoryStore;
  log?: TransferLog;
}

const comingNext = (title: string, what: string) =>
  Alert.alert(
    `${title} — coming next`,
    `${what} is built in the next phase. No data has been changed.`,
  );

export function EvacuationCompletedScreen({
  patient,
  assessmentId,
  onHandOver,
  onSummary,
  onNextCasualty,
  onHome,
  evacuationStore,
  historyStore,
  log,
}: EvacuationCompletedScreenProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const transfers = useMemo(() => log ?? getTransferLog(), [log]);
  const [evacuation, setEvacuation] = useState<EvacuationRecord | null>(null);
  const [transfer, setTransfer] = useState<SentTransfer | null | undefined>(
    undefined,
  );
  const [entry, setEntry] = useState<HistoryEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      (evacuationStore ?? getEvacuationStore()).findByAssessment(assessmentId),
      transfers.latestFor(assessmentId),
      (historyStore ?? getPatientHistoryStore()).get(assessmentId),
    ])
      .then(([e, t, h]) => {
        if (!cancelled) {
          setEvacuation(e);
          setTransfer(t);
          setEntry(h);
        }
      })
      .catch(() => !cancelled && setTransfer(null));
    return () => {
      cancelled = true;
    };
  }, [assessmentId, evacuationStore, historyStore, transfers]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={APP_BRAND}
        title="Evacuation Completed"
        onBack={onHome}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.done}>
          <View style={styles.doneIcon}>
            <Icon name="check" size={48} color={colors.onPrimary} />
          </View>
          <Text style={styles.doneTitle} accessibilityRole="header">
            Evacuation Completed
          </Text>
          <Text style={styles.lead}>
            The casualty evacuation record is complete, saved on this tablet and
            read only.
          </Text>
          <Text style={styles.patientName}>
            {patient.name ?? 'Unidentified casualty'} · {patient.idLabel}{' '}
            {patient.id}
          </Text>
          <View style={styles.badges}>
            <EvacuationBadge kind="HANDED_OVER" />
            {evacuation ? <TriagePill category={evacuation.condition} /> : null}
            {evacuation ? (
              <StatusBadge label={MODE_LABEL[evacuation.mode]} tone="neutral" />
            ) : null}
          </View>
        </View>

        {/* Has it reached the next team's tablet? */}
        {transfer === undefined ? null : transfer?.status === 'RECEIVED' ? (
          <View style={styles.transferOk}>
            <Icon name="check" size={22} color={colors.success} />
            <Text style={styles.transferText}>
              Record received by{' '}
              {transfer.receiverName ? `${transfer.receiverName} ` : ''}(
              {transfer.receiverId}) ·{' '}
              {transfer.receivedAt ? formatDateTime(transfer.receivedAt) : ''} ·{' '}
              {transfer.channel === 'QR' ? 'QR' : 'Bluetooth'}
            </Text>
          </View>
        ) : transfer?.status === 'SENT' ? (
          <Notice
            tone="warning"
            title="Sent — not yet confirmed"
            message="The next team’s tablet has not confirmed receipt. Hand over again or confirm their receipt code."
          />
        ) : (
          <Notice
            tone="warning"
            title="Not yet on the next team’s tablet"
            message="Hand the record over by QR or Bluetooth so the next team can continue care."
          />
        )}

        <PrimaryButton
          title="Hand over to next team"
          onPress={onHandOver}
          accessibilityHint="Send this record to the next team's tablet by QR or Bluetooth"
        />

        <View style={[styles.grid, wide && styles.gridWide]}>
          <View style={wide ? styles.cell : undefined}>
            <SecondaryButton
              title="Summary of total evacuation"
              icon={<Icon name="clock" size={20} color={colors.primary} />}
              onPress={() =>
                entry
                  ? onSummary(entry)
                  : comingNext('Summary', 'The evacuation summary')
              }
            />
          </View>
          <View style={wide ? styles.cell : undefined}>
            <SecondaryButton
              title="Track case"
              icon={<Icon name="mapPin" size={20} color={colors.primary} />}
              onPress={() => comingNext('Track case', 'Case tracking')}
            />
          </View>
          <View style={wide ? styles.cell : undefined}>
            <SecondaryButton
              title="Generate report"
              icon={<Icon name="cloudUp" size={20} color={colors.primary} />}
              onPress={() => comingNext('Generate report', 'Report generation')}
            />
          </View>
          <View style={wide ? styles.cell : undefined}>
            <SecondaryButton
              title="Record next casualty"
              icon={<Icon name="userPlus" size={20} color={colors.primary} />}
              onPress={onNextCasualty}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: spacing.lg, gap: spacing.lg },
  lead: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  patientName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  done: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  doneIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
  },
  doneTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  transferOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: layout.borderWidth,
    borderColor: colors.success,
    backgroundColor: '#E7F5EC',
  },
  transferText: {
    ...typography.label,
    flex: 1,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  grid: { gap: spacing.md },
  gridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { flexBasis: '45%', flexGrow: 1 },
});
