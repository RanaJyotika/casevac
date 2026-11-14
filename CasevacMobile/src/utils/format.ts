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

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Formats an ISO timestamp as "12 Nov 2026, 14:05" in local device time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  const day = String(date.getDate()).padStart(2, '0');
  return `${day} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${formatTime(
    iso,
  )}`;
}

/** Whole years from a YYYY-MM-DD date of birth; null if missing or invalid. */
export function ageFrom(
  dateOfBirth: string | null,
  now: Date = new Date(),
): number | null {
  if (!dateOfBirth) {
    return null;
  }
  const [y, m, d] = dateOfBirth.split('-').map(Number);
  if (!y || !m || !d) {
    return null;
  }
  let age = now.getFullYear() - y;
  if (
    now.getMonth() + 1 < m ||
    (now.getMonth() + 1 === m && now.getDate() < d)
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 120 ? age : null;
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
