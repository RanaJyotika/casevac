/**
 * Handing a casualty record to the next team's tablet, through the screens:
 * Hand over to next team (QR + receipt) and Receive patient (scan + import).
 * The camera is the global test double from jest.setup.js; the unit key is
 * the bundled development key both demo tablets share.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import transferKeyJson from '../src/provisioning/transfer-key.json';
import {
  AssessmentStore,
  EMPTY_ASSESSMENT,
  validateAssessment,
} from '../src/services/evacuation/assessment';
import {
  EvacuationStore,
  validateEvacuation,
} from '../src/services/evacuation/evacuation';
import { StaticIdentityDirectory } from '../src/services/identity/bundledDemoProvisioning';
import { parseTransferKey } from '../src/services/identity/provisioningStore';
import { PatientHistoryStore } from '../src/services/patients/historyStore';
import { FieldRegistry } from '../src/services/patients/fieldRegistry';
import { toFrames } from '../src/services/transfer/qrFrames';
import { receiptCode } from '../src/services/transfer/receipt';
import {
  buildTransferPackage,
  sealPackage,
} from '../src/services/transfer/transferPackage';

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
const unitKey = parseTransferKey(transferKeyJson)!;
const KEYS = ['22222222-2222-4222-8222-222222222222', 'PAT-00042'];

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

async function press(tree: Renderer, label: string) {
  await ReactTestRenderer.act(async () => {
    await find(tree, label).props.onPress();
    await wait(30);
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
    await wait(30);
  });
  return tree;
}

/** A completed evacuation (assessment + prepare evacuation) in the given stores. */
async function recordOn(
  assessments: AssessmentStore,
  evacuations: EvacuationStore,
  recordedBy: string,
) {
  const meta = {
    patientKeys: KEYS,
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy,
  };
  const a = validateAssessment({ ...EMPTY_ASSESSMENT, conscious: 'YES', status: 'RED', hr: '120' });
  const e = validateEvacuation({
    date: '2026-11-14', time: '09:10', assistedByMo: 'YES', assistedByNa: 'YES',
    condition: 'RED', conditionNotes: '', mode: 'AMBULANCE',
  });
  if (!a.ok || !e.ok) {
    throw new Error('fixtures');
  }
  const saved = await assessments.save(a.value, meta);
  await evacuations.save(e.value, { ...meta, assessmentId: saved.id, handoverId: null });
  return saved.id;
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('sending tablet: hand over by QR, delivery confirmed only with the right receipt code', async () => {
  // A completed evacuation recorded on this tablet.
  const history = new PatientHistoryStore();
  await recordOn(new AssessmentStore(undefined, history), new EvacuationStore(undefined, history), 'MED-DEMO-01');

  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  const row = tree.root.find(
    n =>
      n.props.accessibilityHint === 'Opens the report, read only' &&
      typeof n.props.onPress === 'function',
  );
  await ReactTestRenderer.act(async () => {
    row.props.onPress();
    await wait(30);
  });
  await press(tree, 'Hand over to next team');
  await ReactTestRenderer.act(async () => {
    await wait(100); // seal the package
  });
  let text = allText(tree);
  expect(text).toContain('Hand Over to Next Team');
  expect(text).toContain('Show QR');
  expect(text).toContain('Share via Bluetooth');

  await press(tree, 'Show QR');
  text = allText(tree);
  expect(text).toContain('Sent — not yet confirmed');
  const qr = tree.root.findAll(
    n => typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Patient transfer QR code'),
  );
  expect(qr.length).toBeGreaterThan(0);

  await press(tree, 'Type their code');
  await type(tree, 'Receiving medic ID', 'MED-00045');
  await type(tree, '6-digit receipt code', '123456');
  await press(tree, 'Confirm receipt');
  expect(allText(tree)).toContain('That receipt does not match this transfer');

  // The real code can only come from a tablet that opened this transfer.
  const sent = JSON.parse((await AsyncStorage.getItem('casevac.transfers.sent.v1'))!);
  const code = receiptCode(unitKey, sent[0].transferId, 'MED-00045');
  await type(tree, '6-digit receipt code', code);
  await press(tree, 'Confirm receipt');
  text = allText(tree);
  expect(text).toContain('Received by (MED-00045)');
  expect(text).toContain('The next team’s tablet verified the record.');
});

/** A sealed transfer from another tablet (separate storage), as QR frames. */
async function framesFromOtherTablet(frameChars = 200) {
  const data: Record<string, string> = {};
  const other = {
    getItem: async (k: string) => data[k] ?? null,
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  };
  const otherHistory = new PatientHistoryStore(other);
  const assessments = new AssessmentStore(other, otherHistory);
  const evacuations = new EvacuationStore(other, otherHistory);
  const id = await recordOn(assessments, evacuations, 'MED-00012');
  const pkg = await buildTransferPackage(
    id,
    { id: 'MED-00012', rank: 'Cpl.', displayName: 'R. Sharma', team: 'Team A', isDemo: false },
    {
      assessments,
      evacuations,
      history: otherHistory,
      fieldRegistry: new FieldRegistry(other),
      directory: new StaticIdentityDirectory({ generatedAt: null, patients: [], credentials: [] }),
    },
  );
  return { pkg, frames: toFrames(await sealPackage(pkg, unitKey), frameChars) };
}

test('scanning a transfer QR with Scan QR Tag switches to Receive patient and keeps reading', async () => {
  const { frames } = await framesFromOtherTablet();
  const tree = await openHome();
  await press(tree, 'Scan patient tag');
  await ReactTestRenderer.act(async () => {
    await wait(30); // camera permission
  });
  // The wristband scanner reads the first part of a transfer QR…
  await ReactTestRenderer.act(async () => {
    await tree.root
      .find(n => n.props.testID === 'qr-camera')
      .props.onReadCode({ nativeEvent: { codeStringValue: frames[0] } });
    await wait(30);
  });
  let text = allText(tree);
  // …and hands over to Receive patient instead of "not a wristband".
  expect(text).toContain('Receive Patient');
  expect(text).not.toContain('Unrecognised QR code');
  expect(text).not.toContain('This is not a Jeewan patient wristband');
  expect(text).toContain(`Reading… 1 of ${frames.length} parts`);

  for (const f of frames.slice(1)) {
    await ReactTestRenderer.act(async () => {
      await tree.root
        .find(n => n.props.testID === 'transfer-camera')
        .props.onReadCode({ nativeEvent: { codeStringValue: f } });
      await wait(10);
    });
  }
  await ReactTestRenderer.act(async () => {
    await wait(50);
  });
  text = allText(tree);
  expect(text).toContain('Patient received');
  expect(text).toContain('Test Soldier (PAT-00042)');
});

test('receiving tablet: scan the looping QR frames, save the record, show the receipt, open the patient', async () => {
  // Built on the sending tablet (separate storage), sealed with the unit key.
  const data: Record<string, string> = {};
  const other = {
    getItem: async (k: string) => data[k] ?? null,
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  };
  const otherHistory = new PatientHistoryStore(other);
  const assessments = new AssessmentStore(other, otherHistory);
  const id = await recordOn(assessments, new EvacuationStore(other, otherHistory), 'MED-00012');
  const pkg = await buildTransferPackage(
    id,
    { id: 'MED-00012', rank: 'Cpl.', displayName: 'R. Sharma', team: 'Team A', isDemo: false },
    {
      assessments,
      evacuations: new EvacuationStore(other, otherHistory),
      history: otherHistory,
      fieldRegistry: new FieldRegistry(other),
      directory: new StaticIdentityDirectory({ generatedAt: null, patients: [], credentials: [] }),
    },
  );
  const frames = toFrames(await sealPackage(pkg, unitKey), 200);
  expect(frames.length).toBeGreaterThan(1);

  const tree = await openHome();
  await press(tree, 'Receive patient from another tablet');
  expect(allText(tree)).toContain('Receive Patient');
  await press(tree, 'Scan QR');
  await ReactTestRenderer.act(async () => {
    await wait(30); // camera permission
  });
  const camera = () => tree.root.find(n => n.props.testID === 'transfer-camera');
  for (const f of frames) {
    await ReactTestRenderer.act(async () => {
      await camera().props.onReadCode({ nativeEvent: { codeStringValue: f } });
      await wait(10);
    });
  }
  await ReactTestRenderer.act(async () => {
    await wait(50);
  });
  let text = allText(tree);
  expect(text).toContain('Patient received');
  expect(text).toContain('Test Soldier (PAT-00042)');
  expect(text).toContain('Initial care by Cpl. R. Sharma (MED-00012)');
  expect(text).toContain('Evacuation handed over');
  expect(text).toContain('Show this receipt to the sender');
  expect(text).toContain(receiptCode(unitKey, pkg.transferId, 'MED-DEMO-01'));

  await press(tree, 'Open patient record');
  text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Received from another tablet');
  expect(text).toContain('Received by transfer — confirm the casualty');
  expect(text).toContain('Test Soldier');
  expect(text).toContain('Received from Cpl. R. Sharma (MED-00012)');
  expect(text).toContain('Evacuation — handed over');
  expect(text).toContain('Start Evacuation');
});
