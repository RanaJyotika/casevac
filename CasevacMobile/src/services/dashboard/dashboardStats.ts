/**
 * Home dashboard figures (SCREEN_SPECIFICATIONS.md M02), computed from a list
 * of casualty summaries. Pure functions: the data source can change (records
 * saved on this tablet today, synced backend later) without touching the
 * screen.
 */
import type { EvacuationStage, TriageCategory } from '../../types';
import { MOI_OPTIONS } from '../evacuation/assessment';

/** The six companies (client example names — confirm with client). */
export const COMPANIES = [
  'Alpha',
  'Bravo',
  'Charlie',
  'Delta',
  'Echo',
  'Foxtrot',
] as const;
export type Company = (typeof COMPANIES)[number];

export const TRIAGE_ORDER: readonly TriageCategory[] = [
  'RED',
  'YELLOW',
  'GREEN',
  'BLACK',
];

export const STAGE_ORDER: readonly EvacuationStage[] = [
  'AWAITING_PICKUP',
  'IN_TRANSFER',
  'HANDED_OVER',
  'COMPLETED',
];

export const STAGE_LABEL: Record<EvacuationStage, string> = {
  AWAITING_PICKUP: 'Awaiting pickup',
  IN_TRANSFER: 'In transit',
  HANDED_OVER: 'Handed over',
  COMPLETED: 'Completed',
};

export interface CasualtySummary {
  /** Patient display ID (PAT-…) or temporary ID (TEMP-…). */
  casualtyId: string;
  /** null for unidentified (temporary) casualties — never guessed. */
  name: string | null;
  temporary: boolean;
  /** null when not recorded (evacuation records do not capture it yet). */
  company: Company | null;
  /** null until a triage category has been recorded. */
  triage: TriageCategory | null;
  stage: EvacuationStage;
  /** ISO-8601 UTC time of the last recorded update. */
  updatedAt: string;
  /** ISO-8601 UTC time of injury (drives "time since injury"); null if not recorded. */
  injuredAt: string | null;
  /** User ID of the medic who started the record, e.g. MED-00001. */
  recordedBy: string;
  /** The evacuation behind this row (its assessment), for Continue. */
  assessmentId?: string;
  /**
   * Mechanisms of injury recorded in the assessment ("Other" is stored as
   * its description). Empty / absent when not recorded.
   */
  mechanisms?: string[];
}

/** Injury rows, in the order of the assessment form, then the fallbacks. */
export const INJURY_TYPES: readonly string[] = [...MOI_OPTIONS];
export const INJURY_NOT_RECORDED = 'Not recorded';

export interface InjuryBreakdown {
  /** A mechanism of injury, "Other" or "Not recorded". */
  injury: string;
  counts: TriageCounts;
  /** Casualties of this injury type not yet triaged. */
  untriaged: number;
  total: number;
}

export type TriageCounts = Record<TriageCategory, number>;

export interface CompanyBreakdown {
  company: Company;
  counts: TriageCounts;
  total: number;
}

export interface DashboardStats {
  total: number;
  byTriage: TriageCounts;
  byCompany: CompanyBreakdown[];
  /**
   * Casualties by type of injury (mechanism). A casualty with several
   * mechanisms counts once in each; none recorded → "Not recorded".
   */
  byInjury: InjuryBreakdown[];
  byStage: Record<EvacuationStage, number>;
  /** Not yet completed. */
  activeEvacuations: number;
  /** Awaiting pickup or in transfer — clinical handover not yet done. */
  pendingHandover: number;
  completedEvacuations: number;
  /** Most recently updated first. */
  recent: CasualtySummary[];
}

const emptyTriage = (): TriageCounts => ({
  RED: 0,
  YELLOW: 0,
  GREEN: 0,
  BLACK: 0,
});

export function computeDashboardStats(
  casualties: readonly CasualtySummary[],
  recentLimit = 6,
): DashboardStats {
  const byTriage = emptyTriage();
  const byStage: Record<EvacuationStage, number> = {
    AWAITING_PICKUP: 0,
    IN_TRANSFER: 0,
    HANDED_OVER: 0,
    COMPLETED: 0,
  };
  const companyCounts = new Map<Company, TriageCounts>(
    COMPANIES.map(c => [c, emptyTriage()]),
  );

  for (const c of casualties) {
    byStage[c.stage] += 1;
    // Not yet triaged / company not recorded: counted in the total only.
    if (!c.triage) {
      continue;
    }
    byTriage[c.triage] += 1;
    const counts = c.company ? companyCounts.get(c.company) : undefined;
    if (counts) {
      counts[c.triage] += 1;
    }
  }

  const byCompany = COMPANIES.map(company => {
    const counts = companyCounts.get(company) ?? emptyTriage();
    return {
      company,
      counts,
      total: TRIAGE_ORDER.reduce((sum, t) => sum + counts[t], 0),
    };
  });

  const byInjury = injuryBreakdown(casualties);

  const recent = [...casualties]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, recentLimit);

  return {
    total: casualties.length,
    byTriage,
    byCompany,
    byInjury,
    byStage,
    activeEvacuations: casualties.length - byStage.COMPLETED,
    pendingHandover: byStage.AWAITING_PICKUP + byStage.IN_TRANSFER,
    completedEvacuations: byStage.COMPLETED,
    recent,
  };
}

/** Casualties per injury type, split by triage (see DashboardStats.byInjury). */
export function injuryBreakdown(
  casualties: readonly CasualtySummary[],
): InjuryBreakdown[] {
  const known = new Set(INJURY_TYPES);
  const rows = new Map<string, InjuryBreakdown>(
    [...INJURY_TYPES, INJURY_NOT_RECORDED].map(injury => [
      injury,
      { injury, counts: emptyTriage(), untriaged: 0, total: 0 },
    ]),
  );
  for (const c of casualties) {
    const types = new Set(
      (c.mechanisms ?? [])
        .filter(m => m && m.trim())
        .map(m => (known.has(m) ? m : 'Other')),
    );
    if (types.size === 0) {
      types.add(INJURY_NOT_RECORDED);
    }
    for (const t of types) {
      const row = rows.get(t)!;
      row.total += 1;
      if (c.triage) {
        row.counts[c.triage] += 1;
      } else {
        row.untriaged += 1;
      }
    }
  }
  const list = [...rows.values()];
  // "Not recorded" only when it applies; every injury type always listed.
  return list.filter(r => r.injury !== INJURY_NOT_RECORDED || r.total > 0);
}

/* ------------------------- Per-medic and alerts ------------------------- */

/** Casualty records started by this medic (the "My casualties" view). */
export function recordsBy(
  casualties: readonly CasualtySummary[],
  userId: string,
): CasualtySummary[] {
  const id = userId.trim().toUpperCase();
  return casualties
    .filter(c => c.recordedBy.toUpperCase() === id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** "18 min", "2 h 05" — elapsed time for at-a-glance reading. */
export function formatElapsed(fromIso: string, now: number): string {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(fromIso).getTime()) / 60_000),
  );
  if (Number.isNaN(minutes)) {
    return '—';
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(
    2,
    '0',
  )}`;
}

/** Records this medic still has to act on (not yet handed over). */
export function activeEvacuationsBy(
  casualties: readonly CasualtySummary[],
  userId: string,
): CasualtySummary[] {
  return recordsBy(casualties, userId).filter(
    c => c.stage === 'AWAITING_PICKUP' || c.stage === 'IN_TRANSFER',
  );
}

export type HomeAlertKind = 'red-wait' | 'handover' | 'unsynced' | 'reassess';

export interface HomeAlert {
  id: HomeAlertKind;
  tone: 'critical' | 'warning';
  title: string;
  detail: string;
  /** Label of the alert's action button. */
  action: string;
}

/** RED casualties still at the point of injury after this long are flagged. */
export const RED_WAIT_LIMIT_MIN = 30;
/** RED / YELLOW casualties not updated for this long are due reassessment. */
export const REASSESS_AFTER_MIN = 30;

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * Alerts derived only from recorded data — nothing is invented.
 * Life-critical first, then handovers, then housekeeping.
 */
export function computeAlerts(
  casualties: readonly CasualtySummary[],
  now: number,
  unsyncedRecords: number,
): HomeAlert[] {
  const minutesSince = (iso: string) =>
    (now - new Date(iso).getTime()) / 60_000;
  const open = (c: CasualtySummary) =>
    c.stage === 'AWAITING_PICKUP' || c.stage === 'IN_TRANSFER';

  const alerts: HomeAlert[] = [];

  const waiting = casualties.filter(
    (c): c is CasualtySummary & { injuredAt: string } =>
      c.triage === 'RED' &&
      c.stage === 'AWAITING_PICKUP' &&
      c.injuredAt !== null &&
      minutesSince(c.injuredAt) > RED_WAIT_LIMIT_MIN,
  );
  if (waiting.length > 0) {
    const oldest = [...waiting].sort((a, b) =>
      a.injuredAt.localeCompare(b.injuredAt),
    )[0];
    alerts.push({
      id: 'red-wait',
      tone: 'critical',
      title: 'RED awaiting pickup',
      detail:
        waiting.length === 1
          ? `${oldest.name ?? 'Unidentified'} · ${
              oldest.casualtyId
            } · ${formatElapsed(oldest.injuredAt, now)} since injury`
          : `${plural(
              waiting.length,
              'casualty',
              'casualties',
            )} waiting over ${RED_WAIT_LIMIT_MIN} min since injury.`,
      action: 'Open',
    });
  }

  const inTransfer = casualties.filter(c => c.stage === 'IN_TRANSFER').length;
  if (inTransfer > 0) {
    alerts.push({
      id: 'handover',
      tone: 'critical',
      title: 'Handover pending',
      detail: `${plural(
        inTransfer,
        'casualty',
        'casualties',
      )} in transit — complete Prepare Evacuation to finish the handover.`,
      action: 'Open',
    });
  }

  if (unsyncedRecords > 0) {
    alerts.push({
      id: 'unsynced',
      tone: 'warning',
      title: 'Unsynced records',
      detail: `${plural(
        unsyncedRecords,
        'record',
        'records',
      )} will sync when connected.`,
      action: 'Sync now',
    });
  }

  const reassess = casualties.filter(
    c =>
      (c.triage === 'RED' || c.triage === 'YELLOW') &&
      open(c) &&
      minutesSince(c.updatedAt) >= REASSESS_AFTER_MIN,
  ).length;
  if (reassess > 0) {
    alerts.push({
      id: 'reassess',
      tone: 'warning',
      title: 'Reassessment due',
      detail: `${plural(
        reassess,
        'casualty',
        'casualties',
      )} due for reassessment (≥ ${REASSESS_AFTER_MIN} min).`,
      action: 'Review',
    });
  }

  return alerts;
}
