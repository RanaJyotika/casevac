/**
 * Portrait layout: the navy patient strip sits directly under each screen's
 * top bar (AppShell on Home, AppHeader elsewhere). The navigator provides the
 * strip through this context; the top bars render it below themselves.
 * In landscape the patients are a side panel instead and this is null.
 */
import React, { createContext, useContext } from 'react';

const PatientStripContext = createContext<React.ReactNode>(null);

export const PatientStripProvider = PatientStripContext.Provider;

/** The strip to show under the top bar, or null (landscape / signed out). */
export function usePatientStrip(): React.ReactNode {
  return useContext(PatientStripContext);
}
