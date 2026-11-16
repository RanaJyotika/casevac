/**
 * Evacuation Procedure (Prepare Evacuation, section A): the next action for
 * the casualty, and the mode of evacuation only when the casualty leaves.
 */
import {
  PROCEDURES,
  PROCEDURE_ACTION,
  normaliseEvacuation,
  summariseEvacuation,
  validateEvacuation,
  type EvacuationForm,
} from '../src/services/evacuation/evacuation';

const NOW = new Date('2026-11-14T10:00:00Z');
const FORM: EvacuationForm = {
  procedure: null,
  date: '2026-11-14',
  time: '09:10',
  assistedByMo: 'YES',
  assistedByNa: 'NO',
  condition: 'RED',
  conditionNotes: '',
  mode: null,
};

test('offers the four client options with their selected action', () => {
  expect(PROCEDURES.map(p => p.label)).toEqual([
    'Continue at RAP',
    'Evacuate to ADS',
    'Evacuate to FSC',
    'Evacuate to MH / CH / BH',
  ]);
  expect(PROCEDURE_ACTION.EVACUATE_TO_ADS).toBe('Prepare transfer to ADS');
});

test('the next action is required', () => {
  const r = validateEvacuation({ ...FORM, mode: 'AMBULANCE' }, NOW);
  expect(r.ok === false && r.errors.procedure).toBeTruthy();
});

test('evacuating needs a mode of evacuation', () => {
  const r = validateEvacuation({ ...FORM, procedure: 'EVACUATE_TO_FSC' }, NOW);
  expect(r.ok === false && r.errors.mode).toBeTruthy();
  const ok = validateEvacuation(
    { ...FORM, procedure: 'EVACUATE_TO_FSC', mode: 'HELICOPTER' },
    NOW,
  );
  expect(ok.ok && ok.value).toMatchObject({
    procedure: 'EVACUATE_TO_FSC',
    mode: 'HELICOPTER',
  });
});

test('continuing at RAP needs no mode and stores none', () => {
  const r = validateEvacuation(
    { ...FORM, procedure: 'CONTINUE_AT_RAP', mode: 'AMBULANCE' },
    NOW,
  );
  expect(r.ok && r.value).toMatchObject({
    procedure: 'CONTINUE_AT_RAP',
    mode: null,
  });
});

test('stored records keep the procedure; older records still load', () => {
  const base = {
    id: 'EVC-1',
    assessmentId: 'A-1',
    condition: 'GREEN',
    evacuatedAt: NOW.toISOString(),
  };
  const atRap = normaliseEvacuation({ ...base, procedure: 'CONTINUE_AT_RAP' });
  expect(atRap).toMatchObject({ procedure: 'CONTINUE_AT_RAP', mode: null });
  expect(summariseEvacuation(atRap!)).toMatch(/^Continue at RAP/);

  const legacy = normaliseEvacuation({ ...base, mode: 'STRETCHER' });
  expect(legacy).toMatchObject({ procedure: null, mode: 'STRETCHER' });

  // Evacuated somewhere without a mode: unusable.
  expect(
    normaliseEvacuation({ ...base, procedure: 'EVACUATE_TO_ADS' }),
  ).toBeNull();
});
