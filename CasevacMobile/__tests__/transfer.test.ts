/**
 * Tablet-to-tablet casualty handover: package, sealing, QR frames, import,
 * receipt. Two "tablets" = two separate in-memory storages.
 */
import { AssessmentStore, EMPTY_ASSESSMENT, validateAssessment } from '../src/services/evacuation/assessment';
import { EvacuationStore, validateEvacuation } from '../src/services/evacuation/evacuation';
import { HandoverStore, validateHandover } from '../src/services/evacuation/handover';
import {
  InterventionsStore,
  emptyInterventions,
  validateInterventions,
} from '../src/services/evacuation/interventions';
import { injuryLine } from '../src/services/evacuation/injuryLocations';
import { StaticIdentityDirectory } from '../src/services/identity/bundledDemoProvisioning';
import type { TransferKey } from '../src/services/identity/provisioningStore';
import { FieldRegistry } from '../src/services/patients/fieldRegistry';
import { PatientHistoryStore } from '../src/services/patients/historyStore';
import { importTransfer } from '../src/services/transfer/importTransfer';
import { FrameAssembler, toFrames } from '../src/services/transfer/qrFrames';
import {
  parseReceiptQr,
  receiptQr,
  verifyReceipt,
} from '../src/services/transfer/receipt';
import {
  buildTransferPackage,
  openPackage,
  sealPackage,
  TransferError,
} from '../src/services/transfer/transferPackage';
import { TransferLog } from '../src/services/transfer/transferLog';
import type { Clinician } from '../src/types';

function memory() {
  const data: Record<string, string> = {};
  return {
    getItem: async (k: string) => data[k] ?? null,
    setItem: async (k: string, v: string) => {
      data[k] = v;
    },
  };
}

/** Everything one tablet stores. */
function tablet() {
  const storage = memory();
  const history = new PatientHistoryStore(storage);
  return {
    assessments: new AssessmentStore(storage, history),
    interventions: new InterventionsStore(storage, history),
    handovers: new HandoverStore(storage, history),
    evacuations: new EvacuationStore(storage, history),
    history,
    fieldRegistry: new FieldRegistry(storage),
    log: new TransferLog(storage),
    directory: new StaticIdentityDirectory({
      generatedAt: '2026-11-12T09:00:00.000Z',
      credentials: [],
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
    }),
  };
}

const unitKey: TransferKey = {
  keyId: 'test-unit-01',
  key: Uint8Array.from({ length: 32 }, (_, i) => i + 7),
};
const sender: Clinician = {
  id: 'MED-00012',
  rank: 'Cpl.',
  displayName: 'R. Demo',
  team: 'Team A',
  isDemo: true,
};
const receiver: Clinician = { ...sender, id: 'MED-00045', displayName: 'M. Iyer', rank: 'Maj' };

/** Records a full evacuation (4+5 → 9) on a tablet; returns the assessment ID. */
async function recordEvacuation(t: ReturnType<typeof tablet>): Promise<string> {
  const meta = {
    patientKeys: ['22222222-2222-4222-8222-222222222222', 'PAT-00042'],
    patientLabel: 'Test Soldier (PAT-00042)',
    recordedBy: sender.id,
  };
  const a = validateAssessment({ ...EMPTY_ASSESSMENT, conscious: 'YES', status: 'YELLOW', hr: '118', mechanisms: ['Gunshot'] });
  if (!a.ok) throw new Error('assessment fixture');
  const assessment = await t.assessments.save(a.value, meta);
  const i = validateInterventions({ ...emptyInterventions('YELLOW'), triage: 'RED', airway: 'YES', provisionalDiagnosis: 'GSW left thigh', injuryLocations: ['THL-F', 'HD-B'] });
  if (!i.ok) throw new Error('interventions fixture');
  await t.interventions.save(i.value, { ...meta, assessmentId: assessment.id, initialStatus: 'YELLOW' });
  const h = validateHandover({
    place: 'ADS',
    date: '2026-11-14',
    time: '09:00',
    officer: {
      source: 'DIRECTORY', staffId: 's1', displayId: 'MED-00045', fullName: 'Meera Iyer', rank: 'Maj',
      unit: 'Demo ADS', roleLabel: 'Doctor / Medical Officer', designation: 'RMO', dateOfBirth: null,
      contactPhone: '', photo: 'data:image/jpeg;base64,/9j/4AAQ',
    },
    manualEntry: false,
    manual: { fullName: '', rank: '', displayId: '', unit: '', designation: '' },
    nextAction: 'EVACUATE_HIGHER',
    nextActionOther: '',
  });
  if (!h.ok) throw new Error('handover fixture');
  const handover = await t.handovers.save(h.value, { ...meta, assessmentId: assessment.id, interventionsId: null });
  const e = validateEvacuation({
    date: '2026-11-14', time: '09:10', assistedByMo: 'YES', assistedByNa: 'NO',
    condition: 'RED', conditionNotes: 'Stable on O2', mode: 'HELICOPTER',
  });
  if (!e.ok) throw new Error('evacuation fixture');
  await t.evacuations.save(e.value, { ...meta, assessmentId: assessment.id, handoverId: handover.id });
  return assessment.id;
}

test('a full evacuation travels by QR frames to another tablet, intact and verifiable', async () => {
  const mine = tablet();
  const next = tablet();
  const assessmentId = await recordEvacuation(mine);

  const pkg = await buildTransferPackage(assessmentId, sender, mine);
  expect(pkg.patient).toMatchObject({ displayId: 'PAT-00042', name: 'Test Soldier', bloodGroup: 'O', temporary: false });
  expect(pkg.sender).toMatchObject({ id: 'MED-00012', name: 'R. Demo' });
  // No photos travel: the next tablet has them from the dashboard.
  expect(JSON.stringify(pkg)).not.toContain('data:image');

  const envelope = await sealPackage(pkg, unitKey);
  expect(envelope.startsWith('CVX1.test-unit-01.')).toBe(true);
  // Nothing readable in the QR: no name, no diagnosis.
  expect(envelope).not.toContain('Test Soldier');
  expect(envelope).not.toContain('GSW');

  // Shown as several frames; scanned out of order with a repeat.
  const frames = toFrames(envelope, 120);
  expect(frames.length).toBeGreaterThan(1);
  const assembler = new FrameAssembler();
  const order = [...frames].reverse();
  let state = assembler.add(order[0]);
  expect(state.status).toBe('progress');
  assembler.add(order[0]); // the same frame twice
  for (const f of order.slice(1)) {
    state = assembler.add(f);
  }
  expect(state).toEqual({ status: 'complete', envelope });

  const opened = openPackage(envelope, unitKey);
  const result = await importTransfer(opened, receiver, unitKey, 'QR', next);
  expect(result.duplicate).toBe(false);
  expect(result.summary).toMatchObject({ patientId: 'PAT-00042', triage: 'RED', handedOver: true });
  // Location of injury travels as codes; the receiver reads their meaning.
  expect(result.summary.injuryLocations).toEqual(['THL-F', 'HD-B']);
  expect(result.summary.injuryLocations.map(injuryLine)).toEqual([
    'THL-F — Left thigh (front)',
    'HD-B — Head (back)',
  ]);

  // The next tablet now holds the whole evacuation with the original IDs.
  expect((await next.assessments.get(assessmentId))?.vitals.hr).toBe(118);
  expect((await next.interventions.findByAssessment(assessmentId))?.triage.provisionalDiagnosis).toBe('GSW left thigh');
  expect((await next.handovers.findByAssessment(assessmentId))?.officer.fullName).toBe('Meera Iyer');
  expect((await next.evacuations.findByAssessment(assessmentId))?.mode).toBe('HELICOPTER');
  const history = await next.history.listFor(['PAT-00042']);
  expect(history.map(h => h.title)).toEqual(
    expect.arrayContaining(['Evacuation — handed over', 'Received from Cpl. R. Demo (MED-00012)']),
  );

  // Receipt: the sending tablet verifies it, and a forged one fails.
  const receipt = parseReceiptQr(receiptQr(result.receipt));
  expect(receipt).toEqual(result.receipt);
  expect(verifyReceipt(unitKey, receipt!)).toBe(true);
  expect(verifyReceipt(unitKey, { ...receipt!, receiverId: 'MED-99999' })).toBe(false);
  const wrongCode = receipt!.code === '000000' ? '111111' : '000000';
  expect(verifyReceipt(unitKey, { ...receipt!, code: wrongCode })).toBe(false);

  // Scanning the same transfer again imports nothing twice.
  const again = await importTransfer(opened, receiver, unitKey, 'QR', next);
  expect(again.duplicate).toBe(true);
  expect(again.receipt).toEqual(result.receipt);
  expect((await next.history.listFor(['PAT-00042'])).length).toBe(history.length);
});

test('tampered, foreign-unit or non-CASEVAC transfers are refused', async () => {
  const mine = tablet();
  const assessmentId = await recordEvacuation(mine);
  const envelope = await sealPackage(await buildTransferPackage(assessmentId, sender, mine), unitKey);

  const code = (fn: () => unknown) => {
    try {
      fn();
    } catch (e) {
      return e instanceof TransferError ? e.code : 'OTHER';
    }
    return 'NONE';
  };
  // One character changed in transit.
  const i = envelope.length - 10;
  const flipped = envelope.slice(0, i) + (envelope[i] === 'A' ? 'B' : 'A') + envelope.slice(i + 1);
  expect(code(() => openPackage(flipped, unitKey))).toBe('NOT_AUTHENTIC');
  // Another unit's key (same key ID, different secret).
  expect(code(() => openPackage(envelope, { keyId: unitKey.keyId, key: new Uint8Array(32) }))).toBe('NOT_AUTHENTIC');
  // A tablet with a different unit key ID gets a clear message.
  expect(code(() => openPackage(envelope, { keyId: 'other-unit', key: unitKey.key }))).toBe('WRONG_UNIT_KEY');
  // A wristband QR or anything else.
  expect(code(() => openPackage('CASEVAC:2:P:abc', unitKey))).toBe('NOT_CASEVAC');
  // No key on this tablet.
  expect(code(() => openPackage(envelope, null))).toBe('NO_KEY');
});

test('a field-registered (TEMP) casualty becomes known on the receiving tablet', async () => {
  const mine = tablet();
  const next = tablet();
  const temp = await mine.fieldRegistry.register(
    { fullName: '', rank: '', age: '30', sex: 'MALE', bloodGroup: 'A', rhFactor: 'NEGATIVE', unit: '' },
    sender.id,
  );
  const a = validateAssessment({ ...EMPTY_ASSESSMENT, conscious: 'NO' });
  if (!a.ok) throw new Error('fixture');
  const saved = await mine.assessments.save(a.value, {
    patientKeys: [temp.tempId],
    patientLabel: `Unidentified casualty (${temp.tempId})`,
    recordedBy: sender.id,
  });
  const pkg = await buildTransferPackage(saved.id, sender, mine);
  expect(pkg.patient).toMatchObject({ displayId: temp.tempId, temporary: true, bloodGroup: 'A', age: 30, name: null });

  const opened = openPackage(await sealPackage(pkg, unitKey), unitKey);
  const result = await importTransfer(opened, receiver, unitKey, 'BLUETOOTH', next);
  expect(result.summary.handedOver).toBe(false);
  expect(await next.fieldRegistry.find(temp.tempId)).toMatchObject({ bloodGroup: 'A', registeredBy: sender.id });
});
