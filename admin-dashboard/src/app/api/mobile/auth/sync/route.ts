import { syncMobileDevice, type DeviceSyncInput } from "@/lib/services/mobile-access-service";

/**
 * Called by a tablet whenever it is online: reports offline sign-ins and
 * returns which of its cached accounts are still valid.
 *
 *   POST { device?, accounts: [{ accountId, userId, offlineLogins?: { count, lastAt } }] }
 *   200  { accounts: [{ accountId, status: "VALID" | "REVOKED" }] }
 */
export async function POST(request: Request) {
  let body: Partial<DeviceSyncInput>;
  try {
    body = (await request.json()) as Partial<DeviceSyncInput>;
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }
  const accounts = Array.isArray(body.accounts)
    ? body.accounts.filter(a => a && typeof a.accountId === "string" && typeof a.userId === "string")
    : [];
  const result = await syncMobileDevice({ device: body.device, accounts });
  return Response.json(result, { headers: { "Cache-Control": "no-store" } });
}
