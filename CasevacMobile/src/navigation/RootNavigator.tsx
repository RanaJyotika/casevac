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
import {
  AssessmentScreen,
  type AssessmentPatient,
} from '../screens/AssessmentScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import {
  PatientIdentificationScreen,
  type Identification,
} from '../screens/PatientIdentificationScreen';
import { RegisterPatientScreen } from '../screens/RegisterPatientScreen';
import { ScanPatientScreen } from '../screens/ScanPatientScreen';
import type { FieldLink } from '../services/patients/fieldRegistry';
import type { Clinician } from '../types';

type Screen =
  | { name: 'Home' }
  | { name: 'ScanPatient' }
  | { name: 'PatientIdentification'; result: Identification }
  | { name: 'RegisterPatient'; link: FieldLink }
  | { name: 'Assessment'; patient: AssessmentPatient };

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
      <LoginScreen
        onSignIn={clinician => setNav({ clinician, stack: HOME })}
        onEmergencyAccess={session =>
          setNav({ clinician: session, stack: HOME })
        }
      />
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
          onRegisterPatient={() =>
            replace({ name: 'RegisterPatient', link: {} })
          }
        />
      );
    case 'PatientIdentification':
      return (
        <PatientIdentificationScreen
          result={screen.result}
          onBack={pop}
          onRegisterNew={link => push({ name: 'RegisterPatient', link })}
          onStartEvacuation={patient => push({ name: 'Assessment', patient })}
        />
      );
    case 'Assessment':
      return (
        <AssessmentScreen
          patient={screen.patient}
          recordedBy={nav.clinician.id}
          onCancel={pop}
          onSaved={pop}
        />
      );
    case 'RegisterPatient':
      return (
        <RegisterPatientScreen
          registeredBy={nav.clinician.id}
          link={screen.link}
          onCancel={pop}
          onRegistered={patient =>
            replace({
              name: 'PatientIdentification',
              result: { ok: true, method: 'FIELD', patient },
            })
          }
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
          onRegisterPatient={link => push({ name: 'RegisterPatient', link })}
          onSignOut={() => setNav({ clinician: null, stack: HOME })}
        />
      );
  }
}
