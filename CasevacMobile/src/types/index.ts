/**
 * Shared domain types for the CASEVAC medic app.
 * Status names follow CASEVAC_DOCS/APP_FLOW.md §5 "Status definitions".
 */

export type ConnectivityStatus = 'offline' | 'online';

export type RecordStatus =
  | 'SAVED_LOCAL'
  | 'HANDOVER_PREPARED'
  | 'DIGITAL_TRANSFER_PENDING'
  | 'DIGITAL_TRANSFER_SENT'
  | 'DIGITAL_RECORD_RECEIVED'
  | 'CLINICAL_HANDOVER_ACKNOWLEDGED'
  | 'SYNCED';

export interface Clinician {
  /** Clinician identifier, e.g. MED-DEMO-01 */
  id: string;
  rank: string;
  displayName: string;
  team: string;
  /** True while authentication is mocked. Must be shown in the UI. */
  isDemo: boolean;
}

export interface EvacuationSummary {
  /** Distinct per injury/episode, e.g. EVAC-DEMO-001 */
  evacuationId: string;
  /** Permanent Patient ID or a temporary unknown-casualty ID */
  patientId: string;
  isUnknownCasualty: boolean;
  /** ISO-8601 timestamp */
  startedAt: string;
  eventCount: number;
  status: RecordStatus;
}
