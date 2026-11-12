/**
 * Minimal state-based stack navigator (dependency-free).
 *
 * Clinical screens are reachable only while a clinician session exists;
 * signing out clears the whole stack. Android hardware Back pops one screen.
 * When the clinical flow screens (M06–M14) are added, consider React
 * Navigation's native stack.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { PatientIdentificationScreen } from '../screens/PatientIdentificationScreen';
import { ScanPatientScreen } from '../screens/ScanPatientScreen';
import type { ManualIdentification } from '../services/identity/manualLookup';
import type { VerifiedIdentification } from '../services/qr/identifyPatient';
import type { Clinician } from '../types';

type Screen =
  | { name: 'Home' }
  | { name: 'ScanPatient' }
  | {
      name: 'PatientIdentification';
      result: VerifiedIdentification | ManualIdentification;
    };

interface NavState {
  clinician: Clinician | null;
  stack: Screen[];
}

const HOME: Screen[] = [{ name: 'Home' }];

export function RootNavigator() {
  const [nav, setNav] = useState<NavState>({ clinician: null, stack: HOME });

  const push = useCallback(
    (screen: Screen) => setNav(s => ({ ...s, stack: [...s.stack, screen] })),
    [],
  );
  const replace = useCallback(
    (screen: Screen) =>
      setNav(s => ({ ...s, stack: [...s.stack.slice(0, -1), screen] })),
    [],
  );
  const pop = useCallback(
    () =>
      setNav(s =>
        s.stack.length > 1 ? { ...s, stack: s.stack.slice(0, -1) } : s,
      ),
    [],
  );

  const canGoBack = nav.clinician !== null && nav.stack.length > 1;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        return false; // default behaviour (leave the app)
      }
      pop();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, pop]);

  if (!nav.clinician) {
    return (
      <LoginScreen onSignIn={clinician => setNav({ clinician, stack: HOME })} />
    );
  }

  const screen = nav.stack[nav.stack.length - 1];
  switch (screen.name) {
    case 'ScanPatient':
      return (
        <ScanPatientScreen
          onBack={pop}
          onIdentified={result =>
            replace({ name: 'PatientIdentification', result })
          }
        />
      );
    case 'PatientIdentification':
      return (
        <PatientIdentificationScreen
          result={screen.result}
          onBack={pop}
          onScanAnother={() => replace({ name: 'ScanPatient' })}
        />
      );
    case 'Home':
    default:
      return (
        <HomeScreen
          clinician={nav.clinician}
          onScanPatient={() => push({ name: 'ScanPatient' })}
          onPatientIdentified={result =>
            push({ name: 'PatientIdentification', result })
          }
          onSignOut={() => setNav({ clinician: null, stack: HOME })}
        />
      );
  }
}
