"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { addTeamMember, createTeam, removeTeamMember, updateTeam } from "@/lib/services/team-service";
import { errorState, readForm } from "./helpers";

const TEAM_FIELDS = ["name", "unit", "description", "leaderId", "status"] as const;

export async function createTeamAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, TEAM_FIELDS);
  const result = await createTeam(values, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/teams/${result.value.id}?notice=created`);
}

export async function updateTeamAction(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, TEAM_FIELDS);
  const result = await updateTeam(teamId, values, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/teams/${teamId}?notice=updated`);
}

export async function addTeamMemberAction(teamId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { personId } = readForm(formData, ["personId"] as const);
  if (!personId) return { status: "error", message: "Select a person to add.", fieldErrors: { personId: "Select a person." } };
  const result = await addTeamMember(teamId, personId, actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect(`/teams/${teamId}?notice=member-added`);
}

export async function removeTeamMemberAction(
  teamId: string,
  personId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const result = await removeTeamMember(teamId, personId, actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect(`/teams/${teamId}?notice=member-removed`);
}
