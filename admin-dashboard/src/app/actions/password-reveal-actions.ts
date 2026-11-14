"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/lib/auth/session";
import type { AssertionResponseJSON, RegistrationResponseJSON, RelyingParty } from "@/lib/auth/webauthn";
import {
  beginPasskeyRegistration,
  beginPasswordReveal,
  finishPasskeyRegistration,
  finishPasswordReveal,
  revealWithAdminPassword,
  type BeginRevealResult,
  type RegistrationOptionsJSON,
} from "@/lib/services/password-reveal-service";

export type RevealResult = { ok: true; password: string } | { ok: false; message: string };

/**
 * The site the browser must be on. CASEVAC_DASHBOARD_ORIGIN pins it for a
 * deployment (recommended); otherwise it is taken from the request host.
 */
async function relyingParty(): Promise<RelyingParty> {
  const configured = process.env.CASEVAC_DASHBOARD_ORIGIN?.trim();
  let origin: string;
  if (configured) {
    origin = new URL(configured).origin;
  } else {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
    const hostname = host.replace(/:\d+$/, "");
    const local = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
    origin = `${proto}://${host}`;
  }
  return { id: new URL(origin).hostname, origin, name: "CASEVAC Admin" };
}

export async function beginPasswordRevealAction(personId: string): Promise<BeginRevealResult> {
  const actor = await requireAdmin();
  return beginPasswordReveal(actor, await relyingParty(), personId);
}

export async function finishPasswordRevealAction(personId: string, response: AssertionResponseJSON): Promise<RevealResult> {
  const actor = await requireAdmin();
  const result = await finishPasswordReveal(actor, await relyingParty(), personId, response);
  return result.ok ? { ok: true, password: result.value } : { ok: false, message: result.message };
}

export async function revealWithAdminPasswordAction(personId: string, password: string): Promise<RevealResult> {
  const actor = await requireAdmin();
  const result = await revealWithAdminPassword(actor, personId, typeof password === "string" ? password : "");
  return result.ok ? { ok: true, password: result.value } : { ok: false, message: result.message };
}

export async function beginPasskeyRegistrationAction(): Promise<RegistrationOptionsJSON> {
  const actor = await requireAdmin();
  return beginPasskeyRegistration(actor, await relyingParty());
}

export async function finishPasskeyRegistrationAction(
  response: RegistrationResponseJSON,
  label: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const actor = await requireAdmin();
  const result = await finishPasskeyRegistration(actor, await relyingParty(), response, typeof label === "string" ? label : "");
  return result.ok ? { ok: true } : { ok: false, message: result.message };
}
