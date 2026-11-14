/**
 * Historical report (read only).
 *
 * Opens when a medic taps an entry under "Previous history" on Patient
 * Identification (screen 3). A previous record belongs to an evacuation that
 * is already closed — the casualty was handed over — so it can be read but
 * never changed here: no inputs, no save. New findings go in a new
 * assessment (Start Evacuation).
 *
 * Shows the full record when this tablet has it — the casualty assessment
 * (screens 4 + 5) or the interventions & triage (screens 6 + 7) — in the
 * same section order as the form. For entries with no stored report, shows the
 * history summary and says the detail is not on this tablet. Never invents
 * values: anything not recorded reads "Not recorded".
 */
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
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
  MARCH_ITEMS,
  formatTime12,
  getAssessmentStore,
  type AssessmentStore,
  type InitialAssessment,
} from '../services/evacuation/assessment';
import {
  TRIAGE_PRIORITY,
  getInterventionsStore,
  type InterventionsRecord,
  type InterventionsStore,
} from '../services/evacuation/interventions';
import {
  MODE_LABEL,
  getEvacuationStore,
  type EvacuationRecord,
  type EvacuationStore,
} from '../services/evacuation/evacuation';
import {
  NEXT_ACTION_LABEL,
  PLACE_MEANING,
  getHandoverStore,
  type HandoverRecord,
  type HandoverStore,
} from '../services/evacuation/handover';
import type { HistoryEntry } from '../services/patients/historyStore';
import { BodyDiagram } from '../components/BodyDiagram';
import { OfficerCard } from './HandoverScreen';
import { colors, layout, radius, spacing, typography } from '../theme/tokens';
import { formatDateTime } from '../utils/format';

interface HistoryReportScreenProps {
  entry: HistoryEntry;
  onBack: () => void;
  /** Injected in tests; default to this tablet's stores. */
  store?: AssessmentStore;
  interventionsStore?: InterventionsStore;
  handoverStore?: HandoverStore;
  evacuationStore?: EvacuationStore;
  /** Offered once the evacuation is complete (handed over). */
  onHandOver?: (assessmentId: string) => void;
}

const NOT_RECORDED = 'Not recorded';

const withUnit = (value: number | null, unit: string) =>
  value === null ? NOT_RECORDED : `${value} ${unit}`;

/* -------------------------------- Pieces -------------------------------- */

function Section({
  letter,
  title,
  children,
}: {
  letter: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.letter}>
          <Text style={styles.letterText}>{letter}</Text>
        </View>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const text = typeof value === 'string' ? value : undefined;
  return (
    <View
      style={styles.row}
      accessible={text !== undefined}
      accessibilityLabel={text !== undefined ? `${label}: ${text}` : undefined}
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowValueBox}>
        {typeof value === 'string' ? (
          <Text
            style={[styles.rowValue, value === NOT_RECORDED && styles.muted]}
          >
            {value}
          </Text>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

function Report({ a }: { a: InitialAssessment }) {
  const occurred = a.incident.occurredAt
    ? formatDateTime(a.incident.occurredAt)
    : NOT_RECORDED;
  const v = a.vitals;
  const bp =
    v.bpSys !== null && v.bpDia !== null
      ? `${v.bpSys}/${v.bpDia} mmHg`
      : NOT_RECORDED;
  const se =
    v.systemicExam === 'RECORDABLE'
      ? 'Recordable'
      : v.systemicExam === 'NOT_RECORDABLE'
      ? 'Not recordable'
      : NOT_RECORDED;

  return (
    <>
      <Row
        label="Conscious and able to provide details"
        value={a.conscious ? 'Yes' : 'No'}
      />

      <Section letter="A" title="Incident Details">
        <Row label="Date and time of occurrence" value={occurred} />
        <Row
          label="Time of injury"
          value={
            a.incident.injuryTime
              ? formatTime12(a.incident.injuryTime)
              : NOT_RECORDED
          }
        />
        <Row
          label="Mechanism of injury (MOI)"
          value={
            a.incident.mechanisms.length
              ? a.incident.mechanisms.join(', ')
              : NOT_RECORDED
          }
        />
        <Row
          label="Number of injuries"
          value={
            a.incident.injuryCount === null
              ? NOT_RECORDED
              : String(a.incident.injuryCount)
          }
        />
        <Row
          label="Initial casualty status"
          value={
            a.incident.status ? (
              <TriagePill category={a.incident.status} />
            ) : (
              NOT_RECORDED
            )
          }
        />
      </Section>

      <Section letter="B" title="MARCH Assessment">
        {MARCH_ITEMS.map(item => {
          const checked = a.march.checked.includes(item.key);
          return (
            <View
              key={item.key}
              style={styles.march}
              accessible
              accessibilityLabel={`${item.key} – ${item.label}: ${
                checked ? 'ticked' : 'not ticked'
              }`}
            >
              <View style={[styles.box, checked && styles.boxOn]}>
                {checked ? (
                  <Icon name="check" size={16} color={colors.onPrimary} />
                ) : null}
              </View>
              <Text style={styles.marchLetter}>{item.key}</Text>
              <Text style={[styles.marchLabel, !checked && styles.muted]}>
                – {item.label}
              </Text>
            </View>
          );
        })}
        <Row
          label="Additional injury"
          value={a.march.additionalInjury || NOT_RECORDED}
        />
      </Section>

      <Section letter="C" title="Vitals">
        <Row label="HR" value={withUnit(v.hr, 'bpm')} />
        <Row label="RR" value={withUnit(v.rr, '/min')} />
        <Row label="BP" value={bp} />
        <Row
          label="SpO₂"
          value={v.spo2 === null ? NOT_RECORDED : `${v.spo2}%`}
        />
        <Row label="Temp" value={withUnit(v.temp, '°C')} />
        <Row label="S/E (systemic examination)" value={se} />
        {v.systemicExam === 'RECORDABLE' ? (
          <>
            <Row label="RS (respiratory)" value={v.rs || NOT_RECORDED} />
            <Row label="CVS (cardiovascular)" value={v.cvs || NOT_RECORDED} />
            <Row label="P/A (per abdomen)" value={v.pa || NOT_RECORDED} />
            <Row label="CNS (nervous system)" value={v.cns || NOT_RECORDED} />
          </>
        ) : null}
      </Section>

      <Section letter="D" title="Additional Information">
        <Row label="Details" value={a.additionalInfo || NOT_RECORDED} />
      </Section>
    </>
  );
}

/* -------------------------------- Screen -------------------------------- */

const yesNo = (v: boolean | null) =>
  v === null ? NOT_RECORDED : v ? 'Yes' : 'No';
const OXYGEN_LABEL = { YES: 'Yes', NO: 'No', NA: 'N/A' } as const;

function InterventionsReport({ r }: { r: InterventionsRecord }) {
  const i = r.interventions;
  const t = r.triage;
  return (
    <>
      <Section letter="A" title="Initial Interventions">
        <Row
          label="Massive bleeding control performed"
          value={yesNo(i.bleedingControl)}
        />
        {i.bleedingMethods.length ? (
          <Row label="Method" value={i.bleedingMethods.join(', ')} />
        ) : null}
        {i.bleedingMethods.includes('Tourniquet') ? (
          <Row
            label="Tourniquet — time of application"
            value={
              i.tourniquetTime ? formatTime12(i.tourniquetTime) : NOT_RECORDED
            }
          />
        ) : null}
        <Row label="Airway intervention performed" value={yesNo(i.airway)} />
        <Row label="Breathing supported" value={yesNo(i.breathing)} />
        <Row label="Splinting performed" value={yesNo(i.splinting)} />
        <Row
          label="O₂ administered"
          value={i.oxygen ? OXYGEN_LABEL[i.oxygen] : NOT_RECORDED}
        />
        <Row label="Any medication given" value={yesNo(i.medicationGiven)} />
        {i.medications.map((m, n) => (
          <Row
            key={n}
            label={`Medicine ${n + 1}`}
            value={[m.name, m.dose, m.time ? `at ${formatTime12(m.time)}` : '']
              .filter(Boolean)
              .join(' · ')}
          />
        ))}
      </Section>

      <Section letter="B" title="Casualty Condition (Triage)">
        <Row
          label={`Triage priority ${TRIAGE_PRIORITY[t.category]}`}
          value={<TriagePill category={t.category} />}
        />
        {t.initialStatus && t.initialStatus !== t.category ? (
          <Row
            label="Status in the assessment"
            value={<TriagePill category={t.initialStatus} />}
          />
        ) : null}
        <View style={styles.diagram}>
          <Text style={styles.diagramLabel}>Location of injury</Text>
          <BodyDiagram value={r.injuryLocations} />
        </View>
        <Row
          label="Provisional diagnosis"
          value={t.provisionalDiagnosis || NOT_RECORDED}
        />
      </Section>

      <Section letter="C" title="Additional Remarks">
        <Row label="Remarks" value={r.remarks || NOT_RECORDED} />
      </Section>
    </>
  );
}

/** One evacuation: the assessment (4 + 5) and/or interventions (6 + 7). */
interface Loaded {
  assessment: InitialAssessment | null;
  interventions: InterventionsRecord | null;
  handover: HandoverRecord | null;
  evacuation: EvacuationRecord | null;
}

function EvacuationReport({ e }: { e: EvacuationRecord }) {
  return (
    <>
      <Section letter="A" title="Date & Time of Evacuation">
        <Row
          label="Evacuated"
          value={e.evacuatedAt ? formatDateTime(e.evacuatedAt) : NOT_RECORDED}
        />
      </Section>
      <Section letter="B" title="Assisted by Medical Officer (MO)">
        <Row label="Assisted by MO" value={e.assistedByMo ? 'Yes' : 'No'} />
      </Section>
      <Section letter="C" title="Assisted by Nursing Assistant (NA)">
        <Row label="Assisted by NA" value={e.assistedByNa ? 'Yes' : 'No'} />
      </Section>
      <Section letter="D" title="Patient Condition During Evacuation">
        <Row
          label={`Triage priority ${TRIAGE_PRIORITY[e.condition]}`}
          value={<TriagePill category={e.condition} />}
        />
        <Row label="Condition notes" value={e.conditionNotes || NOT_RECORDED} />
      </Section>
      <Section letter="E" title="Mode of Evacuation">
        <Row label="Mode" value={MODE_LABEL[e.mode]} />
      </Section>
    </>
  );
}

function HandoverReport({ h }: { h: HandoverRecord }) {
  return (
    <>
      <Section letter="A" title="Place of Initiation">
        <Row label="Place" value={`${h.place} — ${PLACE_MEANING[h.place]}`} />
      </Section>
      <Section letter="B" title="Date & Time of Initiation">
        <Row
          label="Initiated"
          value={h.initiatedAt ? formatDateTime(h.initiatedAt) : NOT_RECORDED}
        />
      </Section>
      <Section letter="C" title="Details of Medical Officer">
        <View style={styles.officerBox}>
          <OfficerCard officer={h.officer} />
        </View>
      </Section>
      <Section letter="D" title="Next Course of Action">
        <Row
          label="Next course of action"
          value={
            h.nextAction === 'OTHER'
              ? `Other — ${h.nextActionOther}`
              : NEXT_ACTION_LABEL[h.nextAction]
          }
        />
      </Section>
    </>
  );
}

function PartHeading({
  title,
  recordedAt,
  recordedBy,
}: {
  title: string;
  recordedAt: string;
  recordedBy: string;
}) {
  return (
    <View style={styles.part}>
      <Text style={styles.partTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.metaText}>
        Recorded {formatDateTime(recordedAt)} by {recordedBy}
      </Text>
    </View>
  );
}

export function HistoryReportScreen({
  entry,
  onBack,
  store,
  interventionsStore,
  handoverStore,
  evacuationStore,
  onHandOver,
}: HistoryReportScreenProps) {
  // undefined = loading, null = no detailed report on this tablet.
  const [loaded, setLoaded] = useState<Loaded | null | undefined>(undefined);
  const report = loaded?.assessment ?? loaded?.interventions;

  useEffect(() => {
    let cancelled = false;
    // The entry may point at either half; load the other half through the
    // link (interventions.assessmentId) so the whole evacuation is shown.
    const find = async (): Promise<Loaded | null> => {
      const assessments = store ?? getAssessmentStore();
      const interventions = interventionsStore ?? getInterventionsStore();
      let a = await assessments.get(entry.id);
      let r = a
        ? await interventions.findByAssessment(a.id)
        : await interventions.get(entry.id);
      if (!a && r?.assessmentId) {
        a = await assessments.get(r.assessmentId);
      }
      if (a && !r) {
        r = await interventions.findByAssessment(a.id);
      }
      const h = a
        ? await (handoverStore ?? getHandoverStore()).findByAssessment(a.id)
        : null;
      const e = a
        ? await (evacuationStore ?? getEvacuationStore()).findByAssessment(a.id)
        : null;
      return a || r
        ? { assessment: a, interventions: r, handover: h, evacuation: e }
        : null;
    };
    find()
      .then(found => {
        if (!cancelled) {
          setLoaded(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [entry.id, store, interventionsStore, handoverStore, evacuationStore]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <AppHeader
        eyebrow={`${APP_BRAND} · PREVIOUS HISTORY`}
        title={entry.title}
        onBack={onBack}
        right={
          loaded?.evacuation ? (
            <EvacuationBadge
              kind="HANDED_OVER"
              label="Handed over · Read only"
            />
          ) : loaded?.handover ? (
            <EvacuationBadge kind="IN_TRANSIT" label="In transit · Read only" />
          ) : loaded?.assessment ? (
            <EvacuationBadge
              kind="NOT_HANDED_OVER"
              label="Not handed over · Read only"
            />
          ) : (
            <StatusBadge label="Read only" tone="neutral" />
          )
        }
      />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.banner} accessible>
          <Icon name="lock" size={22} color={colors.textSecondary} />
          <View style={styles.flex}>
            <Text style={styles.bannerTitle}>
              Historical report — read only
            </Text>
            <Text style={styles.bannerText}>
              This record is from a previous evacuation and cannot be changed.
              Record new findings with Start Evacuation.
            </Text>
          </View>
        </View>

        <View style={styles.meta}>
          {report?.patientLabel ? (
            <Text style={styles.patient}>{report.patientLabel}</Text>
          ) : null}
          {!loaded ? (
            <Text style={styles.metaText}>
              Recorded {formatDateTime(entry.at)} by {entry.recordedBy}
            </Text>
          ) : null}
        </View>

        {loaded === undefined ? (
          <Text style={styles.metaText}>Loading…</Text>
        ) : loaded ? (
          <>
            {loaded.assessment ? (
              <>
                <PartHeading
                  title="Casualty Assessment"
                  recordedAt={loaded.assessment.recordedAt}
                  recordedBy={loaded.assessment.recordedBy}
                />
                <Report a={loaded.assessment} />
              </>
            ) : null}
            {loaded.interventions ? (
              <>
                <PartHeading
                  title="Interventions & Triage"
                  recordedAt={loaded.interventions.recordedAt}
                  recordedBy={loaded.interventions.recordedBy}
                />
                <InterventionsReport r={loaded.interventions} />
              </>
            ) : loaded.assessment ? (
              <Notice
                tone="warning"
                title="Interventions & triage not recorded"
                message="Only the casualty assessment was saved for this evacuation."
              />
            ) : null}
            {loaded.handover ? (
              <>
                <PartHeading
                  title="Handover"
                  recordedAt={loaded.handover.recordedAt}
                  recordedBy={loaded.handover.recordedBy}
                />
                <HandoverReport h={loaded.handover} />
              </>
            ) : loaded.assessment ? (
              <Notice
                tone="warning"
                title="Not handed over yet"
                message="No handover was saved for this evacuation on this tablet."
              />
            ) : null}
            {loaded.evacuation ? (
              <>
                <PartHeading
                  title="Evacuation"
                  recordedAt={loaded.evacuation.recordedAt}
                  recordedBy={loaded.evacuation.recordedBy}
                />
                <EvacuationReport e={loaded.evacuation} />
              </>
            ) : loaded.handover ? (
              <Notice
                tone="warning"
                title="In transit — evacuation not prepared yet"
                message="Prepare Evacuation was not saved, so the handover is not complete."
              />
            ) : null}
          </>
        ) : (
          <>
            {entry.detail ? (
              <View style={styles.section}>
                <View style={styles.sectionBody}>
                  <Row label="Summary" value={entry.detail} />
                </View>
              </View>
            ) : null}
            <Notice
              tone="warning"
              title="No detailed report on this tablet"
              message="Only the summary of this record is stored here."
            />
          </>
        )}

        {loaded?.evacuation && loaded.assessment && onHandOver ? (
          <PrimaryButton
            title="Hand over to next team"
            onPress={() => onHandOver(loaded.assessment!.id)}
            accessibilityHint="Send this record to the next team's tablet by QR or Bluetooth"
          />
        ) : null}
        <SecondaryButton title="Back to patient" onPress={onBack} />
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
  muted: { color: colors.textSecondary, fontWeight: '400' },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: layout.borderWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  bannerTitle: {
    ...typography.label,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bannerText: { ...typography.caption, color: colors.textSecondary },

  meta: { gap: 2, paddingHorizontal: spacing.xs },
  officerBox: { paddingVertical: spacing.sm },
  part: {
    gap: 2,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: 2,
    borderTopColor: colors.divider,
  },
  partTitle: { ...typography.sectionTitle, color: colors.textMuted },
  patient: {
    ...typography.label,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  metaText: { ...typography.caption, color: colors.textSecondary },

  section: {
    borderRadius: radius.lg + 4,
    borderWidth: layout.borderWidth,
    borderColor: colors.divider,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  sectionHead: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: layout.borderWidth,
    borderBottomColor: colors.divider,
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
  sectionBody: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },

  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  rowLabel: {
    ...typography.caption,
    flexBasis: 220,
    flexGrow: 0,
    color: colors.textSecondary,
  },
  rowValueBox: { flex: 1, minWidth: 160, alignItems: 'flex-start' },
  diagram: { gap: spacing.sm, paddingVertical: spacing.sm },
  diagramLabel: { ...typography.caption, color: colors.textSecondary },
  rowValue: {
    ...typography.label,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  march: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 40,
  },
  box: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  marchLetter: {
    width: 20,
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  marchLabel: { ...typography.body, flex: 1, color: colors.textPrimary },
});
