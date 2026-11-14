/**
 * Reachability check for the medic app: lets the tablet show Online/Offline
 * and decide whether a first sign-in is possible. Returns no data.
 */
export async function GET() {
  return Response.json(
    { ok: true, service: "casevac-admin", serverTime: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
