"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { issueMobileLogin, revokeMobileLogin } from "@/lib/services/mobile-access-service";
import { isLoginStation } from "@/lib/domain/types";
import { errorState, readForm } from "./helpers";

/**
 * Generates (or resets) the medic's mobile sign-in. On success the plaintext
 * password is returned in `values` for one-time display; it is never stored.
 */
export async function issueMobileLoginAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { station } = readForm(formData, ["station"] as const);
  if (!isLoginStation(station)) {
    return { status: "error", message: "Select the login station: RAP or ADS.", values: { station } };
  }
  const result = await issueMobileLogin(personId, actor, station);
  if (!result.ok) return errorState(result, { station });
  revalidatePath(`/personnel/${personId}`);
  revalidatePath("/personnel");
  return {
    status: "success",
    message: "Mobile sign-in generated.",
    values: {
      userId: result.value.account.userId,
      password: result.value.password,
      station: result.value.account.station ?? station,
    },
  };
}

export async function revokeMobileLoginAction(personId: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { reason } = readForm(formData, ["reason"] as const);
  const result = await revokeMobileLogin(personId, reason, actor);
  if (!result.ok) return errorState(result, { reason });
  revalidatePath("/", "layout");
  redirect(`/personnel/${personId}?notice=mobile-revoked`);
}
