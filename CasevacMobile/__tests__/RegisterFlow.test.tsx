/**
 * Screen 3 (Patient Identification) details and actions, and Register New
 * Patient (field registration on this tablet).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Image, Text } from 'react-native';
import App from '../App';
import { PatientHistoryStore } from '../src/services/patients/historyStore';

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
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////8=',
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
    await find(tree, label).props.onPress();
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

test('screen 3 shows photo, name, rank, gender, age, blood group and unit, with both actions', async () => {
  const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');

  const text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Test Soldier');
  expect(text).toContain('Sepoy');
  expect(text).toContain('Male');
  expect(text).toContain('O+');
  expect(text).toContain('O · Rh positive');
  expect(text).toContain('9 Demo Rifles');
  expect(text).toContain('PAT-00042');
  const photo = tree.root.findAllByType(Image)[0];
  expect(photo.props.source.uri).toMatch(/^data:image\/jpeg;base64,/);
  expect(photo.props.accessibilityLabel).toBe('ID photo of Test Soldier');

  await press(tree, 'Start Evacuation');
  expect(alertSpy).toHaveBeenLastCalledWith(
    'Start evacuation — coming next',
    expect.stringContaining('No data has been changed'),
  );

  // Registering from a found patient is a different casualty: the found ID
  // is not carried over or described as "not found".
  await press(tree, 'Register New Patient');
  const form = allText(tree);
  expect(form).toContain('Patient details');
  expect(form).toContain('Save & Continue');
  expect(form).not.toContain('PAT-00042');
});

test('screen 3 shows age next to rank, and previous history when the tablet has it', async () => {
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  let text = allText(tree);
  expect(text).toMatch(/Sepoy · \d+ years/);
  expect(text).toContain('PREVIOUS HISTORY');
  expect(text).toContain('No previous record found');
  expect(text).not.toContain('Revocation check');

  // A record written by the (future) evacuation workflow appears here.
  await new PatientHistoryStore().add({
    id: 'h1',
    patientKeys: ['PAT-00042'],
    at: '2026-11-12T08:30:00.000Z',
    title: 'Evacuation completed',
    detail: 'RED · Handed over at CCP',
    recordedBy: 'MED-00007',
  });
  await press(tree, 'Back');
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  text = allText(tree);
  expect(text).toContain('Evacuation completed');
  expect(text).toContain('RED · Handed over at CCP');
  expect(text).toContain('Recorded by MED-00007');
  expect(text).not.toContain('No previous record found');
});

test('Register New Casualty on Home: fill in details, save, open screen 3 for the new patient', async () => {
  const tree = await openHome();
  await press(tree, 'Register casualty');
  expect(allText(tree)).toContain('Saved on this tablet only — not verified');

  await type(tree, 'Full name', 'Amit Kumar');
  await type(tree, 'Rank', 'Naik');
  await type(tree, 'Age (years)', '29');
  await type(tree, 'Unit', '4 Demo Guards');
  await press(tree, 'Female');
  await press(tree, 'AB');
  await press(tree, 'Rh −');
  await press(tree, 'Save & Continue');

  const text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Registered on this tablet');
  expect(text).not.toContain('Field registration — not verified');
  expect(text).toContain('Amit Kumar');
  expect(text).toContain('Naik');
  expect(text).toContain('Naik · 29 years');
  expect(text).toContain('No previous record found');
  expect(text).toContain('Female');
  expect(text).toContain('AB−');
  expect(text).toContain('4 Demo Guards');
  expect(text).toMatch(/TEMP-[A-Z2-9]{6}/);
});

test('a blank registration is allowed (unidentified casualty); a bad age is not', async () => {
  const tree = await openHome();
  await press(tree, 'Register casualty');

  await type(tree, 'Age (years)', '200');
  await press(tree, 'Save & Continue');
  expect(allText(tree)).toContain('Enter age in whole years (0–120)');
  expect(allText(tree)).not.toContain('Patient Identification');

  await type(tree, 'Age (years)', '');
  await press(tree, 'Save & Continue');
  const text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Unidentified casualty');
});

test('an ID not found on this tablet can be registered, keeping the typed ID', async () => {
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-09999');
  await press(tree, 'Find patient');
  expect(allText(tree)).toContain(
    'No patient with ID PAT-09999 on this tablet.',
  );

  await press(tree, 'Register as new patient');
  expect(allText(tree)).toContain(
    'No patient with ID PAT-09999 on this tablet. The ID you typed will be kept',
  );
  await type(tree, 'Full name', 'Ravi Das');
  await press(tree, 'Save & Continue');

  const text = allText(tree);
  expect(text).toContain('Ravi Das');
  expect(text).toContain('Registered on this tablet');
});
