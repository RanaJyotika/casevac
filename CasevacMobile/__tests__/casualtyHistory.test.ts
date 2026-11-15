/**
 * Casualty history (Home → My Recent Records → tap a row): the journey of
 * one evacuation, the casualty's identity, and every evacuation on the tablet.
 */
import {
  AssessmentStore,
  EMPTY_ASSESSMENT,
  validateAssessment,
  type InitialAssessment,
} from '../src/services/evacuation/assessment';
import type { EvacuationRecord } from '../src/services/evacuation/evacuation';
import type { HandoverRecord } from '../src/services/evacuation/handover';
import {
  InterventionsStore,
  emptyInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';
import type { IdentityDirectory } from '../src/services/identity/types';
import {
  buildJourney,
  formatBlood,
  loadCasualtyHistory,
  parsePatientLabel,
  resolveIdentity,
  stageOf,
} from '../src/services/patients/casualtyHistory';
import { FieldRegistry } from '../src/services/patients/fieldRegistry';
import { PatientHistoryStore } from '../src/services/patients/historyStore';
import type { SentTransfer } from '../src/services/transfer/transferLog';
import { TransferLog } from '../src/services/transfer/transferLog';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: async (key: string) => data[key] ?? null,
    setItem: async (key: string, value: string) => {
      data[key] = value;
    },
  };
}

const SOLDIER = {
  patientId: '22222222-2222-4222-8222-222222222222',
  displayId: 'PAT-00042',
  fullName: 'Test Soldier',
  rank: 'Sepoy',
  unit: '9 Demo Rifles',
  bloodGroup: 'O' as const,
  rhFactor: 'POSITIVE' as const,
  sex: 'MALE' as const,
  dateOfBirth: null,
  photo: null,
};

const directory = {
  findPatient: async (id: string) =>
    id === SOLDIER.patientId ? SOLDIER : null,
  findPatientByDisplayId: async (id: string) =>
    id.toUpperCase() === SOLDIER.displayId ? SOLDIER : null,
} as unknown as IdentityDirectory;

const assessment = {
  id: 'ASM-1',
  patientKeys: [SOLDIER.patientId, 'PAT-00042'],
  patientLabel: 'Test Soldier (PAT-00042)',
  recordedAt: '2026-11-15T10:00:00.000Z',
  recordedBy: 'MED-DEMO-01',
  conscious: true,
  incident: {
    occurredAt: null,
    injuryTime: null,
    mechanisms: ['Gunshot'],
    injuryCount: 2,
    status: 'YELLOW',
  },
} as unknown as InitialAssessment;

const handover = {
  assessmentId: 'ASM-1',
  recordedAt: '2026-11-15T10:30:00.000Z',
  recordedBy: 'MED-DEMO-01',
  place: 'RAP',
  officer: { fullName: 'Maj. K. Iyer' },
} as unknown as HandoverRecord;

const evacuation = {
  assessmentId: 'ASM-1',
  recordedAt: '2026-11-15T11:00:00.000Z',
  recordedBy: 'MED-DEMO-01',
  condition: 'RED',
  mode: 'AMBULANCE',
} as unknown as EvacuationRecord;

test('the journey follows the saved steps; unsaved steps are pending', () => {
  const steps = buildJourney({
    assessment,
    interventions: null,
    handover: null,
    evacuation: null,
    transfer: null,
  });
  expect(steps.map(s => [s.key, s.done])).toEqual([
    ['ASSESSMENT', true],
    ['INTERVENTIONS', false],
    ['HANDOVER', false],
    ['EVACUATION', false],
  ]);
  expect(steps[0]).toMatchObject({
    at: '2026-11-15T10:00:00.000Z',
    by: 'MED-DEMO-01',
    detail: 'Gunshot · 2 injuries · Conscious',
    triage: 'YELLOW',
  });
  // Pending steps invent nothing.
  expect(steps[1]).toMatchObject({ at: null, by: null, detail: null });
  expect(stageOf({ handover: null, evacuation: null })).toBe(
    'AWAITING_PICKUP',
  );
});

test('a completed evacuation adds the hand-over to the next team', () => {
  const sent: SentTransfer = {
    transferId: 'T-1',
    assessmentId: 'ASM-1',
    patientLabel: assessment.patientLabel,
    channel: 'BLUETOOTH',
    sentAt: '2026-11-15T11:05:00.000Z',
    status: 'RECEIVED',
    receiverId: 'MED-00009',
    receiverName: 'Cpl. B. Team',
    receivedAt: '2026-11-15T11:06:00.000Z',
  };
  const steps = buildJourney({
    assessment,
    interventions: null,
    handover,
    evacuation,
    transfer: sent,
  });
  expect(steps.map(s => s.key)).toEqual([
    'ASSESSMENT',
    'INTERVENTIONS',
    'HANDOVER',
    'EVACUATION',
    'TRANSFER',
  ]);
  expect(steps[2].detail).toContain('RAP');
  expect(steps[2].detail).toContain('Maj. K. Iyer');
  expect(steps[3].triage).toBe('RED');
  expect(steps[4]).toMatchObject({
    done: true,
    detail: 'Bluetooth · Receipt confirmed by Cpl. B. Team',
  });
  expect(stageOf({ handover, evacuation })).toBe('HANDED_OVER');

  // Not sent yet: the step is shown as pending, never as delivered.
  const unsent = buildJourney({
    assessment,
    interventions: null,
    handover,
    evacuation,
    transfer: null,
  });
  expect(unsent[4]).toMatchObject({ done: false, at: null });
});

test('identity comes from the directory, the field registry, or the label', async () => {
  const fromDirectory = await resolveIdentity(
    [SOLDIER.patientId],
    { casualtyId: 'PAT-00042', label: null },
    { directory },
  );
  expect(fromDirectory).toMatchObject({
    displayId: 'PAT-00042',
    name: 'Test Soldier',
    rank: 'Sepoy',
    unit: '9 Demo Rifles',
    blood: 'O+',
    source: 'DIRECTORY',
  });

  const registry = new FieldRegistry(
    memoryStorage({
      'casevac.fieldPatients.v1': JSON.stringify([
        {
          tempId: 'TEMP-ABC234',
          fullName: null,
          rank: '',
          age: null,
          sex: 'NOT_RECORDED',
          bloodGroup: 'UNKNOWN',
          rhFactor: 'UNKNOWN',
          unit: '5 Demo Engineers',
          registeredAt: '2026-11-15T09:00:00.000Z',
          registeredBy: 'MED-DEMO-01',
          link: {},
        },
      ]),
    }),
  );
  const temp = await resolveIdentity(
    ['TEMP-ABC234'],
    { casualtyId: 'TEMP-ABC234', label: null },
    { directory, fieldRegistry: registry },
  );
  expect(temp).toMatchObject({
    displayId: 'TEMP-ABC234',
    name: null,
    unit: '5 Demo Engineers',
    blood: null,
    source: 'FIELD_REGISTRATION',
  });

  const unknown = await resolveIdentity(
    ['PAT-09999'],
    { casualtyId: 'PAT-09999', label: 'Someone Else (PAT-09999)' },
    { directory, fieldRegistry: new FieldRegistry(memoryStorage()) },
  );
  expect(unknown).toMatchObject({
    name: 'Someone Else',
    unit: null,
    source: 'RECORD',
  });
});

test('loads one evacuation and every evacuation of the casualty', async () => {
  const history = new PatientHistoryStore(memoryStorage());
  const assessments = new AssessmentStore(memoryStorage(), history);
  const interventions = new InterventionsStore(memoryStorage(), history);
  const valid = validateAssessment({
    ...EMPTY_ASSESSMENT,
    conscious: 'YES',
    status: 'YELLOW',
    mechanisms: ['Gunshot'],
  });
  if (!valid.ok) {
    throw new Error('fixture should be valid');
  }
  const meta = {
    patientKeys: [SOLDIER.patientId, 'PAT-00042'],
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: 'MED-DEMO-01',
  };
  const older = await assessments.save(valid.value, meta);
  const latest = await assessments.save(valid.value, meta);
  const i = validateInterventions({
    ...emptyInterventions('YELLOW'),
    triage: 'RED',
  });
  if (!i.ok) {
    throw new Error('fixture should be valid');
  }
  await interventions.save(i.value, {
    ...meta,
    assessmentId: latest.id,
    initialStatus: 'YELLOW',
  });

  const result = await loadCasualtyHistory(
    { casualtyId: 'PAT-00042', assessmentId: latest.id },
    {
      assessments,
      interventions,
      history,
      directory,
      transfers: new TransferLog(memoryStorage()),
      handovers: { findByAssessment: async () => null } as never,
      evacuations: { findByAssessment: async () => null } as never,
    },
  );
  expect(result.identity.unit).toBe('9 Demo Rifles');
  expect(result.current).toMatchObject({
    assessmentId: latest.id,
    stage: 'AWAITING_PICKUP',
    triage: 'RED',
    mechanisms: ['Gunshot'],
  });
  expect(result.current?.steps.filter(s => s.done).map(s => s.key)).toEqual([
    'ASSESSMENT',
    'INTERVENTIONS',
  ]);
  // Both evacuations of this casualty, newest first.
  expect(result.evacuations.map(e => e.id)).toEqual(
    expect.arrayContaining([older.id, latest.id]),
  );
  expect(result.evacuations).toHaveLength(2);
});

test('small helpers', () => {
  expect(formatBlood('AB', 'NEGATIVE')).toBe('AB−');
  expect(formatBlood('UNKNOWN', 'POSITIVE')).toBeNull();
  expect(parsePatientLabel('Unidentified casualty (TEMP-1)')).toEqual({
    name: null,
    id: 'TEMP-1',
  });
});
