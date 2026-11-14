"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import {
  registerSoldier,
  registerStaff,
  updateSoldier,
  updateStaff,
} from "@/lib/services/personnel-service";
import { errorState, readForm } from "./helpers";

const SOLDIER_FIELDS = [
  "fullName",
  "serviceNumber",
  "rank",
  "unit",
  "dateOfBirth",
  "sex",
  "bloodGroup",
  "rhFactor",
  "medicalCategory",
  "identificationMarks",
  "nextOfKinName",
  "nextOfKinRelationship",
  "nextOfKinPhone",
  "contactPhone",
  "status",
  "photo",
] as const;

const STAFF_FIELDS = [
  "fullName",
  "serviceNumber",
  "rank",
  "unit",
  "role",
  "designation",
  "professionalRegistration",
  "contactPhone",
  "status",
  "teamId",
  "photo",
  "dateOfBirth",
] as const;

export async function registerSoldierAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, SOLDIER_FIELDS);
  const result = await registerSoldier({ ...values, status: "ACTIVE" }, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/personnel/${result.value.person.id}?notice=registered`);
}

export async function registerStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, STAFF_FIELDS);
  const result = await registerStaff(values, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/personnel/${result.value.id}?notice=registered`);
}

export async function updateSoldierAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, SOLDIER_FIELDS);
  const result = await updateSoldier(id, values, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/personnel/${id}?notice=updated`);
}

export async function updateStaffAction(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const values = readForm(formData, STAFF_FIELDS);
  const result = await updateStaff(id, values, actor);
  if (!result.ok) return errorState(result, values);
  revalidatePath("/", "layout");
  redirect(`/personnel/${id}?notice=updated`);
}
