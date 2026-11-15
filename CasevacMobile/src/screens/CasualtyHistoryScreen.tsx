/**
 * Casualty History (read only).
 *
 * Opens when a medic taps a row in Home → My Recent Records. Shows, for one
 * casualty, everything saved on this tablet:
 *
 *   1. Who — ID, name, rank, unit, blood group (directory or field
 *      registration; the record's label when neither is on this tablet).
 *   2. This evacuation — a timeline from the casualty assessment to the
 *      hand-over to the next team, each step with when / by whom / what.
 *      "View full report" opens every recorded field; an evacuation that is
 *      not handed over yet can be continued.
 *   3. All evacuations of this casualty — each opens its full report.
 *
 * Nothing is edited here and nothing is invented: steps not saved read
 * "Pending", values not recorded read "Not recorded".
 */
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  StatusPill,
  TriagePill,
} from '../components';
import {
  loadCasualtyHistory,
  type CasualtyHistory,
  type CasualtyHistorySources,
  type JourneyStep,
} from '../services/patients/casualtyHistory';
import type { HistoryEntry } from '../services/patients/historyStore';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import { formatDateTime } from '../utils/format';

interface CasualtyHistoryScreenProps {
  casualtyId: string;
  /** The evacuation tapped on Home (its assessment). */
  assessmentId?: string;
  patientKeys?: string[];
  onBack: () => void;
  /** Opens the read-only full report of one evacuation. */
  onOpenReport: (entry: HistoryEntry) => void;
  /** Reopens an evacuation that is not handed over yet at its next step. */
  onContinue?: (assessmentId: string) => void;
  /** Injected in tests; default to this tablet's stores. */
  sources?: CasualtyHistorySources;
}

const NOT_RECORDED = 'Not recorded';

function Fact({ label, value }: { label: string; value: string | null }) {
  return (
    <View
      style={styles.fact}
      accessible
      accessibilityLabel={`${label}: ${value ?? NOT_RECORDED}`}
    >
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={[styles.factValue, !value && styles.muted]}>
        {value ?? NOT_RECORDED}
      </Text>
    </View>
  );
}

function Step({ step, last }: { step: JourneyStep; last: boolean }) {
  const when = step.at ? formatDateTime(step.at) : null;
  return (
    <View
      style={styles.step}
      accessible
      accessibilityLabel={[
        step.title,
        step.done ? 'done' : 'pending',
        when,
        step.by ? `by ${step.by}` : null,
        step.detail,
      ]
        .filter(Boolean)
        .join(', ')}
    >
      <View style={styles.rail}>
        <View style={[styles.node, step.done ? styles.nodeDone : styles.nodeTodo]}>
          {step.done ? (
            <Icon name="check" size={16} color={colors.onPrimary} strokeWidth={3} />
          ) : null}
        </View>
        {!last ? (
          <View style={[styles.line, step.done && styles.lineDone]} />
        ) : null}
      </View>
      <View style={styles.stepBody}>
        <View style={styles.stepHead}>
          <Text style={[styles.stepTitle, !step.done && styles.muted]}>
            {step.title}
          </Text>
          {step.triage ? <TriagePill category={step.triage} /> : null}
        </View>
        <Text style={styles.stepMeta}>
          {step.done
            ? [when, step.by ? `by ${step.by}` : null]
                .filter(Boolean)
                .join(' · ')
            : 'Pending'}
        </Text>
        {step.detail ? (
          <Text style={styles.stepDetail}>{step.detail}</Text>
        ) : null}
      </View>
    </View>
  );
}

function EvacuationRow({
  entry,
  current,
  onPress,
}: {
  entry: HistoryEntry;
  current: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.title}, ${formatDateTime(entry.at)}, by ${
        entry.recordedBy
      }${current ? ', this evacuation' : ''}`}
      accessibilityHint="Opens the full read-only report"
      style={({ pressed }) => [styles.evacRow, pressed && styles.pressed]}
    >
      <View style={styles.flex}>
        <View style={styles.stepHead}>
          <Text style={styles.evacTitle}>{entry.title}</Text>
          {current ? (
            <View style={styles.currentTag}>
              <Text style={styles.currentTagText}>This evacuation</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.stepMeta}>
          {formatDateTime(entry.at)} · by {entry.recordedBy}
        </Text>
        {entry.detail ? (
          <Text style={styles.stepDetail} numberOfLines={2}>
            {entry.detail}
          </Text>
        ) : null}
      </View>
      <Icon name="chevronRight" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}

export function CasualtyHistoryScreen({
  casualtyId,
  assessmentId,
  patientKeys,
  onBack,
  onOpenReport,
  onContinue,
  sources,
}: CasualtyHistoryScreenProps) {
  // undefined = loading, null = could not be read.
  const [data, setData] = useState<CasualtyHistory | null | undefined>(
    undefined,
  );
  const keysString = (patientKeys ?? []).join('|');

  useEffect(() => {
    let cancelled = false;
    loadCasualtyHistory(
      {
        casualtyId,
        assessmentId,
        patientKeys: keysString ? keysString.split('|') : [],
      },
      sources,
    )
      .then(result => !cancelled && setData(result))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [casualtyId, assessmentId, keysString, sources]);

  const identity = data?.identity;
  const current = data?.current ?? null;
  const currentEntry = current
    ? data?.evacuations.find(e => e.id === current.assessmentId)
    : undefined;

  const openCurrentReport = () => {
    if (!current) {
      return;
    }
    const first = current.steps[0];
    onOpenReport(
      currentEntry ?? {
        id: current.assessmentId,
        patientKeys: patientKeys ?? [casualtyId],
        at: first.at ?? new Date().toISOString(),
        title: 'Evacuation record',
        recordedBy: first.by ?? '',
      },
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={`${APP_BRAND} · CASUALTY HISTORY`}
        title={identity?.name ?? identity?.displayId ?? casualtyId}
        onBack={onBack}
        right={current ? <StatusPill stage={current.stage} /> : undefined}
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {data === undefined ? (
          <Text style={styles.stepMeta}>Loading…</Text>
        ) : data === null ? (
          <Notice
            tone="warning"
            title="History could not be loaded"
            message="The records on this tablet could not be read. Go back and try again."
          />
        ) : (
          <>
            {/* 1 — Who */}
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                Casualty
              </Text>
              <View style={styles.facts}>
                <Fact label="Casualty ID" value={data.identity.displayId} />
                <Fact
                  label="Name"
                  value={data.identity.name ?? 'Unidentified casualty'}
                />
                <Fact label="Rank" value={data.identity.rank} />
                <Fact label="Unit" value={data.identity.unit} />
                <Fact label="Blood group" value={data.identity.blood} />
                {current?.mechanisms.length ? (
                  <Fact
                    label="Type of injury"
                    value={current.mechanisms.join(', ')}
                  />
                ) : null}
              </View>
              {data.identity.source === 'RECORD' ? (
                <Text style={styles.stepMeta}>
                  Identity details are not on this tablet — showing what the
                  evacuation record says.
                </Text>
              ) : null}
            </View>

            {/* 2 — This evacuation, stage by stage */}
            {current ? (
              <View style={styles.card}>
                <View style={styles.stepHead}>
                  <Text style={[styles.cardTitle, styles.flex]} accessibilityRole="header">
                    This evacuation
                  </Text>
                  {current.triage ? (
                    <TriagePill category={current.triage} />
                  ) : null}
                </View>
                <View>
                  {current.steps.map((s, i) => (
                    <Step
                      key={s.key}
                      step={s}
                      last={i === current.steps.length - 1}
                    />
                  ))}
                </View>
                <View style={styles.actions}>
                  <PrimaryButton
                    title="View full report"
                    onPress={openCurrentReport}
                    accessibilityHint="Opens every recorded field of this evacuation, read only"
                  />
                  {current.stage !== 'HANDED_OVER' && onContinue ? (
                    <SecondaryButton
                      title="Continue evacuation"
                      onPress={() => onContinue(current.assessmentId)}
                      accessibilityHint="Reopens this evacuation at its next unsaved step"
                    />
                  ) : null}
                </View>
              </View>
            ) : (
              <Notice
                tone="warning"
                title="Evacuation record not on this tablet"
                message="Only the history summary below is stored here."
              />
            )}

            {/* 3 — Every evacuation of this casualty */}
            <View style={styles.card}>
              <Text style={styles.cardTitle} accessibilityRole="header">
                All evacuations ({data.evacuations.length})
              </Text>
              {data.evacuations.length === 0 ? (
                <Text style={styles.stepMeta}>
                  No previous record found on this tablet.
                </Text>
              ) : (
                data.evacuations.map((e, i) => (
                  <View key={e.id} style={i > 0 ? styles.rowLine : undefined}>
                    <EvacuationRow
                      entry={e}
                      current={e.id === current?.assessmentId}
                      onPress={() => onOpenReport(e)}
                    />
                  </View>
                ))
              )}
            </View>
          </>
        )}
        <SecondaryButton title="Back to Home" onPress={onBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flex: 1, backgroundColor: '#F3F5F8' },
  content: { padding: spacing.lg, gap: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  muted: { color: colors.textSecondary, fontWeight: '400' },
  pressed: { opacity: 0.6 },

  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },

  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  fact: { flexBasis: 180, flexGrow: 1, gap: 2 },
  factLabel: { ...typography.caption, color: colors.textSecondary },
  factValue: { ...typography.label, fontWeight: '700', color: colors.textPrimary },

  step: { flexDirection: 'row', gap: spacing.md },
  rail: { width: 28, alignItems: 'center' },
  node: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeDone: { backgroundColor: colors.primary },
  nodeTodo: {
    borderWidth: 2,
    borderColor: colors.borderStrong,
    backgroundColor: colors.background,
  },
  line: { flex: 1, width: 2, minHeight: 16, backgroundColor: colors.divider },
  lineDone: { backgroundColor: colors.primary },
  stepBody: { flex: 1, minWidth: 0, gap: 2, paddingBottom: spacing.lg },
  stepHead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepTitle: { ...typography.label, fontWeight: '700', color: colors.textPrimary },
  stepMeta: { ...typography.caption, color: colors.textSecondary },
  stepDetail: { ...typography.body, color: colors.textPrimary },

  actions: { gap: spacing.sm },

  rowLine: { borderTopWidth: 1, borderTopColor: colors.divider },
  evacRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  evacTitle: { ...typography.label, fontWeight: '700', color: colors.textPrimary },
  currentTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  currentTagText: { ...typography.caption, fontWeight: '700', color: colors.textPrimary },
});
