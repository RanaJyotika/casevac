/**
 * SYNTHETIC DEMONSTRATION DATA ONLY.
 * Fictional sign-in accounts for testing. Not real people. The Home dashboard
 * shows only records saved on the tablet: MED-DEMO-01 starts from an empty
 * tablet; MED-DEMO-02 (client demos) first loads the sample casualties in
 * data/sampleCasualties.ts.
 */
import type { Clinician } from '../types';

/** Fictional demo accounts accepted by services/auth/signIn.ts */
export const DEMO_ACCOUNTS: ReadonlyArray<{
  password: string;
  clinician: Clinician;
  /** Load the fictional sample casualties onto the tablet at sign-in. */
  loadsSampleCasualties?: boolean;
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
  {
    password: '1234',
    loadsSampleCasualties: true,
    clinician: {
      id: 'MED-DEMO-02',
      rank: 'Nk.',
      displayName: 'A. Showcase',
      team: 'Team A',
      isDemo: true,
    },
  },
];
