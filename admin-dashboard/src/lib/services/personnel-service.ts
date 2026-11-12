/**
 * Personnel registration, editing and directory queries.
 * Soldiers are patient identities (no system access). Staff hold roles.
 */
import { getRepository, type RepositoryWriter } from "../data";
import { formatDisplayId, newInternalId } from "../domain/ids";
import { ROLE_DEFINITIONS } from "../domain/roles";
import type {
  Actor,
  IdentityCredential,
  MedicalTeam,
  PersonCategory,
  PersonRecord,
  RecordStatus,
  RoleId,
  SoldierRecord,
  StaffRecord,
} from "../domain/types";
import {
  validateSoldier,
  validateStaff,
  type SoldierInput,
  type StaffInput,
} from "../domain/validation";
import { fail, invalid, nowIso, ok, runTransaction, type ServiceResult } from "./common";
import { issueCredentialTx } from "./identity-service";
import { teamEligibilityProblem } from "./team-rules";

async function duplicateCheck(tx: RepositoryWriter, serviceNumber: string) {
  const existing = await tx.findPersonByServiceNumber(serviceNumber);
  if (!existing) return null;
  return fail("This service number is already registered.", {
    serviceNumber: `${serviceNumber} is already registered (${existing.displayId}).`,
  });
}

/* ---------------------------- Registration --------------------------- */

export async function registerSoldier(
  input: SoldierInput,
  actor: Actor,
): Promise<ServiceResult<{ person: SoldierRecord; credential: IdentityCredential }>> {
  const v = validateSoldier(input);
  if (!v.ok) return invalid(v.errors);
  const data = v.value;

  return runTransaction(actor, async (tx, audit) => {
    const dup = await duplicateCheck(tx, data.serviceNumber);
    if (dup) return dup;
    const now = nowIso();
    const person: SoldierRecord = {
      id: newInternalId(),
      displayId: formatDisplayId("SOLDIER", await tx.nextSequence("SOLDIER")),
      category: "SOLDIER",
      fullName: data.fullName,
      serviceNumber: data.serviceNumber,
      rank: data.rank,
      unit: data.unit,
      contactPhone: data.contactPhone,
      status: data.status,
      registeredAt: now,
      updatedAt: now,
      registeredBy: actor.id,
      soldier: data.soldier,
    };
    await tx.insertPerson(person);
    await audit("PERSON_REGISTERED", "PERSON", person.id, `Registered soldier ${person.displayId}`);
    if (person.status !== "ACTIVE") {
      return fail("Register the soldier as Active so a QR can be issued.", {
        status: "New soldiers must be Active to receive a QR.",
      });
    }
    const issued = await issueCredentialTx(tx, audit, person, actor);
    if (!issued.ok) return issued;
    return ok({ person, credential: issued.value });
  });
}

export async function registerStaff(input: StaffInput, actor: Actor): Promise<ServiceResult<StaffRecord>> {
  const v = validateStaff(input);
  if (!v.ok) return invalid(v.errors);
  const data = v.value;
  const role = ROLE_DEFINITIONS[data.role];

  return runTransaction(actor, async (tx, audit) => {
    const dup = await duplicateCheck(tx, data.serviceNumber);
    if (dup) return dup;
    const now = nowIso();
    const person: StaffRecord = {
      id: newInternalId(),
      displayId: formatDisplayId(role.category, await tx.nextSequence(role.category)),
      category: role.category,
      fullName: data.fullName,
      serviceNumber: data.serviceNumber,
      rank: data.rank,
      unit: data.unit,
      contactPhone: data.contactPhone,
      status: data.status,
      registeredAt: now,
      updatedAt: now,
      registeredBy: actor.id,
      staff: {
        role: data.role,
        designation: data.designation,
        professionalRegistration: data.professionalRegistration,
      },
    };
    await tx.insertPerson(person);
    await audit("PERSON_REGISTERED", "PERSON", person.id, `Registered ${role.label.toLowerCase()} ${person.displayId}`);

    if (data.teamId) {
      const team = await tx.getTeam(data.teamId);
      if (!team) return fail("Selected team no longer exists.", { teamId: "Select a valid team." });
      if (team.status !== "ACTIVE") return fail("Selected team is inactive.", { teamId: "Select an active team." });
      const problem = teamEligibilityProblem(person);
      if (problem) return fail(problem, { teamId: problem });
      await tx.updateTeam({ ...team, memberIds: [...team.memberIds, person.id], updatedAt: now });
      await audit("TEAM_MEMBER_ADDED", "TEAM", team.id, `Added ${person.displayId} to ${team.teamCode}`);
    }
    return ok(person);
  });
}

/* ------------------------------- Editing ------------------------------ */

export async function updateSoldier(id: string, input: SoldierInput, actor: Actor): Promise<ServiceResult<SoldierRecord>> {
  const v = validateSoldier(input, { requireServiceNumber: false });
  if (!v.ok) return invalid(v.errors);
  const data = v.value;
  return runTransaction(actor, async (tx, audit) => {
    const existing = await tx.getPerson(id);
    if (!existing || existing.category !== "SOLDIER") return fail("Soldier not found.");
    const updated: SoldierRecord = {
      ...existing,
      fullName: data.fullName,
      rank: data.rank,
      unit: data.unit,
      contactPhone: data.contactPhone,
      status: data.status,
      soldier: data.soldier,
      updatedAt: nowIso(),
    };
    await tx.updatePerson(updated);
    await audit("PERSON_UPDATED", "PERSON", id, `Updated soldier ${existing.displayId}`);
    return ok(updated);
  });
}

export async function updateStaff(id: string, input: StaffInput, actor: Actor): Promise<ServiceResult<StaffRecord>> {
  const v = validateStaff({ ...input, teamId: "" }, { requireServiceNumber: false });
  if (!v.ok) return invalid(v.errors);
  const data = v.value;
  return runTransaction(actor, async (tx, audit) => {
    const existing = await tx.getPerson(id);
    if (!existing || existing.category === "SOLDIER") return fail("Personnel record not found.");
    const newRole = ROLE_DEFINITIONS[data.role];
    if (newRole.category !== existing.category) {
      return fail("Role change not allowed.", {
        role: `${existing.displayId} is registered as ${ROLE_DEFINITIONS[existing.staff.role].label}. Changing between medic, doctor and other personnel requires a new registration in the MVP.`,
      });
    }
    const teams = (await tx.listTeams()).filter(t => t.memberIds.includes(id));
    if (!newRole.teamEligible && teams.length > 0) {
      return fail("Remove this person from their teams first.", {
        role: `${newRole.label} cannot be a team member. Remove from ${teams.map(t => t.teamCode).join(", ")} first.`,
      });
    }
    const leads = teams.filter(t => t.leaderId === id && t.status === "ACTIVE");
    if (data.status === "INACTIVE" && leads.length > 0) {
      return fail("Assign a new team leader first.", {
        status: `Leads active team ${leads.map(t => t.teamCode).join(", ")}. Assign another leader before deactivating.`,
      });
    }
    const updated: StaffRecord = {
      ...existing,
      fullName: data.fullName,
      rank: data.rank,
      unit: data.unit,
      contactPhone: data.contactPhone,
      status: data.status,
      staff: { role: data.role, designation: data.designation, professionalRegistration: data.professionalRegistration },
      updatedAt: nowIso(),
    };
    await tx.updatePerson(updated);
    await audit("PERSON_UPDATED", "PERSON", id, `Updated ${existing.displayId}`);
    return ok(updated);
  });
}

/* ------------------------------- Queries ------------------------------ */

export interface PersonnelFilter {
  q?: string;
  category?: PersonCategory | "";
  role?: RoleId | "";
  unit?: string;
  status?: RecordStatus | "";
}

export interface PersonnelRow {
  person: PersonRecord;
  activeCredential: IdentityCredential | null;
  teams: MedicalTeam[];
}

export async function listPersonnel(filter: PersonnelFilter = {}): Promise<PersonnelRow[]> {
  const repo = getRepository();
  const [persons, credentials, teams] = await Promise.all([repo.listPersons(), repo.listCredentials(), repo.listTeams()]);
  const activeByPerson = new Map(credentials.filter(c => c.status === "ACTIVE").map(c => [c.personId, c]));
  const q = (filter.q ?? "").trim().toUpperCase();
  const unit = (filter.unit ?? "").trim().toUpperCase();

  return persons
    .filter(p => {
      if (filter.category && p.category !== filter.category) return false;
      if (filter.role && (p.category === "SOLDIER" || p.staff.role !== filter.role)) return false;
      if (filter.status && p.status !== filter.status) return false;
      if (unit && p.unit.toUpperCase() !== unit) return false;
      if (q && !`${p.fullName} ${p.serviceNumber} ${p.displayId}`.toUpperCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt))
    .map(person => ({
      person,
      activeCredential: activeByPerson.get(person.id) ?? null,
      teams: teams.filter(t => t.memberIds.includes(person.id)),
    }));
}

export async function listUnits(): Promise<string[]> {
  const persons = await getRepository().listPersons();
  return [...new Set(persons.map(p => p.unit))].sort((a, b) => a.localeCompare(b));
}

export interface PersonProfile {
  person: PersonRecord;
  credentials: IdentityCredential[];
  teams: MedicalTeam[];
}

export async function getPersonProfile(id: string): Promise<PersonProfile | null> {
  const repo = getRepository();
  const person = await repo.getPerson(id);
  if (!person) return null;
  const [credentials, teams] = await Promise.all([repo.listCredentials(), repo.listTeams()]);
  return {
    person,
    credentials: credentials.filter(c => c.personId === id).sort((a, b) => b.version - a.version),
    teams: teams.filter(t => t.memberIds.includes(id)),
  };
}
