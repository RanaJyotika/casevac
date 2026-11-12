/**
 * Dashboard figures — always computed from the configured data source.
 */
import { getRepository } from "../data";
import type { AuditEvent, PersonCategory, PersonRecord } from "../domain/types";
import { isTeamEligible } from "./team-rules";

export interface CategoryCount {
  total: number;
  active: number;
}

export interface DashboardSummary {
  people: Record<PersonCategory, CategoryCount>;
  teams: { total: number; active: number };
  qr: { active: number; awaitingWristband: number; revokedOrReplaced: number };
  soldiersWithoutActiveQr: number;
  clinicalStaffWithoutTeam: number;
  recentRegistrations: PersonRecord[];
  recentActivity: AuditEvent[];
  isEmpty: boolean;
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const repo = getRepository();
  const [persons, credentials, teams, recentActivity] = await Promise.all([
    repo.listPersons(),
    repo.listCredentials(),
    repo.listTeams(),
    repo.listAuditEvents(8),
  ]);

  const people: Record<PersonCategory, CategoryCount> = {
    SOLDIER: { total: 0, active: 0 },
    MEDIC: { total: 0, active: 0 },
    DOCTOR: { total: 0, active: 0 },
    STAFF: { total: 0, active: 0 },
  };
  for (const p of persons) {
    people[p.category].total += 1;
    if (p.status === "ACTIVE") people[p.category].active += 1;
  }

  const active = credentials.filter(c => c.status === "ACTIVE");
  const withActive = new Set(active.map(c => c.personId));
  const inTeam = new Set(teams.filter(t => t.status === "ACTIVE").flatMap(t => t.memberIds));

  return {
    people,
    teams: { total: teams.length, active: teams.filter(t => t.status === "ACTIVE").length },
    qr: {
      active: active.length,
      awaitingWristband: active.filter(c => !c.wristbandIssuedAt).length,
      revokedOrReplaced: credentials.length - active.length,
    },
    soldiersWithoutActiveQr: persons.filter(
      p => p.category === "SOLDIER" && p.status === "ACTIVE" && !withActive.has(p.id),
    ).length,
    clinicalStaffWithoutTeam: persons.filter(p => isTeamEligible(p) && !inTeam.has(p.id)).length,
    recentRegistrations: [...persons].sort((a, b) => b.registeredAt.localeCompare(a.registeredAt)).slice(0, 6),
    recentActivity,
    isEmpty: persons.length === 0 && teams.length === 0,
  };
}
