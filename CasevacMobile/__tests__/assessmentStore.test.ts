/**
 * Saved assessments must open in the read-only history report even when an
 * earlier build saved them in an older shape.
 */
import {
  AssessmentStore,
  EMPTY_ASSESSMENT,
  normaliseAssessment,
  validateAssessment,
} from '../src/services/evacuation/assessment';
import {
  InterventionsStore,
  emptyInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';
import { PatientHistoryStore } from '../src/services/patients/historyStore';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: async (key: string) => data[key] ?? null,
    setItem: async (key: string, value: string) => {
      data[key] = value;
    },
  };
}

// Shape written by the first build of screen 4 (single `mechanism`).
const OLD_RECORD = {
  id: 'ASM-OLD-1',
  patientKeys: ['PAT-00042'],
  patientLabel: 'Test Soldier (PAT-00042)',
  recordedAt: '2026-11-13T10:00:00.000Z',
  recordedBy: 'MED-00003',
  conscious: true,
  incident: {
    occurredAt: null,
    injuryTime: '09:30',
    mechanism: 'Gunshot',
    injuryCount: 1,
    status: 'RED',
  },
  march: { checked: ['M'], additionalInjury: '' },
  vitals: {
    hr: 110,
    rr: null,
    bpSys: null,
    bpDia: null,
    spo2: null,
    temp: null,
    systemicExam: null,
    rs: '',
    cvs: '',
    pa: '',
    cns: '',
  },
  additionalInfo: '',
};

test('an assessment saved in the older shape is upgraded when read', async () => {
  const store = new AssessmentStore(
    memoryStorage({ 'casevac.assessments.v1': JSON.stringify([OLD_RECORD]) }),
    new PatientHistoryStore(memoryStorage()),
  );
  const a = await store.get('ASM-OLD-1');
  expect(a).not.toBeNull();
  expect(a!.incident.mechanisms).toEqual(['Gunshot']);
  expect(a!.incident.status).toBe('RED');
  expect(a!.vitals.hr).toBe(110);
});

test('saving interventions extends the assessment’s history entry, not a second one', async () => {
  const history = new PatientHistoryStore(memoryStorage());
  const storage = memoryStorage();
  const assessments = new AssessmentStore(storage, history);
  const interventions = new InterventionsStore(storage, history);

  const a = validateAssessment({
    ...EMPTY_ASSESSMENT,
    conscious: 'YES',
    hr: '98',
  });
  if (!a.ok) {
    throw new Error('fixture should be valid');
  }
  const saved = await assessments.save(a.value, {
    patientKeys: ['PAT-00042'],
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: 'MED-00003',
  });
  const i = validateInterventions({
    ...emptyInterventions('GREEN'),
    triage: 'YELLOW',
    airway: 'YES',
  });
  if (!i.ok) {
    throw new Error('fixture should be valid');
  }
  const r = await interventions.save(i.value, {
    assessmentId: saved.id,
    initialStatus: 'GREEN',
    patientKeys: ['PAT-00042'],
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: 'MED-00003',
  });

  const entries = await history.listFor(['PAT-00042']);
  expect(entries).toHaveLength(1);
  expect(entries[0].id).toBe(saved.id);
  expect(entries[0].title).toBe('Assessment, interventions & triage');
  expect(entries[0].detail).toContain('YELLOW (priority 2)');
  expect(entries[0].detail).toContain('HR 98');
  expect((await interventions.findByAssessment(saved.id))?.id).toBe(r.id);
});

test('missing or broken fields read as not recorded, never crash', () => {
  const a = normaliseAssessment({ id: 'ASM-BARE' });
  expect(a).not.toBeNull();
  expect(a!.incident.mechanisms).toEqual([]);
  expect(a!.march.checked).toEqual([]);
  expect(a!.vitals.hr).toBeNull();
  expect(a!.incident.status).toBeNull();
  expect(normaliseAssessment(null)).toBeNull();
  expect(normaliseAssessment({ noId: true })).toBeNull();
});
