"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/session";
import { resetDemoData, seedDemoData } from "@/lib/services/demo-data-service";
import { errorState, readForm } from "./helpers";

export async function seedDemoDataAction(_prev: ActionState, _formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const result = await seedDemoData(actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect("/settings?notice=seeded");
}

export async function resetDemoDataAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const actor = await requireAdmin();
  const { confirmation } = readForm(formData, ["confirmation"] as const);
  if (confirmation.trim() !== "RESET") {
    return {
      status: "error",
      message: "Type RESET to confirm.",
      fieldErrors: { confirmation: "Type RESET in capitals to erase all demo records." },
    };
  }
  const result = await resetDemoData(actor);
  if (!result.ok) return errorState(result);
  revalidatePath("/", "layout");
  redirect("/settings?notice=reset");
}
