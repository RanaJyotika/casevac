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
