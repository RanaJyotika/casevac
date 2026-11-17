/**
 * Casualty history — everything this tablet knows about one casualty, for the
 * Casualty History screen (opened from Home → My Recent Records).
 *
 *   - who: identity from the downloaded directory (PAT-… / patient UUID) or
 *     the field registration (TEMP-…); falls back to the record's label.
 *   - this evacuation: one step per stage, from the assessment to the
 *     transfer to the next team, with when and by whom each was saved.
 *   - every evacuation of this casualty on this tablet (history entries).
 *
 * Read only and never invented: a stage that was not saved is "pending", a
 * value not recorded stays null.
 */
import {
  getAssessmentStore,
  type AssessmentStore,
  type InitialAssessment,
} from '../evacuation/assessment';
import {
  getEvacuationStore,
  MODE_LABEL,
  PROCEDURE_LABEL,
  type EvacuationRecord,
  type EvacuationStore,
} from '../evacuation/evacuation';
import {
  getHandoverStore,
  PLACE_MEANING,
  type HandoverRecord,
  type HandoverStore,
} from '../evacuation/handover';
import {
  getInterventionsStore,
  type InterventionsRecord,
  type InterventionsStore,
} from '../evacuation/interventions';
import { getActiveIdentityDirectory } from '../identity/provisioningStore';
import type {
  BloodGroup,
  IdentityDirectory,
  RhFactor,
} from '../identity/types';
import {
  getTransferLog,
  type SentTransfer,
  type TransferLog,
} from '../transfer/transferLog';
import { getFieldRegistry, type FieldRegistry } from './fieldRegistry';
import {
  getPatientHistoryStore,
  type HistoryEntry,
  type PatientHistoryStore,
} from './historyStore';
import type { EvacuationStage, TriageCategory } from '../../types';

export type JourneyStepKey =
  | 'ASSESSMENT'
  | 'INTERVENTIONS'
  | 'HANDOVER'
  | 'EVACUATION'
  | 'TRANSFER';

export interface JourneyStep {
  key: JourneyStepKey;
  title: string;
  /** false = not saved yet (pending). */
  done: boolean;
  /** When the step was saved (or the transfer sent); null while pending. */
  at: string | null;
  /** User ID of the medic who saved it; null while pending. */
  by: string | null;
  /** One line of what was recorded, e.g. "Gunshot · 2 injuries". */
  detail: string | null;
  /** Triage recorded at this step, when there is one. */
  triage: TriageCategory | null;
}

export interface CasualtyIdentity {
  /** PAT-… / TEMP-… shown to medics. */
  displayId: string;
  /** null = unidentified casualty. */
  name: string | null;
  rank: string | null;
  unit: string | null;
  /** "B+", "O−"… or null when unknown. */
  blood: string | null;
  /** Where the details came from. */
  source: 'DIRECTORY' | 'FIELD_REGISTRATION' | 'RECORD';
}

export interface CasualtyHistory {
  identity: CasualtyIdentity;
  /** The evacuation that was opened; null if this tablet no longer has it. */
  current: {
    assessmentId: string;
    stage: EvacuationStage;
    steps: JourneyStep[];
    /** Latest triage across the steps (evacuation → interventions → assessment). */
    triage: TriageCategory | null;
    /** Mechanisms of injury recorded in the assessment. */
    mechanisms: string[];
  } | null;
  /** Every evacuation of this casualty on this tablet, newest first. */
  evacuations: HistoryEntry[];
}

/* --------------------------------- Pure --------------------------------- */

const RH_SIGN: Record<RhFactor, string> = {
  UNKNOWN: '',
  POSITIVE: '+',
  NEGATIVE: '−',
};

export function formatBlood(group: BloodGroup, rh: RhFactor): string | null {
  return group === 'UNKNOWN' ? null : `${group}${RH_SIGN[rh]}`;
}

/** "Name (ID)" as stored on records → name and ID. */
export function parsePatientLabel(label: string): {
  name: string | null;
  id: string | null;
} {
  const match = /^(.*) \(([^()]*)\)$/.exec(label.trim());
  if (!match) {
    return { name: label.trim() || null, id: null };
  }
  const name = match[1].trim();
  return {
    name: name && name !== 'Unidentified casualty' ? name : null,
    id: match[2].trim() || null,
  };
}

const join = (parts: Array<string | null | undefined | false>) =>
  parts.filter(Boolean).join(' · ') || null;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** Same rule as the Home dashboard: the last step saved decides the stage. */
export function stageOf(parts: {
  handover: HandoverRecord | null;
  evacuation: EvacuationRecord | null;
}): EvacuationStage {
  return parts.evacuation
    ? 'HANDED_OVER'
    : parts.handover
    ? 'IN_TRANSFER'
    : 'AWAITING_PICKUP';
}

/**
 * One evacuation, stage by stage. Pure: the screen and the tests both use it.
 * The transfer step appears only once the evacuation is complete (it is
 * offered from Evacuation Completed).
 */
export function buildJourney(parts: {
  assessment: InitialAssessment;
  interventions: InterventionsRecord | null;
  handover: HandoverRecord | null;
  evacuation: EvacuationRecord | null;
  transfer: SentTransfer | null;
}): JourneyStep[] {
  const { assessment: a, interventions: r, handover: h, evacuation: e } = parts;
  const t = parts.transfer;

  const steps: JourneyStep[] = [
    {
      key: 'ASSESSMENT',
      title: 'Casualty assessment',
      done: true,
      at: a.recordedAt,
      by: a.recordedBy,
      detail: join([
        a.incident.mechanisms.length ? a.incident.mechanisms.join(', ') : null,
        a.incident.injuryCount !== null &&
          plural(a.incident.injuryCount, 'injury', 'injuries'),
        a.conscious ? 'Conscious' : 'Not conscious',
      ]),
      triage: a.incident.status,
    },
    {
      key: 'INTERVENTIONS',
      title: 'Interventions & triage',
      done: !!r,
      at: r?.recordedAt ?? null,
      by: r?.recordedBy ?? null,
      detail: r
        ? join([
            r.interventions.bleedingMethods.length
              ? r.interventions.bleedingMethods.join(', ')
              : null,
            r.interventions.medications.length
              ? plural(
                  r.interventions.medications.length,
                  'medicine',
                  'medicines',
                )
              : null,
            r.triage.provisionalDiagnosis || null,
          ])
        : null,
      triage: r?.triage.category ?? null,
    },
    {
      key: 'HANDOVER',
      title: 'Handover details',
      done: !!h,
      at: h?.recordedAt ?? null,
      by: h?.recordedBy ?? null,
      detail: h
        ? join([
            `${h.place} — ${PLACE_MEANING[h.place]}`,
            h.officer.fullName || null,
          ])
        : null,
      triage: null,
    },
    {
      key: 'EVACUATION',
      title: 'Evacuation',
      done: !!e,
      at: e?.recordedAt ?? null,
      by: e?.recordedBy ?? null,
      detail: e
        ? [
            e.procedure ? PROCEDURE_LABEL[e.procedure] : '',
            e.mode ? MODE_LABEL[e.mode] : '',
          ]
            .filter(Boolean)
            .join(' · ') || null
        : null,
      triage: e?.condition ?? null,
    },
  ];

  if (e) {
    steps.push({
      key: 'TRANSFER',
      title: 'Handed to next team',
      done: !!t,
      at: t?.sentAt ?? null,
      by: null,
      detail: t
        ? join([
            t.channel === 'BLUETOOTH' ? 'Bluetooth' : 'QR',
            t.status === 'RECEIVED'
              ? `Receipt confirmed${
                  t.receiverName ? ` by ${t.receiverName}` : ''
                }`
              : 'Sent — receipt not confirmed yet',
          ])
        : 'Not sent to the next team from this tablet',
      triage: null,
    });
  }
  return steps;
}

/* -------------------------------- Loading ------------------------------- */

export interface CasualtyHistorySources {
  assessments?: AssessmentStore;
  interventions?: InterventionsStore;
  handovers?: HandoverStore;
  evacuations?: EvacuationStore;
  transfers?: TransferLog;
  history?: PatientHistoryStore;
  directory?: IdentityDirectory;
  fieldRegistry?: FieldRegistry;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Directory first (scanned soldiers), then field registration, then label. */
export async function resolveIdentity(
  keys: readonly string[],
  fallback: { casualtyId: string; label: string | null },
  sources: Pick<CasualtyHistorySources, 'directory' | 'fieldRegistry'> = {},
): Promise<CasualtyIdentity> {
  const directory = sources.directory ?? getActiveIdentityDirectory();
  try {
    for (const key of keys) {
      const p = UUID.test(key)
        ? await directory.findPatient(key.toLowerCase())
        : /^PAT-/i.test(key)
        ? await directory.findPatientByDisplayId(key)
        : null;
      if (p) {
        return {
          displayId: p.displayId,
          name: p.fullName,
          rank: p.rank || null,
          unit: p.unit || null,
          blood: formatBlood(p.bloodGroup, p.rhFactor),
          source: 'DIRECTORY',
        };
      }
    }
    const tempId = keys.find(k => /^TEMP-/i.test(k));
    if (tempId) {
      const f = await (sources.fieldRegistry ?? getFieldRegistry()).find(
        tempId,
      );
      if (f) {
        return {
          displayId: f.tempId,
          name: f.fullName,
          rank: f.rank || null,
          unit: f.unit || null,
          blood: formatBlood(f.bloodGroup, f.rhFactor),
          source: 'FIELD_REGISTRATION',
        };
      }
    }
  } catch {
    // Directory / registry unreadable: fall back to what the record says.
  }
  const parsed = fallback.label ? parsePatientLabel(fallback.label) : null;
  return {
    displayId: fallback.casualtyId,
    name: parsed?.name ?? null,
    rank: null,
    unit: null,
    blood: null,
    source: 'RECORD',
  };
}

export async function loadCasualtyHistory(
  target: {
    casualtyId: string;
    assessmentId?: string;
    /** Keys from the dashboard row; the assessment's keys are added. */
    patientKeys?: readonly string[];
  },
  sources: CasualtyHistorySources = {},
): Promise<CasualtyHistory> {
  const assessment = target.assessmentId
    ? await (sources.assessments ?? getAssessmentStore()).get(
        target.assessmentId,
      )
    : null;

  const keys = [
    ...new Set(
      [
        ...(target.patientKeys ?? []),
        ...(assessment?.patientKeys ?? []),
        target.casualtyId,
      ].filter(Boolean),
    ),
  ];

  let current: CasualtyHistory['current'] = null;
  if (assessment) {
    const [interventions, handover, evacuation, transfer] = await Promise.all([
      (sources.interventions ?? getInterventionsStore()).findByAssessment(
        assessment.id,
      ),
      (sources.handovers ?? getHandoverStore()).findByAssessment(assessment.id),
      (sources.evacuations ?? getEvacuationStore()).findByAssessment(
        assessment.id,
      ),
      (sources.transfers ?? getTransferLog()).latestFor(assessment.id),
    ]);
    current = {
      assessmentId: assessment.id,
      stage: stageOf({ handover, evacuation }),
      steps: buildJourney({
        assessment,
        interventions,
        handover,
        evacuation,
        transfer,
      }),
      triage:
        evacuation?.condition ??
        interventions?.triage.category ??
        assessment.incident.status ??
        null,
      mechanisms: assessment.incident.mechanisms,
    };
  }

  const [identity, evacuations] = await Promise.all([
    resolveIdentity(
      keys,
      {
        casualtyId: target.casualtyId,
        label: assessment?.patientLabel ?? null,
      },
      sources,
    ),
    (sources.history ?? getPatientHistoryStore()).listFor(keys),
  ]);

  return { identity, current, evacuations };
}
