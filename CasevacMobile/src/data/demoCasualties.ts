/**
 * SYNTHETIC DEMONSTRATION DATA ONLY — fictional casualties for the Home
 * dashboard until evacuation records are stored on the tablet (next phase).
 * The dashboard labels these figures "Demo data".
 */
import {
  COMPANIES,
  STAGE_ORDER,
  TRIAGE_ORDER,
  type CasualtySummary,
  type Company,
} from '../services/dashboard/dashboardStats';

/** Casualties per company, by triage category (RED, YELLOW, GREEN, BLACK). */
const DISTRIBUTION: Record<Company, [number, number, number, number]> = {
  Alpha: [2, 3, 3, 1],
  Bravo: [1, 2, 4, 0],
  Charlie: [2, 1, 2, 0],
  Delta: [1, 2, 2, 1],
  Echo: [0, 1, 3, 0],
  Foxtrot: [1, 2, 2, 0],
};

const NAMES = [
  'Arjun Mehta',
  'Rohan Iyer',
  'Vikram Sethi',
  'Kabir Malhotra',
  'Imran Qureshi',
  'Manoj Pillai',
  'Deepak Rawat',
  'Suresh Nair',
  'Aman Gill',
  'Ravi Tejas',
  'Nikhil Joshi',
  'Harish Rao',
  'Farhan Ali',
  'Gaurav Bisht',
  'Ankit Chauhan',
  'Prakash Menon',
];

/** Builds the fictional dataset relative to `now` so "last update" stays recent. */
export function buildDemoCasualties(
  now: number = Date.now(),
): CasualtySummary[] {
  const list: CasualtySummary[] = [];
  let i = 0;
  for (const company of COMPANIES) {
    DISTRIBUTION[company].forEach((count, t) => {
      for (let n = 0; n < count; n++) {
        const temporary = i % 7 === 3;
        list.push({
          casualtyId: temporary
            ? `TEMP-${String(i + 1).padStart(4, '0')}`
            : `PAT-${String(101 + i).padStart(5, '0')}`,
          name: temporary ? null : NAMES[i % NAMES.length],
          temporary,
          company,
          triage: TRIAGE_ORDER[t],
          stage: STAGE_ORDER[(i * 3 + t) % STAGE_ORDER.length],
          updatedAt: new Date(now - (i * 11 + 4) * 60_000).toISOString(),
        });
        i += 1;
      }
    });
  }
  return list;
}

export interface DashboardData {
  casualties: CasualtySummary[];
  /** DEMO until the encrypted local evacuation store exists. */
  source: 'DEMO' | 'LOCAL';
  loadedAt: string;
}

/** Data source for the Home dashboard. Replace with local storage queries. */
export async function loadDashboardData(): Promise<DashboardData> {
  const now = Date.now();
  return {
    casualties: buildDemoCasualties(now),
    source: 'DEMO',
    loadedAt: new Date(now).toISOString(),
  };
}
