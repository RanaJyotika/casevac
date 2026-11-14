import { mobileSignIn, type MobileSignInInput } from "@/lib/services/mobile-access-service";

/**
 * Online sign-in for the medic app (see mobile-access-service.ts).
 * Public endpoint: authentication is the user ID + password in the body.
 *
 *   200 { ok: true, profile, firstLogin, serverTime }
 *   400 BAD_REQUEST · 401 INVALID_CREDENTIALS · 403 ACCOUNT_DISABLED · 429 RATE_LIMITED
 */
const STATUS = { BAD_REQUEST: 400, INVALID_CREDENTIALS: 401, ACCOUNT_DISABLED: 403, RATE_LIMITED: 429 } as const;

export async function POST(request: Request) {
  let body: Partial<MobileSignInInput>;
  try {
    body = (await request.json()) as Partial<MobileSignInInput>;
  } catch {
    return Response.json({ ok: false, error: "BAD_REQUEST", message: "Invalid request." }, { status: 400 });
  }
  const result = await mobileSignIn({
    userId: typeof body.userId === "string" ? body.userId : "",
    password: typeof body.password === "string" ? body.password : "",
    device: typeof body.device === "string" ? body.device : undefined,
    offlineLogins: Array.isArray(body.offlineLogins) ? body.offlineLogins : undefined,
  });
  return Response.json(result, {
    status: result.ok ? 200 : STATUS[result.error],
    headers: { "Cache-Control": "no-store" },
  });
}
