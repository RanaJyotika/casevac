/**
 * Medic profile returned by the dashboard at online sign-in
 * (admin-dashboard/src/lib/services/mobile-access-service.ts → MobileProfile)
 * and cached on the tablet for offline sign-in.
 */
export interface MobileProfile {
  /** Server account ID; changes when the admin resets the password. */
  accountId: string;
  /** Sign-in user ID, upper-case, e.g. MED-00001. */
  userId: string;
  personId: string;
  displayId: string;
  fullName: string;
  rank: string;
  unit: string;
  category: 'MEDIC' | 'DOCTOR' | 'STAFF';
  role: string;
  roleLabel: string;
  designation: string;
  permissions: string[];
  teams: { teamCode: string; name: string; leader: boolean }[];
  issuedAt: string;
}

/** One medic's sign-in saved on this tablet. Never holds the plain password. */
export interface CachedAccount {
  profile: MobileProfile;
  /** PBKDF2-SHA256 of the password, hex. */
  passwordHash: string;
  salt: string;
  iterations: number;
  /** When the copy was saved / refreshed by an online sign-in. */
  savedAt: string;
  /** Offline sign-ins not yet reported to the server. */
  pendingOfflineLogins: { count: number; lastAt: string | null };
}

export type ServerSignInError =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_DISABLED'
  | 'RATE_LIMITED'
  | 'BAD_REQUEST';
