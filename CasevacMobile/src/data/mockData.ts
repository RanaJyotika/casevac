/**
 * SYNTHETIC DEMONSTRATION DATA ONLY.
 * Fictional sign-in account for testing. Not a real person. (The Home
 * dashboard shows only records saved on the tablet — no demo casualties.)
 */
import type { Clinician } from '../types';

/** Fictional demo accounts accepted by services/auth/signIn.ts */
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
