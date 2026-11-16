/**
 * Portrait layout: the navy patient strip sits directly under each screen's
 * top bar (AppShell on Home, AppHeader elsewhere). The navigator provides the
 * strip through this context; the top bars render it below themselves.
 * In landscape the patients are a side panel instead and this is null.
 *
 * With a single patient open there is no panel or strip, so the navigator
 * provides header actions instead: Home and ＋ New patient, shown on the
 * right of every patient screen's top bar (AppHeader).
 */
import React, { createContext, useContext } from 'react';

const PatientStripContext = createContext<React.ReactNode>(null);

export const PatientStripProvider = PatientStripContext.Provider;

/** The strip to show under the top bar, or null (landscape / signed out). */
export function usePatientStrip(): React.ReactNode {
  return useContext(PatientStripContext);
}

export interface PatientHeaderActions {
  /** Back to Home; the patient stays open. */
  onHome: () => void;
  /** Start the next casualty in a new tab; omitted when it makes no sense. */
  onNew?: () => void;
}

const PatientHeaderActionsContext = createContext<PatientHeaderActions | null>(
  null,
);

export const PatientHeaderActionsProvider =
  PatientHeaderActionsContext.Provider;

/** Home / ＋ New patient for the top bar, or null (Home, or a panel shows). */
export function usePatientHeaderActions(): PatientHeaderActions | null {
  return useContext(PatientHeaderActionsContext);
}
