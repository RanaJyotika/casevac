/**
 * Screen 3 (Patient Identification) details and actions, and Register New
 * Patient (field registration on this tablet).
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert, Image, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { PatientHistoryStore } from '../src/services/patients/historyStore';
import {
  AssessmentStore,
  EMPTY_ASSESSMENT,
  validateAssessment,
} from '../src/services/evacuation/assessment';
import {
  InterventionsStore,
  emptyInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';

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
  staff: [
    {
      staffId: '33333333-3333-4333-8333-333333333333',
      displayId: 'MED-00031',
      fullName: 'Ravi Kumar',
      rank: 'Hav',
      unit: 'Demo Fd Amb',
      role: 'MEDIC',
      roleLabel: 'Medic',
      designation: '',
      dateOfBirth: null,
      contactPhone: '',
      photo: null,
    },
    {
      staffId: '44444444-4444-4444-8444-444444444444',
      displayId: 'MED-00032',
      fullName: 'Meera Iyer',
      rank: 'Maj',
      unit: 'Demo ADS',
      role: 'MEDICAL_OFFICER',
      roleLabel: 'Doctor / Medical Officer',
      designation: 'Regimental Medical Officer',
      dateOfBirth: '1988-03-14',
      contactPhone: '+91 98000 00032',
      photo: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP////8=',
    },
  ],
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

beforeEach(async () => {
  // Start each test without patient tabs saved by an earlier test.
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('casevac.tabs.')));
});

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
  expect(allText(tree)).toContain('Initial Casualty Assessment');
  expect(alertSpy).not.toHaveBeenCalled();
  await press(tree, 'Back');

  // Registering from a found patient is a different casualty: the found ID
  // is not carried over or described as "not found".
  await press(tree, 'Register New Patient');
  // The form itself (the patient tab above it still names the open patient).
  const all = allText(tree);
  const form = all.slice(all.indexOf('Register New Patient'));
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

async function openHistory(tree: Renderer, title: string) {
  const row = tree.root.find(
    node =>
      node.props.accessibilityHint === 'Opens the report, read only' &&
      typeof node.props.onPress === 'function' &&
      String(node.props.accessibilityLabel).includes(title),
  );
  await ReactTestRenderer.act(async () => {
    row.props.onPress();
    await wait(20);
  });
}

test('tapping a previous-history entry opens the full report, read only', async () => {
  const value = validateAssessment({
    ...EMPTY_ASSESSMENT,
    conscious: 'YES',
    mechanisms: ['Gunshot'],
    injuryCount: '2',
    status: 'RED',
    march: { M: true, A: false, R: false, C: true, H: false },
    additionalInjury: 'Left forearm laceration',
    hr: '118',
    bpSys: '96',
    bpDia: '60',
    spo2: '93',
    additionalInfo: 'Tourniquet applied 14:05',
  });
  if (!value.ok) {
    throw new Error('fixture should be valid');
  }
  await new AssessmentStore().save(value.value, {
    patientKeys: ['22222222-2222-4222-8222-222222222222', 'PAT-00042'],
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: 'MED-00003',
  });

  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  await openHistory(tree, 'Initial casualty assessment');

  const text = allText(tree);
  expect(text).toContain('Historical report — read only');
  expect(text).toContain('Read only');
  expect(text).toContain('Test Soldier (PAT-00042)');
  expect(text).toContain('by MED-00003');
  expect(text).toContain('Gunshot');
  expect(text).toContain('Left forearm laceration');
  expect(text).toContain('118 bpm');
  expect(text).toContain('96/60 mmHg');
  expect(text).toContain('93%');
  expect(text).toContain('Tourniquet applied 14:05');
  // Read only: nothing to type into, nothing to save.
  expect(
    tree.root.findAll(n => typeof n.props.onChangeText === 'function'),
  ).toHaveLength(0);
  expect(text).not.toContain('Save Assessment');

  await press(tree, 'Back to patient');
  expect(allText(tree)).toContain('Patient Identification');
});

test('a history entry with no stored report opens its summary, read only', async () => {
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  await openHistory(tree, 'Evacuation completed');

  const text = allText(tree);
  expect(text).toContain('Historical report — read only');
  expect(text).toContain('RED · Handed over at CCP');
  expect(text).toContain('No detailed report on this tablet');
  expect(
    tree.root.findAll(n => typeof n.props.onChangeText === 'function'),
  ).toHaveLength(0);
});

test('assessment (4+5) → Save & Continue → interventions & triage (6+7) → both in history, read only', async () => {
  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');

  // Screens 4 + 5
  await press(tree, 'Start Evacuation');
  await press(tree, 'Yes');
  await press(tree, 'Status YELLOW');
  await type(tree, '1. HR', '104');
  await press(tree, 'Save & Continue');

  // Screens 6 + 7, triage carried over from the assessment
  let text = allText(tree);
  expect(text).toContain('Interventions & Triage');
  expect(text).toContain('Assessment saved');
  expect(text).toContain('Assessment recorded YELLOW');
  const selected = tree.root.find(
    n =>
      n.props.accessibilityRole === 'radio' &&
      typeof n.props.onPress === 'function' &&
      n.props.accessibilityState?.selected === true &&
      String(n.props.accessibilityLabel).startsWith('Priority'),
  );
  expect(selected.props.accessibilityLabel).toBe(
    'Priority 2, YELLOW, Delayed / moderate',
  );

  await press(tree, '1. Massive bleeding control performed?: Yes');
  await press(tree, 'Tourniquet');
  expect(allText(tree)).toContain('Tourniquet — time of application');
  await press(tree, '2. Airway intervention performed?: Yes');
  await press(tree, '5. O₂ administered?: N/A');

  // "Yes" to medication but nothing entered is caught.
  await press(tree, '6. Any medication given?: Yes');
  await type(tree, 'Medicine 1 dose', '10 mg IM');
  await press(tree, 'Save');
  text = allText(tree);
  expect(text).toContain('Enter the medicine name.');
  expect(text).toContain('Interventions & Triage');

  await type(tree, 'Medicine 1 name', 'Morphine');
  await press(tree, 'Add another medicine');
  await type(tree, 'Medicine 2 name', 'Inj TT');

  // Re-triage after treatment: both kept.
  await press(tree, 'Priority 1, RED, Critical');
  expect(allText(tree)).toContain('Re-triaged: YELLOW → RED');
  await type(tree, 'Provisional diagnosis', 'GSW left thigh');
  await press(tree, 'Save');

  // 6 + 7 saved → Handover (8). Leaving it keeps the evacuation open.
  expect(allText(tree)).toContain('Handover Details');
  await press(tree, 'Back');

  // Back on Patient Identification: ONE history entry for the evacuation.
  text = allText(tree);
  expect(text).toContain('Patient Identification');
  expect(text).toContain('Assessment, interventions & triage');
  // Status from the saved records: left before Handover (8).
  expect(text).toContain('Not handed over');
  expect(text).not.toContain('In transit · not handed over');
  expect(text).toContain('RED (priority 1)');
  expect(text).toContain('Morphine 10 mg IM, Inj TT');
  expect(text).toContain('HR 104');
  expect(
    tree.root.findAll(
      n =>
        n.props.accessibilityHint === 'Opens the report, read only' &&
        typeof n.props.onPress === 'function' &&
        String(n.props.accessibilityLabel).includes('Morphine'),
    ),
  ).toHaveLength(1);

  // The report shows every detail: assessment (4+5) AND interventions (6+7).
  await openHistory(tree, 'Assessment, interventions & triage');
  text = allText(tree);
  expect(text).toContain('Historical report — read only');
  expect(text).toContain('Casualty Assessment');
  expect(text).toContain('Conscious and able to provide details');
  expect(text).toContain('Incident Details');
  expect(text).toContain('MARCH Assessment');
  expect(text).toContain('104 bpm');
  expect(text).toContain('Interventions & Triage');
  expect(text).toContain('Initial Interventions');
  expect(text).toContain('Tourniquet');
  expect(text).toContain('Morphine · 10 mg IM');
  expect(text).toContain('Status in the assessment');
  expect(text).toContain('GSW left thigh');
  expect(
    tree.root.findAll(n => typeof n.props.onChangeText === 'function'),
  ).toHaveLength(0);
});

/** Assessment (4+5) → Save & Continue → Interventions & Triage (6+7) → Save. */
async function reachHandover(tree: Renderer) {
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  await press(tree, 'Start Evacuation');
  await press(tree, 'Yes');
  await press(tree, 'Save & Continue');
  await press(tree, 'Priority 2, YELLOW, Delayed / moderate');
  await press(tree, 'Save');
  expect(allText(tree)).toContain('Handover Details');
}

test('handover (8) → prepare evacuation (9): search the officer, save both — handed over and read only', async () => {
  const tree = await openHome();
  await reachHandover(tree);

  // Date and time of initiation are filled with now.
  expect(
    tree.root.find(
      n =>
        n.props.accessibilityLabel === 'Date of initiation' &&
        typeof n.props.onPress === 'function',
    ).props.accessibilityValue.text,
  ).not.toBe('Not set');

  // Nothing chosen yet: every required part is flagged.
  await press(tree, 'Save & Continue');
  let text = allText(tree);
  expect(text).toContain('Select the place of initiation.');
  expect(text).toContain('Search and select the officer receiving the casualty.');
  expect(text).toContain('Select the next course of action.');

  await press(tree, '2. ADS, Advanced Dressing Station');
  // Search by name (any part, any case) — medical officers listed first.
  await type(tree, 'Search officer by name or ID', 'meera');
  await press(tree, 'Select Maj Meera Iyer, MED-00032');
  text = allText(tree);
  expect(text).toContain('Meera Iyer');
  expect(text).toContain('Regimental Medical Officer');
  expect(text).toContain('Doctor / Medical Officer');
  expect(text).toMatch(/\d+ years/);
  expect(text).toContain('MED-00032');
  expect(text).toContain('Demo ADS');
  expect(text).toContain('From staff list');
  expect(
    tree.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Photo of Meera Iyer' &&
        n.props.source?.uri,
    ).length,
  ).toBeGreaterThan(0);

  await press(tree, 'Evacuate to Higher Medical Facility');
  await press(tree, 'Save & Continue');

  // Screen 9 — Prepare Evacuation. Condition starts from the latest triage.
  text = allText(tree);
  expect(text).toContain('Prepare Evacuation');
  expect(text).toContain('In transit');
  expect(text).toContain('Latest triage: YELLOW');
  const condition = tree.root.find(
    n =>
      n.props.accessibilityLabel === 'Priority 2, YELLOW, Delayed / moderate' &&
      typeof n.props.onPress === 'function',
  );
  expect(condition.props.accessibilityState.selected).toBe(true);

  // MO, NA and mode must be answered.
  await press(tree, 'Save');
  text = allText(tree);
  expect(text).toContain('Answer whether a medical officer assisted.');
  expect(text).toContain('Answer whether a nursing assistant assisted.');
  expect(text).toContain('Select the mode of evacuation.');
  expect(text).toContain('Prepare Evacuation');

  await press(tree, 'Assisted by medical officer?: Yes');
  await press(tree, 'Assisted by nursing assistant?: No');
  await press(tree, 'Priority 1, RED, Critical');
  expect(allText(tree)).toContain('Condition changed: YELLOW → RED');
  await type(tree, 'Condition notes', 'Bleeding controlled');
  await press(tree, 'Helicopter (Air)');
  await press(tree, 'Save');

  // Final save → screen 10, Evacuation Completed.
  text = allText(tree);
  expect(text).toContain('Evacuation Completed');
  expect(text).toContain('Test Soldier · Patient ID PAT-00042');
  expect(text).toContain('Handed over');
  expect(text).toContain('Helicopter (Air)');
  expect(text).toContain('Not yet on the next team’s tablet');
  for (const option of [
    'Hand over to next team',
    'Summary of total evacuation',
    'Track case',
    'Generate report',
    'Record next casualty',
  ]) {
    expect(text).toContain(option);
  }

  // Summary of total evacuation = the full read-only report.
  await press(tree, 'Summary of total evacuation');
  text = allText(tree);
  expect(text).toContain('Handed over · Read only');
  expect(text).toContain('Casualty Assessment');
  expect(text).toContain('Interventions & Triage');
  expect(text).toContain('Handover');
  expect(text).toContain('ADS — Advanced Dressing Station');
  expect(text).toContain('Meera Iyer');
  expect(text).toContain('Evacuate to Higher Medical Facility');
  expect(text).toContain('Patient Condition During Evacuation');
  expect(text).toContain('Bleeding controlled');
  expect(text).toContain('Helicopter (Air)');
  expect(
    tree.root.findAll(n => typeof n.props.onChangeText === 'function'),
  ).toHaveLength(0);
  expect(text).toContain('Hand over to next team');

  // Back to screen 10 → Home; the patient's history shows the evacuation.
  await press(tree, 'Back to patient');
  await press(tree, 'Back');
  expect(allText(tree)).toContain('Operational Snapshot');
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  text = allText(tree);
  expect(text).toContain('Evacuation — handed over');
  expect(text).toContain(
    'Evacuated by Helicopter (Air) · condition RED · assisted by MO',
  );
  expect(text).toContain('Handed over');
  expect(text).toContain('Not yet sent to next team');
  expect(text).not.toContain('In transit · not handed over');
  expect(text).toContain(
    'Handed over at ADS to Maj Meera Iyer (MED-00032) · Evacuate to Higher Medical Facility',
  );

  // The next handover pre-selects the place used last on this tablet.
  await press(tree, 'Back');
  await reachHandover(tree);
  const ads = tree.root.find(
    n =>
      n.props.accessibilityLabel === '2. ADS, Advanced Dressing Station' &&
      typeof n.props.onPress === 'function',
  );
  expect(ads.props.accessibilityState.selected).toBe(true);
  expect(allText(tree)).toContain('last place used on this tablet');
});

test('handover: search by personnel ID, enter an officer by hand, and "Other" needs details', async () => {
  const tree = await openHome();
  await reachHandover(tree);

  await type(tree, 'Search officer by name or ID', 'med-00031');
  expect(allText(tree)).toContain('Hav Ravi Kumar');
  await type(tree, 'Search officer by name or ID', 'nobody');
  expect(allText(tree)).toContain('No officer matches “nobody”.');

  await press(tree, 'Officer not in list — enter details');
  await press(tree, '3. FSC, Forward Surgical Centre');
  await press(tree, 'Other (specify)');
  await press(tree, 'Save & Continue');
  let text = allText(tree);
  expect(text).toContain('Enter the receiving officer’s name.');
  expect(text).toContain('Describe the next course of action.');

  await type(tree, 'Officer name', 'Anil Rao');
  await type(tree, 'Officer rank', 'Capt');
  await type(tree, 'Enter details', 'Hold for airlift');
  await press(tree, 'Save & Continue');
  expect(allText(tree)).toContain('Prepare Evacuation');

  // Leaving before Prepare Evacuation: the casualty stays "In transit".
  await press(tree, 'Back');
  text = allText(tree);
  expect(text).toContain('Evacuation — in transit');
  expect(text).toContain('In transit · not handed over');
  expect(text).toContain('Handed over at FSC to Capt Anil Rao · Hold for airlift');

  await openHistory(tree, 'Hold for airlift');
  text = allText(tree);
  expect(text).toContain('In transit · Read only');
  expect(text).toContain('Entered by hand — not verified');
  expect(text).toContain('Other — Hold for airlift');
  expect(text).toContain('In transit — evacuation not prepared yet');
});

test('an older, separately saved "Interventions & triage" entry still opens the whole evacuation', async () => {
  // Records saved before 4+5 and 6+7 shared one history entry.
  const a = validateAssessment({
    ...EMPTY_ASSESSMENT,
    conscious: 'NO',
    mechanisms: ['Burn'],
  });
  const i = validateInterventions({
    ...emptyInterventions('BLACK'),
    remarks: 'Legacy separate entry',
  });
  if (!a.ok || !i.ok) {
    throw new Error('fixtures should be valid');
  }
  const keys = ['PAT-00042'];
  const meta = {
    patientKeys: keys,
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: 'MED-00009',
  };
  const assessment = await new AssessmentStore().save(a.value, meta);
  const detached = new PatientHistoryStore({
    getItem: async () => null,
    setItem: async () => {},
  });
  const r = await new InterventionsStore(undefined, detached).save(i.value, {
    ...meta,
    assessmentId: assessment.id,
    initialStatus: 'BLACK',
  });
  await new PatientHistoryStore().add({
    id: r.id,
    patientKeys: keys,
    at: r.recordedAt,
    title: 'Interventions & triage (legacy)',
    detail: 'BLACK (priority 4)',
    recordedBy: 'MED-00009',
  });

  const tree = await openHome();
  await type(tree, 'Patient or casualty ID', 'PAT-00042');
  await press(tree, 'Find patient');
  await openHistory(tree, 'Interventions & triage (legacy)');
  const text = allText(tree);
  expect(text).toContain('Casualty Assessment');
  expect(text).toContain('Burn');
  expect(text).toContain('Interventions & Triage');
  expect(text).toContain('Legacy separate entry');
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
