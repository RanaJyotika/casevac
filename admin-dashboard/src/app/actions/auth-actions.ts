"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { endSession, getSession, startSession, verifyDemoCredentials } from "@/lib/auth/session";
import { ok, runTransaction } from "@/lib/services/common";
import { readForm } from "./helpers";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { adminId, password } = readForm(formData, ["adminId", "password"] as const);
  const fieldErrors: Record<string, string> = {};
  if (!adminId.trim()) fieldErrors.adminId = "Enter your administrator ID.";
  if (!password) fieldErrors.password = "Enter your password.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Please complete both fields.", fieldErrors, values: { adminId } };
  }

  const actor = verifyDemoCredentials(adminId, password);
  if (!actor) {
    return { status: "error", message: "Administrator ID or password not recognised.", values: { adminId } };
  }
  await startSession(actor);
  await runTransaction(actor, async (_tx, audit) => {
    await audit("ADMIN_SIGNED_IN", "SYSTEM", null, `${actor.id} signed in (demo session)`);
    return ok(null);
  });
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    const actor = { id: session.sub, name: session.name };
    await runTransaction(actor, async (_tx, audit) => {
      await audit("ADMIN_SIGNED_OUT", "SYSTEM", null, `${actor.id} signed out`);
      return ok(null);
    });
  }
  await endSession();
  redirect("/login");
}
