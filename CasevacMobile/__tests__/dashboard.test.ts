/**
 * Home dashboard figures and manual Patient ID lookup.
 */
import {
  normaliseAssessment,
  type InitialAssessment,
} from '../src/services/evacuation/assessment';
import { normaliseInterventions } from '../src/services/evacuation/interventions';
import { normaliseHandover } from '../src/services/evacuation/handover';
import { normaliseEvacuation } from '../src/services/evacuation/evacuation';
import { buildCasualtySummaries } from '../src/services/dashboard/localDashboard';
import {
  COMPANIES,
  computeDashboardStats,
  injuryBreakdown,
  type CasualtySummary,
} from '../src/services/dashboard/dashboardStats';
import { StaticIdentityDirectory } from '../src/services/identity/bundledDemoProvisioning';
import { lookupPatientById } from '../src/services/identity/manualLookup';
import type { PatientIdentity } from '../src/services/identity/types';

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 10, 12, 8, minutes)).toISOString();

const casualty = (
  overrides: Partial<CasualtySummary> & Pick<CasualtySummary, 'casualtyId'>,
): CasualtySummary => ({
  name: 'Test Soldier',
  temporary: false,
  company: 'Alpha',
  triage: 'GREEN',
  stage: 'AWAITING_PICKUP',
  updatedAt: at(0),
  injuredAt: at(0),
  recordedBy: 'MED-00001',
  ...overrides,
});

describe('computeDashboardStats', () => {
  it('counts casualties by triage, company and stage', () => {
    const stats = computeDashboardStats([
      casualty({
        casualtyId: 'A1',
        company: 'Alpha',
        triage: 'RED',
        stage: 'IN_TRANSFER',
        updatedAt: at(5),
      }),
      casualty({
        casualtyId: 'A2',
        company: 'Alpha',
        triage: 'RED',
        stage: 'COMPLETED',
        updatedAt: at(1),
      }),
      casualty({
        casualtyId: 'B1',
        company: 'Bravo',
        triage: 'YELLOW',
        stage: 'AWAITING_PICKUP',
        updatedAt: at(9),
      }),
      casualty({
        casualtyId: 'F1',
        company: 'Foxtrot',
        triage: 'BLACK',
        stage: 'HANDED_OVER',
        updatedAt: at(3),
      }),
    ]);
    expect(stats.total).toBe(4);
    expect(stats.byTriage).toEqual({ RED: 2, YELLOW: 1, GREEN: 0, BLACK: 1 });
    expect(stats.byCompany.map(c => c.company)).toEqual([...COMPANIES]);
    expect(stats.byCompany.find(c => c.company === 'Alpha')).toEqual({
      company: 'Alpha',
      counts: { RED: 2, YELLOW: 0, GREEN: 0, BLACK: 0 },
      total: 2,
    });
    expect(stats.byCompany.find(c => c.company === 'Echo')?.total).toBe(0);
    expect(stats.byStage).toEqual({
      AWAITING_PICKUP: 1,
      IN_TRANSFER: 1,
      HANDED_OVER: 1,
      COMPLETED: 1,
    });
    expect(stats.activeEvacuations).toBe(3);
    expect(stats.pendingHandover).toBe(2);
    expect(stats.completedEvacuations).toBe(1);
    expect(stats.recent.map(r => r.casualtyId)).toEqual([
      'B1',
      'A1',
      'F1',
      'A2',
    ]);
  });

  it('handles an empty tablet without inventing figures', () => {
    const stats = computeDashboardStats([]);
    expect(stats.total).toBe(0);
    expect(stats.byCompany.every(c => c.total === 0)).toBe(true);
    expect(stats.recent).toEqual([]);
  });

  it('limits recent activity', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      casualty({ casualtyId: `C${i}`, updatedAt: at(i) }),
    );
    expect(
      computeDashboardStats(many, 3).recent.map(r => r.casualtyId),
    ).toEqual(['C9', 'C8', 'C7']);
  });

  it('counts casualties not yet triaged in the total only', () => {
    const stats = computeDashboardStats([
      casualty({ casualtyId: 'N1', triage: null, company: null }),
      casualty({ casualtyId: 'R1', triage: 'RED', company: null }),
    ]);
    expect(stats.total).toBe(2);
    expect(stats.byTriage).toEqual({ RED: 1, YELLOW: 0, GREEN: 0, BLACK: 0 });
    expect(stats.byCompany.every(c => c.total === 0)).toBe(true);
  });
});

describe('injuryBreakdown (by type of injury)', () => {
  it('counts each injury type, groups free text as Other, keeps the untriaged', () => {
    const rows = injuryBreakdown([
      casualty({
        casualtyId: 'A',
        triage: 'RED',
        mechanisms: ['Gunshot', 'Burn'],
      }),
      casualty({ casualtyId: 'B', triage: 'YELLOW', mechanisms: ['Gunshot'] }),
      casualty({ casualtyId: 'C', triage: null, mechanisms: ['Snake bite'] }),
      casualty({ casualtyId: 'D', triage: 'GREEN', mechanisms: [] }),
    ]);
    const row = (name: string) => rows.find(r => r.injury === name)!;
    expect(rows.map(r => r.injury)).toEqual([
      'Blast / IED',
      'Gunshot',
      'Fragmentation',
      'Burn',
      'Fall',
      'Vehicle accident',
      'Crush',
      'Other',
      'Not recorded',
    ]);
    expect(row('Gunshot')).toMatchObject({
      total: 2,
      counts: { RED: 1, YELLOW: 1, GREEN: 0, BLACK: 0 },
      untriaged: 0,
    });
    expect(row('Burn').total).toBe(1);
    expect(row('Other')).toMatchObject({ total: 1, untriaged: 1 });
    expect(row('Not recorded')).toMatchObject({
      total: 1,
      counts: { RED: 0, YELLOW: 0, GREEN: 1, BLACK: 0 },
    });
    expect(row('Blast / IED').total).toBe(0);
    // "Not recorded" is listed only when it applies.
    expect(
      injuryBreakdown([
        casualty({ casualtyId: 'E', mechanisms: ['Fall'] }),
      ]).map(r => r.injury),
    ).not.toContain('Not recorded');
  });
});

describe('buildCasualtySummaries (records saved on the tablet)', () => {
  const assessment = (
    id: string,
    label: string,
    keys: string[],
    recordedAt: string,
    status: InitialAssessment['incident']['status'] = null,
  ): InitialAssessment =>
    normaliseAssessment({
      id,
      patientKeys: keys,
      patientLabel: label,
      recordedAt,
      recordedBy: 'MED-DEMO-01',
      conscious: true,
      incident: { status, occurredAt: at(-30) },
    })!;

  it('is empty when nothing has been recorded — no demo data', () => {
    expect(buildCasualtySummaries([], [])).toEqual([]);
  });

  it('builds one row per casualty from the latest evacuation', () => {
    const a1 = assessment(
      'ASM-1',
      'Jyotika (PAT-00001)',
      ['uuid-1', 'PAT-00001'],
      at(1),
      'GREEN',
    );
    const a2 = assessment(
      'ASM-2',
      'Unidentified casualty (TEMP-ABC123)',
      ['TEMP-ABC123'],
      at(2),
    );
    const a3 = assessment(
      'ASM-3',
      'Jyotika (PAT-00001)',
      ['uuid-1', 'PAT-00001'],
      at(5),
      'YELLOW',
    );
    const triaged = normaliseInterventions({
      id: 'INT-1',
      assessmentId: 'ASM-3',
      patientKeys: ['PAT-00001'],
      patientLabel: 'Jyotika (PAT-00001)',
      recordedAt: at(6),
      recordedBy: 'MED-DEMO-01',
      triage: { category: 'RED', initialStatus: 'YELLOW' },
    })!;

    const rows = buildCasualtySummaries([a1, a2, a3], [triaged]);
    expect(rows.map(r => r.casualtyId)).toEqual(['PAT-00001', 'TEMP-ABC123']);
    const [jyotika, temp] = rows;
    // Latest evacuation, triage from interventions & triage (6+7).
    expect(jyotika.name).toBe('Jyotika');
    expect(jyotika.triage).toBe('RED');
    expect(jyotika.updatedAt).toBe(at(6));
    expect(jyotika.injuredAt).toBe(at(-30));
    expect(jyotika.company).toBeNull();
    // Unidentified: no name, temporary, not triaged.
    expect(temp.name).toBeNull();
    expect(temp.temporary).toBe(true);
    expect(temp.triage).toBeNull();
    // Not handed over yet: still an active evacuation.
    expect(jyotika.stage).toBe('AWAITING_PICKUP');

    // After handover (screen 8) the evacuation is no longer active.
    const handover = normaliseHandover({
      id: 'HND-1',
      assessmentId: 'ASM-3',
      place: 'ADS',
      nextAction: 'EVACUATE_HIGHER',
      recordedAt: at(8),
      officer: { fullName: 'Meera Iyer' },
    })!;
    // Handover details (8) saved → In transit.
    const after = buildCasualtySummaries([a1, a2, a3], [triaged], [handover]);
    expect(after[0].stage).toBe('IN_TRANSFER');
    expect(after[0].updatedAt).toBe(at(8));
    expect(after[1].stage).toBe('AWAITING_PICKUP');

    // Prepare evacuation (9) saved → Handed over, with the latest condition.
    const evacuation = normaliseEvacuation({
      id: 'EVC-1',
      assessmentId: 'ASM-3',
      mode: 'HELICOPTER',
      condition: 'YELLOW',
      recordedAt: at(9),
    })!;
    const done = buildCasualtySummaries(
      [a1, a2, a3],
      [triaged],
      [handover],
      [evacuation],
    );
    expect(done[0].stage).toBe('HANDED_OVER');
    expect(done[0].triage).toBe('YELLOW');
    expect(done[0].updatedAt).toBe(at(9));
  });
});

describe('lookupPatientById', () => {
  const patient: PatientIdentity = {
    patientId: '22222222-2222-4222-8222-222222222222',
    displayId: 'PAT-00042',
    fullName: 'Test Soldier',
    rank: 'Sepoy',
    unit: '9 Demo Rifles',
    bloodGroup: 'O',
    rhFactor: 'POSITIVE',
    sex: 'MALE',
    dateOfBirth: null,
    photo: null,
  };
  const directory = new StaticIdentityDirectory({
    generatedAt: '2026-11-12T09:00:00.000Z',
    patients: [patient],
    credentials: [],
  });

  it('finds a patient by display ID, case-insensitively', async () => {
    const result = await lookupPatientById('  pat-00042 ', directory);
    expect(result).toEqual({
      ok: true,
      method: 'MANUAL',
      enteredId: 'PAT-00042',
      patient,
      directoryGeneratedAt: '2026-11-12T09:00:00.000Z',
    });
  });

  it('finds a patient by permanent UUID', async () => {
    const result = await lookupPatientById(
      patient.patientId.toUpperCase(),
      directory,
    );
    expect(result.ok && result.patient.displayId).toBe('PAT-00042');
  });

  it('never matches partial or similar IDs', async () => {
    for (const input of ['PAT-0004', 'PAT-000420', 'PAT00042', '42']) {
      expect(await lookupPatientById(input, directory)).toMatchObject({
        ok: false,
        reason: 'NOT_FOUND',
      });
    }
    expect(await lookupPatientById('   ', directory)).toMatchObject({
      ok: false,
      reason: 'EMPTY',
    });
  });
});
