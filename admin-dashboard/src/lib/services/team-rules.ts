import { ROLE_DEFINITIONS } from "../domain/roles";
import type { PersonRecord, StaffRecord } from "../domain/types";

/** Returns a reason the person cannot join a team, or null if eligible. */
export function teamEligibilityProblem(person: PersonRecord | null): string | null {
  if (!person) return "Person not found.";
  if (person.category === "SOLDIER") return "Soldiers are patient identities and cannot join medical teams.";
  if (person.status !== "ACTIVE") return `${person.displayId} is inactive.`;
  const role = ROLE_DEFINITIONS[person.staff.role];
  if (!role.teamEligible) return `${role.label} cannot be a medical team member.`;
  return null;
}

export function isTeamEligible(person: PersonRecord): person is StaffRecord {
  return teamEligibilityProblem(person) === null;
}
