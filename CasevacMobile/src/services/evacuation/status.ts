/**
 * Where an evacuation stands, from the records saved on this tablet (never
 * from history titles):
 *   Prepare Evacuation (9) saved → HANDED_OVER
 *   Handover Details (8) saved  → IN_TRANSIT (not handed over)
 *   otherwise                   → NOT_HANDED_OVER
 * plus whether the record has reached the next team's tablet.
 */
import { getEvacuationStore, type EvacuationStore } from './evacuation';
import { getHandoverStore, type HandoverStore } from './handover';
import { getAssessmentStore, type AssessmentStore } from './assessment';
import { getInterventionsStore } from './interventions';
import type { TriageCategory } from '../../types';
import { getTransferLog, type TransferLog } from '../transfer/transferLog';

export type EvacuationStage = 'NOT_HANDED_OVER' | 'IN_TRANSIT' | 'HANDED_OVER';

export interface EvacuationStatus {
  stage: EvacuationStage;
  /** Delivery to the next team's tablet, from this tablet's transfer log. */
  transfer: { kind: 'RECEIVED'; receiverId: string } | { kind: 'SENT' } | null;
}

export const STAGE_TEXT: Record<EvacuationStage, string> = {
  HANDED_OVER: 'Handed over',
  IN_TRANSIT: 'In transit · not handed over',
  NOT_HANDED_OVER: 'Not handed over',
};

/** Stage and latest triage of open evacuations, for the patient tabs. */
export async function loadTabInfo(
  assessmentIds: string[],
): Promise<
  Record<string, { stage: EvacuationStage; triage: TriageCategory | null }>
> {
  if (assessmentIds.length === 0) {
    return {};
  }
  const [assessments, interventions, handovers, evacuations] =
    await Promise.all([
      getAssessmentStore().list(),
      getInterventionsStore().list(),
      getHandoverStore().list(),
      getEvacuationStore().list(),
    ]);
  const out: Record<
    string,
    { stage: EvacuationStage; triage: TriageCategory | null }
  > = {};
  for (const id of assessmentIds) {
    const a = assessments.find(x => x.id === id);
    if (!a) {
      continue;
    }
    const r = [...interventions].reverse().find(x => x.assessmentId === id);
    const e = [...evacuations].reverse().find(x => x.assessmentId === id);
    out[id] = {
      stage: e
        ? 'HANDED_OVER'
        : handovers.some(h => h.assessmentId === id)
        ? 'IN_TRANSIT'
        : 'NOT_HANDED_OVER',
      triage: e?.condition ?? r?.triage.category ?? a.incident.status ?? null,
    };
  }
  return out;
}

/** Status for each history entry that is an evacuation (keyed by its ID). */
export async function loadEvacuationStatuses(
  ids: string[],
  stores: {
    assessments?: AssessmentStore;
    handovers?: HandoverStore;
    evacuations?: EvacuationStore;
    log?: TransferLog;
  } = {},
): Promise<Record<string, EvacuationStatus>> {
  const [assessments, handovers, evacuations, sent] = await Promise.all([
    (stores.assessments ?? getAssessmentStore()).list(),
    (stores.handovers ?? getHandoverStore()).list(),
    (stores.evacuations ?? getEvacuationStore()).list(),
    (stores.log ?? getTransferLog()).sent(),
  ]);
  const wanted = new Set(ids);
  const handedOver = new Set(evacuations.map(e => e.assessmentId));
  const inTransit = new Set(handovers.map(h => h.assessmentId));
  const out: Record<string, EvacuationStatus> = {};
  for (const a of assessments) {
    if (!wanted.has(a.id)) {
      continue;
    }
    const mine = sent.filter(s => s.assessmentId === a.id);
    const received = mine.find(s => s.status === 'RECEIVED');
    out[a.id] = {
      stage: handedOver.has(a.id)
        ? 'HANDED_OVER'
        : inTransit.has(a.id)
        ? 'IN_TRANSIT'
        : 'NOT_HANDED_OVER',
      transfer: received
        ? { kind: 'RECEIVED', receiverId: received.receiverId ?? '' }
        : mine.length
        ? { kind: 'SENT' }
        : null,
    };
  }
  return out;
}
