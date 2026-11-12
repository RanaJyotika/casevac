/**
 * DEMO AUTHENTICATION — NOT REAL CREDENTIAL VERIFICATION.
 * Checks against fictional accounts in data/mockData.ts only.
 * Production requires verified enrolment, roles, revocation and offline
 * session policy (CASEVAC_DOCS/APP_FLOW.md §6).
 */
import { DEMO_ACCOUNTS } from '../data/mockData';
import type { Clinician } from '../types';

const SIMULATED_DELAY_MS = 400;

export async function demoSignIn(
  userId: string,
  password: string,
): Promise<Clinician | null> {
  await new Promise<void>(resolve => setTimeout(resolve, SIMULATED_DELAY_MS));
  const normalisedId = userId.trim().toUpperCase();
  const match = DEMO_ACCOUNTS.find(
    account =>
      account.clinician.id === normalisedId && account.password === password,
  );
  return match ? match.clinician : null;
}
