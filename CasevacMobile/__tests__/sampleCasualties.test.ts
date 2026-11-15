/**
 * Client-demo sample casualties: loaded through the normal stores, so the
 * Home dashboard, Continue evacuation and patient history all work on them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SAMPLE_CASUALTIES } from '../src/data/sampleCasualties';
import { loadSampleCasualties } from '../src/services/demo/sampleCasualties';
import { loadDashboardData } from '../src/services/dashboard/localDashboard';
import { computeAlerts } from '../src/services/dashboard/dashboardStats';
import { resumeEvacuation } from '../src/services/evacuation/resume';
import { getInterventionsStore } from '../src/services/evacuation/interventions';
import { isInjuryCode } from '../src/services/evacuation/injuryLocations';
import { getPatientHistoryStore } from '../src/services/patients/historyStore';
import { signIn } from '../src/services/auth/signIn';
import { OfflineCredentialStore } from '../src/services/auth/offlineCredentialStore';
import type { ServerClient } from '../src/services/auth/serverClient';

const NOW = Date.UTC(2026, 10, 15, 12, 0);

beforeEach(async () => {
  await AsyncStorage.clear();
});

test('every sample injury location is a valid code', () => {
  for (const c of SAMPLE_CASUALTIES) {
    for (const e of c.episodes) {
      for (const code of e.interventions?.injuryLocations ?? []) {
        expect(isInjuryCode(code)).toBe(true);
      }
    }
  }
});

test('loads seven casualties at different stages, once', async () => {
  const first = await loadSampleCasualties('MED-DEMO-02', { now: NOW });
  expect(first).toEqual({ loaded: true, casualties: 7 });

  const { casualties } = await loadDashboardData();
  expect(casualties).toHaveLength(7);

  const byName = new Map(casualties.map(c => [c.name, c]));
  expect(byName.get('Vikram Singh')).toMatchObject({
    casualtyId: 'PAT-00002',
    triage: 'RED',
    stage: 'IN_TRANSFER',
  });
  expect(byName.get('Rohit Yadav')).toMatchObject({
    triage: 'RED',
    stage: 'AWAITING_PICKUP',
  });
  expect(byName.get('Sunita Rawat')?.stage).toBe('HANDED_OVER');
  expect(byName.get('Imran Khan')).toMatchObject({
    triage: 'GREEN',
    stage: 'AWAITING_PICKUP',
  });
  const unidentified = casualties.find(c => c.temporary);
  expect(unidentified).toMatchObject({
    casualtyId: 'TEMP-X7KQ2M',
    name: null,
    triage: 'RED',
  });

  // Alerts: RED waiting > limit (Rohit) and a handover pending (Vikram).
  const alerts = computeAlerts(casualties, NOW, 0).map(a => a.id);
  expect(alerts).toEqual(expect.arrayContaining(['red-wait', 'handover']));

  // A second sign-in adds nothing.
  expect(await loadSampleCasualties('MED-DEMO-02', { now: NOW })).toEqual({
    loaded: false,
    casualties: 7,
  });
  // 8 evacuations (Rohit has two); 6 have interventions saved.
  expect((await getInterventionsStore().list()).length).toBe(6);
});

test('each evacuation resumes at its next unsaved step', async () => {
  await loadSampleCasualties('MED-DEMO-02', { now: NOW });
  const step = async (id: string) => (await resumeEvacuation(id))?.step;
  expect(await step('ASM-DEMO-01')).toBe('PrepareEvacuation');
  expect(await step('ASM-DEMO-02')).toBe('Handover');
  expect(await step('ASM-DEMO-03')).toBe('EvacuationCompleted');
  expect(await step('ASM-DEMO-05')).toBe('Interventions');
  expect(await step('ASM-DEMO-07')).toBe('Interventions');

  const resumed = await resumeEvacuation('ASM-DEMO-01');
  expect(resumed?.patient).toMatchObject({
    name: 'Vikram Singh',
    id: 'PAT-00002',
    bloodGroup: 'B',
    rhFactor: 'POSITIVE',
  });
});

test('previous history shows an earlier evacuation', async () => {
  await loadSampleCasualties('MED-DEMO-02', { now: NOW });
  const entries = await getPatientHistoryStore().listFor(['PAT-00003']);
  expect(entries.map(e => e.id)).toEqual(['ASM-DEMO-02', 'ASM-DEMO-02A']);
  expect(entries[1].title).toBe('Evacuation — handed over');
});

test('MED-DEMO-02 loads the samples at sign-in; MED-DEMO-01 does not', async () => {
  const deps = {
    server: {} as ServerClient,
    store: new OfflineCredentialStore(),
  };
  expect((await signIn('med-demo-01', '1234', deps)).ok).toBe(true);
  expect((await loadDashboardData()).casualties).toHaveLength(0);

  const result = await signIn('MED-DEMO-02', '1234', deps);
  expect(result).toMatchObject({
    ok: true,
    clinician: { id: 'MED-DEMO-02', isDemo: true, signInMode: 'demo' },
  });
  expect((await loadDashboardData()).casualties).toHaveLength(7);
});
