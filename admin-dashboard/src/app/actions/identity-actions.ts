"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import {
  issueNewCredential,
  markWristbandIssued,
  recordCredentialOutput,
  reissueCredential,
  revokeCredential,
} from "@/lib/services/identity-service";
import { errorState, readForm } from "./helpers";

export async function issueQrAction(personId: string, _prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const result = await issueNewCredential(personId, actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect(`/personnel/${personId}?notice=qr-issued`);
}

export async function reissueQrAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { reason } = readForm(formData, ["reason"] as const);
  const result = await reissueCredential(personId, reason, actor);
  if (!result.ok) return errorState(result, { reason });
  revalidatePath("/", "layout");
  redirect(`/personnel/${personId}?notice=qr-reissued`);
}

export async function revokeQrAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { reason } = readForm(formData, ["reason"] as const);
  const result = await revokeCredential(personId, reason, actor);
  if (!result.ok) return errorState(result, { reason });
  revalidatePath("/", "layout");
  redirect(`/personnel/${personId}?notice=qr-revoked`);
}

export async function markWristbandIssuedAction(
  credentialId: string,
  personId: string,
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const actor = await requireAdmin();
  const result = await markWristbandIssued(credentialId, actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect(`/personnel/${personId}?notice=wristband-issued`);
}

/** Called by the print page immediately before window.print(). */
export async function recordPrintAction(credentialId: string): Promise<ActionState> {
  const actor = await requireAdmin();
  const result = await recordCredentialOutput(credentialId, "PRINT", actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  return { status: "success", message: "Print recorded." };
}
