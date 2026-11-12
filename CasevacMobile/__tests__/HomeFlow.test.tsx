/**
 * Home command dashboard: content, manual Patient ID entry, temporary
 * evacuation placeholder and log out.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import App from '../App';

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

// Render at the client's tablet baseline (1280 × 800 dp, landscape).
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
      const children = node.props.children;
      return Array.isArray(children) ? children.join('') : String(children);
    })
    .join(' | ');
}

function find(tree: Renderer, label: string) {
  return tree.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      (typeof node.props.onPress === 'function' ||
        typeof node.props.onChangeText === 'function'),
  );
}

async function press(tree: Renderer, label: string) {
  await ReactTestRenderer.act(async () => {
    find(tree, label).props.onPress();
    await wait(20);
  });
}

async function type(tree: Renderer, label: string, value: string) {
  await ReactTestRenderer.act(async () => {
    find(tree, label).props.onChangeText(value);
  });
}

async function openHome(): Promise<Renderer> {
  let tree!: Renderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await type(tree, 'User ID', 'MED-DEMO-01');
  await type(tree, 'Password', '1234');
  await ReactTestRenderer.act(async () => {
    find(tree, 'Login').props.onPress();
    await wait(500);
  });
  await ReactTestRenderer.act(async () => {
    await wait(20);
  });
  return tree;
}

afterEach(() => {
  jest.restoreAllMocks();
});

test('shows the command dashboard with actions, cards, charts and activity', async () => {
  const tree = await openHome();
  const text = allText(tree);
  // Shell
  expect(text).toContain('JEEVAN');
  expect(text).toContain('Home');
  expect(text).toContain('Log out');
  expect(text).toContain('Track Casualty');
  // Quick actions
  expect(text).toContain('Scan Patient QR');
  expect(text).toContain('Enter Patient ID');
  expect(text).toContain('Temporary Evacuation');
  // Summary cards, honest data label
  expect(text).toContain('Total casualties');
  expect(text).toContain('Pending handover');
  expect(text).toContain('Demo data');
  // Charts: company names, triage labels with meanings
  for (const company of [
    'Alpha',
    'Bravo',
    'Charlie',
    'Delta',
    'Echo',
    'Foxtrot',
  ]) {
    expect(text).toContain(company);
  }
  for (const label of ['RED', 'YELLOW', 'GREEN', 'BLACK', 'Critical']) {
    expect(text).toContain(label);
  }
  // Activity table and evacuation flow
  expect(text).toContain('Recent casualty activity');
  expect(text).toContain('Awaiting pickup');
  expect(text).toContain('Completed');
  // The 36-casualty demo dataset total is shown
  expect(text).toContain('36 total');
});

test('Enter Patient ID finds a provisioned patient and opens Patient Identification', async () => {
  const tree = await openHome();
  await press(tree, 'Enter Patient ID');
  expect(allText(tree)).toContain('manual entry does not verify the wristband');

  await type(tree, 'Patient ID', 'pat-00042');
  await press(tree, 'Find patient');
  const text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Identified by manual ID');
  expect(text).toContain('Wristband not verified');
  expect(text).toContain('Sepoy Test Soldier');
  expect(text).toContain('Manual Patient ID entry');
  expect(text).not.toContain('Credential verified');

  await press(tree, 'Back');
  expect(allText(tree)).toContain('CASUALTY OVERVIEW');
});

test('Enter Patient ID reports an unknown ID without opening any profile', async () => {
  const tree = await openHome();
  await press(tree, 'Enter Patient ID');
  await press(tree, 'Find patient');
  expect(allText(tree)).toContain('Enter the Patient ID.');

  await type(tree, 'Patient ID', 'PAT-0004');
  await press(tree, 'Find patient');
  const text = allText(tree);
  expect(text).toContain('PATIENT NOT FOUND ON THIS TABLET');
  expect(text).toContain('No patient with ID PAT-0004');
  expect(text).not.toContain('Patient Identification');
});

test('Temporary Evacuation explains it is coming next and changes nothing', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await openHome();
  await press(tree, 'Temporary Evacuation');
  expect(alertSpy).toHaveBeenCalledWith(
    'Temporary evacuation — coming next',
    expect.stringContaining('No data has been changed'),
  );
  expect(allText(tree)).toContain('CASUALTY OVERVIEW');
});

test('Log out asks for confirmation, then returns to login', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  const tree = await openHome();
  await press(tree, 'Log out');
  const buttons = alertSpy.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  await ReactTestRenderer.act(async () => {
    buttons.find(b => b.text === 'Log out')?.onPress?.();
  });
  expect(allText(tree)).toContain('Medic Login');
});
