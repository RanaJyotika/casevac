/**
 * Home dashboard figures (SCREEN_SPECIFICATIONS.md M02), computed from a list
 * of casualty summaries. Pure functions: the data source can change (demo
 * dataset today, encrypted local storage next, synced backend later)
 * without touching the screen.
 */
import type { EvacuationStage, TriageCategory } from '../../types';

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
  IN_TRANSFER: 'In transfer',
  HANDED_OVER: 'Handed over',
  COMPLETED: 'Completed',
};

export interface CasualtySummary {
  /** Patient display ID (PAT-…) or temporary ID (TEMP-…). */
  casualtyId: string;
  /** null for unidentified (temporary) casualties — never guessed. */
  name: string | null;
  temporary: boolean;
  company: Company;
  triage: TriageCategory;
  stage: EvacuationStage;
  /** ISO-8601 UTC time of the last recorded update. */
  updatedAt: string;
  /** ISO-8601 UTC time of injury (drives "time since injury"). */
  injuredAt: string;
  /** User ID of the medic who started the record, e.g. MED-00001. */
  recordedBy: string;
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
    byTriage[c.triage] += 1;
    byStage[c.stage] += 1;
    const counts = companyCounts.get(c.company);
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

  const recent = [...casualties]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, recentLimit);

  return {
    total: casualties.length,
    byTriage,
    byCompany,
    byStage,
    activeEvacuations: casualties.length - byStage.COMPLETED,
    pendingHandover: byStage.AWAITING_PICKUP + byStage.IN_TRANSFER,
    completedEvacuations: byStage.COMPLETED,
    recent,
  };
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
    c =>
      c.triage === 'RED' &&
      c.stage === 'AWAITING_PICKUP' &&
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
      )} ready for the next echelon.`,
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
