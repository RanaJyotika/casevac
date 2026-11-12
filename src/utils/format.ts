import type { RecordStatus } from '../types';

/** Formats an ISO timestamp as 24-hour HH:MM (local device time). */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

/**
 * Human-readable labels for record status.
 * "Truth over polish": never present local save as delivery, or a send as
 * receipt (CASEVAC_DOCS/UI_DESIGN_GUIDELINES.md §7).
 */
export const RECORD_STATUS_DISPLAY: Record<
  RecordStatus,
  { label: string; tone: StatusTone }
> = {
  SAVED_LOCAL: { label: 'Saved on this phone', tone: 'success' },
  HANDOVER_PREPARED: { label: 'Summary ready', tone: 'warning' },
  DIGITAL_TRANSFER_PENDING: { label: 'Transfer pending', tone: 'warning' },
  DIGITAL_TRANSFER_SENT: { label: 'Sent — not yet received', tone: 'warning' },
  DIGITAL_RECORD_RECEIVED: { label: 'Imported and verified', tone: 'success' },
  CLINICAL_HANDOVER_ACKNOWLEDGED: {
    label: 'Handover acknowledged',
    tone: 'success',
  },
  SYNCED: { label: 'Synced to server', tone: 'success' },
};
