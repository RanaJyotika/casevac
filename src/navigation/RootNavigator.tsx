/**
 * Minimal state-based navigator for Login ↔ Home.
 * Deliberately dependency-free for the first two screens. When the clinical
 * flow screens (M03–M14) are added, replace with React Navigation's native
 * stack.
 */
import React, { useState } from 'react';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import type { Clinician } from '../types';

type Route = { name: 'Login' } | { name: 'Home'; clinician: Clinician };

export function RootNavigator() {
  const [route, setRoute] = useState<Route>({ name: 'Login' });

  switch (route.name) {
    case 'Home':
      return (
        <HomeScreen
          clinician={route.clinician}
          onSignOut={() => setRoute({ name: 'Login' })}
        />
      );
    case 'Login':
    default:
      return (
        <LoginScreen
          onSignIn={clinician => setRoute({ name: 'Home', clinician })}
        />
      );
  }
}
