/**
 * SYNTHETIC DEMONSTRATION DATA ONLY.
 * Fictional records for UI development. Not real personnel or patients.
 * Replace with local SQLite repositories (MVP Day 2).
 */
import type {
  Clinician,
  ConnectivityStatus,
  EvacuationSummary,
} from '../types';

/** Fictional demo accounts accepted by services/demoAuth.ts */
export const DEMO_ACCOUNTS: ReadonlyArray<{ pin: string; clinician: Clinician }> =
  [
    {
      pin: '1234',
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

export const MOCK_ACTIVE_EVACUATIONS: EvacuationSummary[] = [
  {
    evacuationId: 'EVAC-DEMO-001',
    patientId: 'PAT-DEMO-001',
    isUnknownCasualty: false,
    startedAt: '2026-11-12T09:42:00',
    eventCount: 4,
    status: 'SAVED_LOCAL',
  },
  {
    evacuationId: 'EVAC-DEMO-002',
    patientId: 'TEMP-0007',
    isUnknownCasualty: true,
    startedAt: '2026-11-12T10:15:00',
    eventCount: 2,
    status: 'DIGITAL_TRANSFER_PENDING',
  },
];

/** Number of patient identities provisioned/cached on this phone. */
export const MOCK_CACHED_IDENTITY_COUNT = 3;
