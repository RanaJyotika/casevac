/**
 * SYNTHETIC DEMONSTRATION DATA ONLY.
 * Fictional records for UI development. Not real personnel or patients.
 * Dashboard demo casualties live in data/demoCasualties.ts.
 */
import type { Clinician, ConnectivityStatus } from '../types';

/** Fictional demo accounts accepted by services/demoAuth.ts */
export const DEMO_ACCOUNTS: ReadonlyArray<{
  password: string;
  clinician: Clinician;
}> = [
  {
    password: '1234',
    clinician: {
      id: 'MED-DEMO-01',
      rank: 'Cpl.',
      displayName: 'R. Demo',
      team: 'Team A',
      isDemo: true,
    },
  },
];

/**
 * The app is offline-first. Until a connectivity check is implemented,
 * we report "offline" rather than falsely claiming a connection.
 */
export const MOCK_CONNECTIVITY: ConnectivityStatus = 'offline';
