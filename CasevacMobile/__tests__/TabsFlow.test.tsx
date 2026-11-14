/**
 * Patient tabs: evacuating several casualties at once, switching between
 * them without losing unsaved input, surviving an app restart, closing tabs
 * and the open-tab limit. Fully offline.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { MAX_TABS } from '../src/navigation/RootNavigator';
import { resetDraftsForTesting } from '../src/services/navigation/drafts';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 800, scale: 1.5, fontScale: 1 }),
}));

jest.mock('../src/provisioning/demo-identity-directory.json', () => ({
  format: 'casevac.identity-directory',
  formatVersion: 2,
  generatedAt: '2026-11-12T09:00:00.000Z',
  patients: [
    {
      patientId: '22222222-2222-4222-8222-222222222222',
      displayId: 'PAT-00042',
      fullName: 'Test Soldier',
      rank: 'Sepoy',
      unit: '9 Demo Rifles',
      bloodGroup: 'O',
      rhFactor: 'POSITIVE',
      sex: 'MALE',
      dateOfBirth: '1998-04-12',
      photo: null,
    },
  ],
  credentials: [],
}));

type Renderer = ReactTestRenderer.ReactTestRenderer;

const wait = (ms: number) =>
  new Promise<void>(resolve => setTimeout(() => resolve(), ms));

function allText(tree: Renderer): string {
  return tree.root
    .findAllByType(Text)
    .map(node => {
      const c = node.props.children;
      return Array.isArray(c) ? c.join('') : String(c);
    })
    .join(' | ');
}

function find(tree: Renderer, label: string) {
  return tree.root.find(
    n =>
      n.props.accessibilityLabel === label &&
      (typeof n.props.onPress === 'function' ||
        typeof n.props.onChangeText === 'function'),
  );
}

/** A patient tab, by the start of its label ("Patient tab: Test Soldier"). */
function tab(tree: Renderer, startsWith: string) {
  return tree.root.find(
    n =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(`Patient tab: ${startsWith}`) &&
      typeof n.props.onPress === 'function',
  );
}

async function act(fn: () => unknown, ms = 30) {
  await ReactTestRenderer.act(async () => {
    await fn();
    await wait(ms);
  });
}

const press = (tree: Renderer, label: string) =>
  act(() => find(tree, label).props.onPress());
const type = (tree: Renderer, label: string, value: string) =>
  act(() => find(tree, label).props.onChangeText(value), 0);
const hr = (tree: Renderer) => find(tree, '1. HR').props.value;

async function signIn(): Promise<Renderer> {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await type(tree, 'User ID', 'MED-DEMO-01');
  await type(tree, 'Password', '1234');
  await act(() => find(tree, 'Login').props.onPress(), 500);
  await act(() => undefined);
  return tree;
}

beforeEach(async () => {
  await AsyncStorage.clear();
  resetDraftsForTesting();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('two patients in two tabs: switch back and forth, unsaved input kept, also after a restart', async () => {
  let tree = await signIn();
  // Nobody open yet: no patient panel.
  expect(() => find(tree, 'Home tab')).toThrow();
  expect(allText(tree)).not.toContain('PATIENTS');

  // Patient 1 from Home: Start Evacuation opens their own tab.
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  await press(tree, 'Start Evacuation');
  expect(allText(tree)).toContain('Initial Casualty Assessment');
  // One patient: no patient panel — nothing to switch between.
  expect(allText(tree)).not.toContain('PATIENTS');
  expect(() => find(tree, 'New patient tab')).toThrow();
  await press(tree, 'Yes');
  await type(tree, '1. HR', '130');

  // Back to Home (patient 1's tab and typing are kept).
  await press(tree, 'Back');
  await press(tree, 'Back');
  expect(allText(tree)).toContain('Operational Snapshot');

  // Patient 2 from Home: an unidentified casualty, registered by hand.
  await press(tree, 'Register casualty');
  await press(tree, 'Save & Continue');
  await press(tree, 'Start Evacuation');
  expect(allText(tree)).toContain('Initial Casualty Assessment');
  // Two patients: the navy side panel appears, with each patient's step.
  let text = allText(tree);
  expect(text).toContain('PATIENTS');
  expect(text).toContain('2/6');
  expect(text).toContain('Step 4+5 · Assessment');
  expect(text).toContain('Patient details');
  expect(tab(tree, 'Test Soldier, PAT-00042')).toBeDefined();
  expect(tab(tree, 'Patient 2, TEMP-')).toBeDefined();
  // Collapsed to the rail: initials instead of cards; expand again.
  await press(tree, 'Collapse patient panel');
  text = allText(tree);
  expect(text).not.toContain('Step 4+5 · Assessment');
  expect(text).toContain('TS');
  expect(text).toContain('P2');
  await press(tree, 'Expand patient panel');
  expect(allText(tree)).toContain('Step 4+5 · Assessment');
  await press(tree, 'No');
  await type(tree, '1. HR', '90');

  // Back to patient 1: their typing is still there.
  await act(() => tab(tree, 'Test Soldier').props.onPress());
  await press(tree, 'Start Evacuation');
  expect(hr(tree)).toBe('130');
  // …and patient 2 too.
  await act(() => tab(tree, 'Patient 2').props.onPress());
  expect(hr(tree)).toBe('90');
  // Home is still Home.
  await press(tree, 'Home tab');
  expect(allText(tree)).toContain('Operational Snapshot');

  // Restart: the app closes (drafts already written) and the medic signs in.
  await act(() => undefined, 600);
  await ReactTestRenderer.act(async () => tree.unmount());
  resetDraftsForTesting();
  tree = await signIn();
  await act(() => undefined, 100);
  await act(() => tab(tree, 'Test Soldier').props.onPress());
  expect(allText(tree)).toContain('Initial Casualty Assessment');
  expect(hr(tree)).toBe('130');
  await act(() => tab(tree, 'Patient 2').props.onPress());
  expect(hr(tree)).toBe('90');

  // Saving patient 1's assessment shows their status on the tab.
  await act(() => tab(tree, 'Test Soldier').props.onPress());
  await press(tree, 'Save & Continue');
  expect(allText(tree)).toContain('Interventions & Triage');
  await act(() => undefined, 50);
  expect(tab(tree, 'Test Soldier').props.accessibilityLabel).toContain(
    'Not handed over',
  );

  // Closing a tab asks first; saved records stay.
  const alertSpy = jest.spyOn(Alert, 'alert');
  await press(tree, 'Close patient tab Patient 2');
  expect(alertSpy.mock.calls[0][0]).toBe('Close Patient 2?');
  const buttons = alertSpy.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  await act(() => buttons.find(b => b.text === 'Close tab')?.onPress?.());
  // Back to one patient: the panel goes away.
  expect(allText(tree)).not.toContain('PATIENTS');
  expect(() => tab(tree, 'Patient 2')).toThrow();
  expect(allText(tree)).toContain('Interventions & Triage');

  // Home → Continue switches to patient 1's open tab, where they were.
  await press(tree, 'Back');
  await press(tree, 'Back');
  expect(allText(tree)).toContain('Operational Snapshot');
  await act(() => undefined, 100);
  await press(tree, 'Continue PAT-00042');
  expect(allText(tree)).toContain('Interventions & Triage');
});

test(`at most ${MAX_TABS} patient tabs can be open`, async () => {
  const tree = await signIn();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  /** Start Evacuation from Home (a new tab), then Back to Home. */
  const startAndReturn = async () => {
    await type(tree, 'Patient or casualty ID', 'PAT-00042');
    await press(tree, 'Find patient');
    await press(tree, 'Start Evacuation');
    if (allText(tree).includes('Initial Casualty Assessment')) {
      await press(tree, 'Back');
      await press(tree, 'Back');
    }
  };

  await startAndReturn();
  await startAndReturn();
  // An empty ＋ tab closes with Back (nothing to lose).
  await press(tree, 'New patient tab');
  expect(allText(tree)).toContain('New Patient (Patient 3)');
  await press(tree, 'Back');
  expect(() => tab(tree, 'Patient 3')).toThrow();

  for (let i = 2; i < MAX_TABS; i++) {
    await startAndReturn();
  }
  expect(alertSpy).not.toHaveBeenCalled();
  expect(allText(tree)).toContain(`${MAX_TABS}/${MAX_TABS}`);
  await startAndReturn();
  expect(alertSpy).toHaveBeenLastCalledWith(
    'Too many patients open',
    expect.stringContaining('Close a patient tab'),
  );
});
