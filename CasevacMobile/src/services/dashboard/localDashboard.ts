/**
 * Home dashboard data from the evacuation records saved on this tablet —
 * the casualty assessment (screens 4 + 5), interventions & triage
 * (screens 6 + 7), handover (8) and prepare evacuation (9). No demo or
 * fictional records: an empty tablet shows an empty dashboard.
 *
 * One row per casualty (their latest evacuation). Values not recorded stay
 * empty (company, injury time, triage) — never guessed.
 */
import {
  getAssessmentStore,
  type AssessmentStore,
  type InitialAssessment,
} from '../evacuation/assessment';
import {
  getInterventionsStore,
  type InterventionsRecord,
  type InterventionsStore,
} from '../evacuation/interventions';
import {
  getEvacuationStore,
  type EvacuationRecord,
  type EvacuationStore,
} from '../evacuation/evacuation';
import {
  getHandoverStore,
  type HandoverRecord,
  type HandoverStore,
} from '../evacuation/handover';
import type { CasualtySummary } from './dashboardStats';

export interface SyncStatus {
  /** Last successful sync with the base server; null = never synced. */
  lastSyncedAt: string | null;
  /** Records saved on this tablet and not yet sent to the server. */
  queued: number;
}

export interface DashboardData {
  casualties: CasualtySummary[];
  source: 'LOCAL';
  loadedAt: string;
  sync: SyncStatus;
}

const UNIDENTIFIED = 'Unidentified casualty';

/** "Name (ID)" as stored on records → name and ID. */
function parseLabel(label: string): { name: string | null; id: string | null } {
  const match = /^(.*) \(([^()]*)\)$/.exec(label.trim());
  if (!match) {
    return { name: label.trim() || null, id: null };
  }
  const name = match[1].trim();
  return {
    name: name && name !== UNIDENTIFIED ? name : null,
    id: match[2].trim() || null,
  };
}

/** The ID medics read: PAT-… or TEMP-… when known. */
function displayId(keys: string[], labelId: string | null): string {
  return (
    keys.find(k => /^(PAT|TEMP)-/i.test(k)) ?? labelId ?? keys[0] ?? 'Unknown'
  ).toUpperCase();
}

/** Pure: evacuation records → one summary per casualty (latest evacuation). */
export function buildCasualtySummaries(
  assessments: readonly InitialAssessment[],
  interventions: readonly InterventionsRecord[],
  handovers: readonly HandoverRecord[] = [],
  evacuations: readonly EvacuationRecord[] = [],
): CasualtySummary[] {
  const handedOver = new Map(handovers.map(h => [h.assessmentId, h]));
  const evacuated = new Map(evacuations.map(e => [e.assessmentId, e]));
  const byAssessment = new Map<string, InterventionsRecord>();
  const unlinked: InterventionsRecord[] = [];
  for (const r of interventions) {
    if (r.assessmentId) {
      byAssessment.set(r.assessmentId, r); // later records win
    } else {
      unlinked.push(r);
    }
  }

  const summaries: CasualtySummary[] = [];
  const add = (
    base: InitialAssessment | InterventionsRecord,
    a: InitialAssessment | null,
    r: InterventionsRecord | null,
  ) => {
    const { name, id } = parseLabel(base.patientLabel);
    const casualtyId = displayId(base.patientKeys, id);
    const h = a ? handedOver.get(a.id) : undefined;
    const e = a ? evacuated.get(a.id) : undefined;
    const times = [
      a?.recordedAt,
      r?.recordedAt,
      h?.recordedAt,
      e?.recordedAt,
    ].filter((t): t is string => !!t);
    summaries.push({
      casualtyId,
      name,
      temporary: casualtyId.startsWith('TEMP-'),
      company: null,
      // Latest recorded condition wins.
      triage:
        e?.condition ?? r?.triage.category ?? a?.incident.status ?? null,
      // By the last step saved: 9 → Handed over (read only), 8 → In
      // transit, earlier → Awaiting pickup.
      stage: e ? 'HANDED_OVER' : h ? 'IN_TRANSFER' : 'AWAITING_PICKUP',
      updatedAt: times.sort().reverse()[0] ?? base.recordedAt,
      injuredAt: a?.incident.occurredAt ?? null,
      recordedBy: base.recordedBy,
      assessmentId: a?.id,
      mechanisms: a?.incident.mechanisms ?? [],
    });
  };
  for (const a of assessments) {
    add(a, a, byAssessment.get(a.id) ?? null);
  }
  for (const r of unlinked) {
    add(r, null, r);
  }

  // One row per casualty: keep the latest evacuation.
  const latest = new Map<string, CasualtySummary>();
  for (const s of summaries) {
    const seen = latest.get(s.casualtyId);
    if (!seen || s.updatedAt > seen.updatedAt) {
      latest.set(s.casualtyId, s);
    }
  }
  return [...latest.values()].sort((x, y) =>
    y.updatedAt.localeCompare(x.updatedAt),
  );
}

/** Data source for the Home dashboard: this tablet's saved records only. */
export async function loadDashboardData(
  stores: {
    assessments?: AssessmentStore;
    interventions?: InterventionsStore;
    handovers?: HandoverStore;
    evacuations?: EvacuationStore;
  } = {},
): Promise<DashboardData> {
  const [assessments, interventions, handovers, evacuations] =
    await Promise.all([
      (stores.assessments ?? getAssessmentStore()).list(),
      (stores.interventions ?? getInterventionsStore()).list(),
      (stores.handovers ?? getHandoverStore()).list(),
      (stores.evacuations ?? getEvacuationStore()).list(),
    ]);
  const casualties = buildCasualtySummaries(
    assessments,
    interventions,
    handovers,
    evacuations,
  );
  return {
    casualties,
    // Server sync is not built yet: every saved record stays queued here.
    sync: { lastSyncedAt: null, queued: casualties.length },
    source: 'LOCAL',
    loadedAt: new Date().toISOString(),
  };
}
