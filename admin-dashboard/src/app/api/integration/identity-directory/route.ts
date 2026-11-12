import { getSession } from "@/lib/auth/session";
import { ok, runTransaction } from "@/lib/services/common";
import { buildIdentityDirectory } from "@/lib/services/directory-service";

/**
 * DEMO integration boundary: downloads the identity directory a phone would
 * need for offline QR resolution. Admin session required. This is NOT device
 * provisioning — see INTEGRATION.md.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });

  const directory = await buildIdentityDirectory();
  await runTransaction({ id: session.sub, name: session.name }, async (_tx, audit) => {
    await audit("DIRECTORY_EXPORTED", "SYSTEM", null, `Exported demo identity directory (${directory.entries.length} entries)`);
    return ok(null);
  });

  return new Response(JSON.stringify(directory, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="casevac-identity-directory-demo.json"`,
      "Cache-Control": "no-store",
    },
  });
}
