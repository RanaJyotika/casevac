/**
 * Home (UI v3): top bar status, first actions (scan, ID search, register),
 * pending handovers & alerts, active evacuations, my recent records,
 * operational snapshot, and log out from the account chip.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import {
  AssessmentStore,
  EMPTY_ASSESSMENT,
  toDateValue,
  toTimeValue,
  validateAssessment,
  type Mechanism,
} from '../src/services/evacuation/assessment';
import {
  InterventionsStore,
  emptyInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';
import type { TriageCategory } from '../src/types';

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

/**
 * Saves a real evacuation (assessment 4+5, optionally interventions 6+7)
 * through the app's own stores — the dashboard shows only such records.
 */
async function seedEvacuation({
  name,
  id,
  keys,
  recordedBy,
  status,
  triage,
  injuredMinutesAgo,
  mechanisms = [],
}: {
  name: string | null;
  id: string;
  keys: string[];
  recordedBy: string;
  status: TriageCategory | null;
  triage?: TriageCategory;
  injuredMinutesAgo?: number;
  mechanisms?: Mechanism[];
}) {
  const injured =
    injuredMinutesAgo === undefined
      ? null
      : new Date(Date.now() - injuredMinutesAgo * 60_000);
  const a = validateAssessment({
    ...EMPTY_ASSESSMENT,
    conscious: 'YES',
    status,
    occurredDate: injured ? toDateValue(injured) : null,
    occurredTime: injured ? toTimeValue(injured) : null,
    mechanisms,
  });
  if (!a.ok) {
    throw new Error('fixture should be valid');
  }
  const meta = {
    patientKeys: keys,
    patientLabel: `${name ?? 'Unidentified casualty'} (${id})`,
    recordedBy,
  };
  const saved = await new AssessmentStore().save(a.value, meta);
  if (triage) {
    const i = validateInterventions({ ...emptyInterventions(status), triage });
    if (!i.ok) {
      throw new Error('fixture should be valid');
    }
    await new InterventionsStore().save(i.value, {
      ...meta,
      assessmentId: saved.id,
      initialStatus: status,
    });
  }
}

const seedTwo = async () => {
  // Recorded by the signed-in medic: RED after interventions, injured 45 min ago.
  await seedEvacuation({
    name: 'Test Soldier',
    id: 'PAT-00042',
    keys: ['22222222-2222-4222-8222-222222222222', 'PAT-00042'],
    recordedBy: 'MED-DEMO-01',
    status: 'YELLOW',
    triage: 'RED',
    injuredMinutesAgo: 45,
    mechanisms: ['Gunshot', 'Burn'],
  });
  // Recorded by another medic on this tablet: unidentified, GREEN.
  await seedEvacuation({
    name: null,
    id: 'TEMP-ABC234',
    keys: ['TEMP-ABC234'],
    recordedBy: 'MED-00007',
    status: 'GREEN',
  });
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

test('an empty tablet shows an empty Home — no demo casualties', async () => {
  const tree = await openHome();
  const text = allText(tree);
  expect(text).toContain('JEEWAN');
  expect(text).not.toContain('CASEVAC');
  expect(text).toContain('Cpl. R. Demo');
  expect(text).toContain('Scan QR Tag');
  expect(text).toContain('Register New Casualty');
  expect(text).not.toContain('queued');
  expect(text).toContain('No pending handovers or alerts.');
  expect(text).toContain('No active evacuations. Scan a tag to start one.');
  expect(text).toContain('You have not recorded any casualties yet.');
  expect(text).toContain('View all (0)');
  expect(find(tree, 'Total casualties: 0', false)).toBeDefined();
  // None of the old fictional records.
  for (const fake of ['PAT-00101', 'Arjun Mehta', 'MED-00012']) {
    expect(text).not.toContain(fake);
  }
});

test('Home shows the evacuations recorded on this tablet', async () => {
  await seedTwo();
  const tree = await openHome();
  const text = allText(tree);
  // Top bar: honest sync status
  expect(text).toContain('Offline · 2 records queued');
  expect(text).toContain('Not synced yet');
  // Alerts derived from the records
  expect(text).toContain('RED awaiting pickup');
  expect(text).toContain('Test Soldier · PAT-00042');
  expect(text).toContain('Unsynced records');
  // This medic's active evacuations: only their own record
  expect(text).toContain('Continue Active Evacuations');
  expect(find(tree, 'Continue PAT-00042')).toBeDefined();
  expect(
    tree.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Continue TEMP-ABC234' &&
        typeof n.props.onPress === 'function',
    ),
  ).toHaveLength(0);
  // My recent records
  expect(text).toContain('Created by Cpl. R. Demo');
  expect(text).toContain('View all (1)');
  // Landscape left column: actions, active evacuations, then stats
  const at = (x: string) => text.indexOf(x);
  expect(at('Continue Active Evacuations')).toBeGreaterThan(
    at('Register New Casualty'),
  );
  expect(at('Operational Snapshot')).toBeGreaterThan(
    at('Continue Active Evacuations'),
  );
  // Snapshot of every record on the tablet
  expect(find(tree, 'Total casualties: 2', false)).toBeDefined();
  expect(text).toContain('Triage Distribution');
  expect(
    find(
      tree,
      '2 casualties by triage colour: RED 1, YELLOW 0, GREEN 1, BLACK 0',
      false,
    ),
  ).toBeDefined();
  expect(text).toContain('Casualties by Company');
});

test('My Casualties / All on Tablet switches the snapshot', async () => {
  await seedTwo();
  const tree = await openHome();
  expect(find(tree, 'Total casualties: 2', false)).toBeDefined();
  expect(allText(tree)).toContain('Local records on this tablet');

  // By injury: Gunshot + Burn (RED, recorded by me); nothing recorded (GREEN).
  expect(allText(tree)).toContain('Casualties by Injury');
  const injury = (label: string) => find(tree, label, false);
  expect(
    injury('Gunshot: 1 casualty. RED 1, YELLOW 0, GREEN 0, BLACK 0'),
  ).toBeDefined();
  expect(
    injury('Burn: 1 casualty. RED 1, YELLOW 0, GREEN 0, BLACK 0'),
  ).toBeDefined();
  expect(
    injury('Not recorded: 1 casualty. RED 0, YELLOW 0, GREEN 1, BLACK 0'),
  ).toBeDefined();
  expect(
    injury('Blast / IED: 0 casualties. RED 0, YELLOW 0, GREEN 0, BLACK 0'),
  ).toBeDefined();

  await press(tree, 'My Casualties');
  expect(find(tree, 'Total casualties: 1', false)).toBeDefined();
  expect(allText(tree)).toContain('Recorded by you');
  // The injury chart follows the scope too.
  expect(
    injury('Gunshot: 1 casualty. RED 1, YELLOW 0, GREEN 0, BLACK 0'),
  ).toBeDefined();
  expect(() =>
    injury('Not recorded: 1 casualty. RED 0, YELLOW 0, GREEN 1, BLACK 0'),
  ).toThrow();

  await press(tree, 'All on Tablet');
  expect(find(tree, 'Total casualties: 2', false)).toBeDefined();
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

test('Continue reopens the evacuation in a tab; Sync explains it is not built yet', async () => {
  await seedTwo();
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await openHome();

  // Continue reopens the evacuation at its next unsaved step, in a patient
  // tab: PAT-00042 has its assessment and triage saved → Handover Details.
  await press(tree, 'Continue PAT-00042');
  expect(allText(tree)).toContain('Handover Details');
  // One patient open: no panel; Back returns Home.
  await press(tree, 'Back');
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
