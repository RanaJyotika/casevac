/**
 * Medical team management. Membership references personnel by ID, so a
 * clinician keeps their individual identity across teams.
 */
import { getRepository, type RepositoryWriter } from "../data";
import { formatDisplayId, newInternalId } from "../domain/ids";
import type { Actor, MedicalTeam, StaffRecord } from "../domain/types";
import { validateTeam, type TeamInput } from "../domain/validation";
import { fail, invalid, nowIso, ok, runTransaction, type ServiceResult } from "./common";
import { isTeamEligible, teamEligibilityProblem } from "./team-rules";

async function checkLeader(tx: RepositoryWriter, leaderId: string | null) {
  if (!leaderId) return null;
  const problem = teamEligibilityProblem(await tx.getPerson(leaderId));
  return problem ? fail(problem, { leaderId: problem }) : null;
}

export async function createTeam(input: TeamInput, actor: Actor): Promise<ServiceResult<MedicalTeam>> {
  const v = validateTeam(input);
  if (!v.ok) return invalid(v.errors);
  const data = v.value;
  return runTransaction(actor, async (tx, audit) => {
    const leaderProblem = await checkLeader(tx, data.leaderId);
    if (leaderProblem) return leaderProblem;
    const nameTaken = (await tx.listTeams()).some(t => t.name.toUpperCase() === data.name.toUpperCase());
    if (nameTaken) return fail("Team name already in use.", { name: "A team with this name already exists." });
    const now = nowIso();
    const team: MedicalTeam = {
      id: newInternalId(),
      teamCode: formatDisplayId("TEAM", await tx.nextSequence("TEAM")),
      name: data.name,
      unit: data.unit,
      description: data.description,
      leaderId: data.leaderId,
      memberIds: data.leaderId ? [data.leaderId] : [],
      status: data.status,
      createdAt: now,
      updatedAt: now,
    };
    await tx.insertTeam(team);
    await audit("TEAM_CREATED", "TEAM", team.id, `Created team ${team.teamCode}`);
    return ok(team);
  });
}

export async function updateTeam(id: string, input: TeamInput, actor: Actor): Promise<ServiceResult<MedicalTeam>> {
  const v = validateTeam(input);
  if (!v.ok) return invalid(v.errors);
  const data = v.value;
  return runTransaction(actor, async (tx, audit) => {
    const team = await tx.getTeam(id);
    if (!team) return fail("Team not found.");
    const leaderProblem = await checkLeader(tx, data.leaderId);
    if (leaderProblem) return leaderProblem;
    const nameTaken = (await tx.listTeams()).some(t => t.id !== id && t.name.toUpperCase() === data.name.toUpperCase());
    if (nameTaken) return fail("Team name already in use.", { name: "A team with this name already exists." });
    const memberIds =
      data.leaderId && !team.memberIds.includes(data.leaderId) ? [...team.memberIds, data.leaderId] : team.memberIds;
    const updated: MedicalTeam = { ...team, ...data, memberIds, updatedAt: nowIso() };
    await tx.updateTeam(updated);
    await audit("TEAM_UPDATED", "TEAM", id, `Updated team ${team.teamCode}`);
    return ok(updated);
  });
}

export async function addTeamMember(teamId: string, personId: string, actor: Actor): Promise<ServiceResult<MedicalTeam>> {
  return runTransaction(actor, async (tx, audit) => {
    const team = await tx.getTeam(teamId);
    if (!team) return fail("Team not found.");
    if (team.status !== "ACTIVE") return fail("Reactivate the team before adding members.");
    if (team.memberIds.includes(personId)) return fail("Already a member of this team.");
    const person = await tx.getPerson(personId);
    const problem = teamEligibilityProblem(person);
    if (problem) return fail(problem);
    const updated = { ...team, memberIds: [...team.memberIds, personId], updatedAt: nowIso() };
    await tx.updateTeam(updated);
    await audit("TEAM_MEMBER_ADDED", "TEAM", teamId, `Added ${person!.displayId} to ${team.teamCode}`);
    return ok(updated);
  });
}

export async function removeTeamMember(teamId: string, personId: string, actor: Actor): Promise<ServiceResult<MedicalTeam>> {
  return runTransaction(actor, async (tx, audit) => {
    const team = await tx.getTeam(teamId);
    if (!team) return fail("Team not found.");
    if (!team.memberIds.includes(personId)) return fail("Not a member of this team.");
    if (team.leaderId === personId) return fail("Choose a different team leader before removing the current leader.");
    const person = await tx.getPerson(personId);
    const updated = { ...team, memberIds: team.memberIds.filter(id => id !== personId), updatedAt: nowIso() };
    await tx.updateTeam(updated);
    await audit("TEAM_MEMBER_REMOVED", "TEAM", teamId, `Removed ${person?.displayId ?? "member"} from ${team.teamCode}`);
    return ok(updated);
  });
}

/* ------------------------------- Queries ------------------------------ */

export interface TeamView {
  team: MedicalTeam;
  leader: StaffRecord | null;
  members: StaffRecord[];
}

async function buildViews(teams: MedicalTeam[]): Promise<TeamView[]> {
  const persons = await getRepository().listPersons();
  const staff = new Map(
    persons.filter((p): p is StaffRecord => p.category !== "SOLDIER").map(p => [p.id, p]),
  );
  return teams.map(team => ({
    team,
    leader: team.leaderId ? staff.get(team.leaderId) ?? null : null,
    members: team.memberIds.map(id => staff.get(id)).filter((p): p is StaffRecord => Boolean(p)),
  }));
}

export async function listTeamViews(): Promise<TeamView[]> {
  const teams = await getRepository().listTeams();
  return buildViews(teams.sort((a, b) => a.teamCode.localeCompare(b.teamCode)));
}

export async function getTeamView(id: string): Promise<TeamView | null> {
  const team = await getRepository().getTeam(id);
  return team ? (await buildViews([team]))[0] : null;
}

/** Active, team-eligible staff (leader picker / add-member picker). */
export async function listTeamEligibleStaff(): Promise<StaffRecord[]> {
  const persons = await getRepository().listPersons();
  return persons.filter(isTeamEligible).sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export async function listActiveTeams(): Promise<MedicalTeam[]> {
  return (await getRepository().listTeams()).filter(t => t.status === "ACTIVE");
}
