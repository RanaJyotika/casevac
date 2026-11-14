/**
 * Home (UI v3): top bar status, first actions (scan, ID search, register),
 * pending handovers & alerts, active evacuations, my recent records,
 * operational snapshot, and log out from the account chip.
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

function find(tree: Renderer, label: string, interactive = true) {
  return tree.root.find(
    node =>
      node.props.accessibilityLabel === label &&
      (!interactive ||
        typeof node.props.onPress === 'function' ||
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

test('shows the v3 Home: status bar, actions, alerts, evacuations, records and snapshot', async () => {
  const tree = await openHome();
  const text = allText(tree);
  // Top bar: no sidebar; honest sync status; medic chip
  expect(text).toContain('CASEVAC');
  expect(text).toContain('Home');
  expect(text).toContain('Offline · 36 records queued');
  expect(text).toContain('Not synced yet');
  expect(text).toContain('Cpl. R. Demo');
  expect(text).toContain('Medic · Demo');
  expect(text).not.toContain('Track Casualty');
  expect(text).not.toContain('Demo data');
  // First actions
  expect(text).toContain('Scan QR Tag');
  expect(find(tree, 'Patient or casualty ID')).toBeDefined();
  expect(text).toContain('Register New Casualty');
  // Alerts derived from the records
  expect(text).toContain('Pending Handovers & Alerts');
  for (const title of [
    'RED awaiting pickup',
    'Handover pending',
    'Unsynced records',
    'Reassessment due',
  ]) {
    expect(text).toContain(title);
  }
  // This medic's active evacuations (awaiting pickup / in transfer)
  expect(text).toContain('Continue Active Evacuations');
  expect(text).toContain('View all (4)');
  expect(
    tree.root.findAll(
      n =>
        typeof n.props.accessibilityLabel === 'string' &&
        /^Continue (PAT|TEMP)-/.test(n.props.accessibilityLabel) &&
        typeof n.props.onPress === 'function',
    ).length,
  ).toBe(4);
  // This medic's recent records (every 3rd demo record)
  expect(text).toContain('My Recent Records');
  expect(text).toContain('Created by Cpl. R. Demo');
  expect(text).toContain('View all (12)');
  // Landscape left column: actions, active evacuations, then stats
  const at = (x: string) => text.indexOf(x);
  expect(at('Continue Active Evacuations')).toBeGreaterThan(
    at('Register New Casualty'),
  );
  expect(at('Operational Snapshot')).toBeGreaterThan(
    at('Continue Active Evacuations'),
  );
  // Compact record rows in the narrow right column: no table header
  expect(text).not.toContain('Date & Time');
  // Snapshot of every record on the tablet
  expect(text).toContain('Operational Snapshot');
  expect(find(tree, 'Total casualties: 36', false)).toBeDefined();
  expect(text).toContain('Triage Distribution');
  expect(text).toContain('Red (Critical)');
  expect(text).toContain('Yellow (Serious)');
  expect(text).toContain('Black (Expectant)');
  expect(text).toContain('(19%)');
  // Casualties by company (follows the snapshot scope)
  expect(text).toContain('Casualties by Company');
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
  expect(
    find(
      tree,
      'Alpha company: 9 casualties. RED 2, YELLOW 3, GREEN 3, BLACK 1',
      false,
    ),
  ).toBeDefined();
  expect(
    find(
      tree,
      '36 casualties by triage colour: RED 7, YELLOW 11, GREEN 16, BLACK 2',
      false,
    ),
  ).toBeDefined();
});

test('My Casualties / All on Tablet switches the snapshot', async () => {
  const tree = await openHome();
  expect(find(tree, 'Total casualties: 36', false)).toBeDefined();
  expect(allText(tree)).toContain('Local records on this tablet');

  await press(tree, 'My Casualties');
  expect(find(tree, 'Total casualties: 12', false)).toBeDefined();
  expect(
    tree.root.findAll(
      n =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.startsWith('Alpha company: '),
    )[0].props.accessibilityLabel,
  ).not.toContain('9 casualties');
  expect(allText(tree)).toContain('Recorded by you');

  await press(tree, 'All on Tablet');
  expect(find(tree, 'Total casualties: 36', false)).toBeDefined();
});

test('ID search finds a provisioned patient and opens Patient Identification', async () => {
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'pat-00042');
  await press(tree, 'Find patient');
  const text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Identified by manual ID');
  expect(text).toContain('Wristband not verified');
  expect(text).toContain('Test Soldier');
  expect(text).toContain('Sepoy');
  expect(text).toContain('No previous record found');
  expect(text).not.toContain('Credential verified');

  await press(tree, 'Back');
  expect(allText(tree)).toContain('Operational Snapshot');
});

test('ID search reports an unknown ID without opening any profile', async () => {
  const tree = await openHome();
  await press(tree, 'Find patient');
  expect(allText(tree)).toContain('Enter the soldier or casualty ID.');

  await type(tree, 'Patient or casualty ID', 'PAT-0004');
  await press(tree, 'Find patient');
  const text = allText(tree);
  expect(text).toContain('No patient with ID PAT-0004 on this tablet.');
  expect(text).not.toContain('Patient Identification');
});

test('actions for screens not built yet explain that and change nothing', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await openHome();

  await press(tree, 'Continue PAT-00101');
  expect(alertSpy).toHaveBeenLastCalledWith(
    'Continue evacuation — coming next',
    expect.stringContaining('No data has been changed'),
  );
  await press(tree, 'Unsynced records: Sync now');
  expect(alertSpy).toHaveBeenLastCalledWith(
    'Sync not available yet',
    expect.stringContaining('stay saved on this tablet'),
  );
  expect(allText(tree)).toContain('Operational Snapshot');
});

test('Log out from the account chip asks for confirmation, then returns to login', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert');
  const tree = await openHome();
  await press(tree, 'Account and log out');
  const buttons = alertSpy.mock.calls[0][2] as {
    text: string;
    onPress?: () => void;
  }[];
  await ReactTestRenderer.act(async () => {
    buttons.find(b => b.text === 'Log out')?.onPress?.();
  });
  expect(allText(tree)).toContain('Medic Login');
});
