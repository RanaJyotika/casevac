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
  /**
   * How this session started. 'offline' = verified against the copy saved on
   * this tablet; 'emergency' = no sign-in at all (break-glass, unverified).
   */
  signInMode?: SignInMode;
  roleLabel?: string;
  unit?: string;
  /** Dashboard Person.id of the signed-in medic (not set for demo/emergency). */
  personId?: string;
}

export type SignInMode = 'online' | 'offline' | 'demo' | 'emergency';

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

/** Triage category (UI_DESIGN_GUIDELINES.md §7). Definitions need clinical approval. */
export type TriageCategory = 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';

/**
 * Operational evacuation stage shown on the Home dashboard. PROVISIONAL —
 * definitions await client approval (REQUIREMENTS.md §H). Distinct from the
 * digital transfer RecordStatus above.
 */
export type EvacuationStage =
  | 'AWAITING_PICKUP'
  | 'IN_TRANSFER'
  | 'HANDED_OVER'
  | 'COMPLETED';
