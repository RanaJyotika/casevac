/**
 * Home dashboard figures and manual Patient ID lookup.
 */
import { buildDemoCasualties } from '../src/data/demoCasualties';
import {
  COMPANIES,
  computeDashboardStats,
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

  it('builds a consistent fictional demo dataset', () => {
    const demo = buildDemoCasualties(Date.UTC(2026, 10, 12, 12, 0));
    const stats = computeDashboardStats(demo);
    expect(stats.total).toBe(36);
    expect(stats.byCompany.reduce((sum, c) => sum + c.total, 0)).toBe(36);
    expect(new Set(demo.map(c => c.casualtyId)).size).toBe(36);
    // Temporary casualties are never given a name.
    for (const c of demo.filter(d => d.temporary)) {
      expect(c.name).toBeNull();
      expect(c.casualtyId).toMatch(/^TEMP-/);
    }
    expect(demo.some(d => d.temporary)).toBe(true);
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
