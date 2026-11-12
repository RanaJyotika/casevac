import { getSession } from "@/lib/auth/session";
import { getCredentialWithPerson, recordCredentialOutput, renderQrPng } from "@/lib/services/identity-service";

/** Downloads the QR as a PNG. Admin session required; ACTIVE QR only. */
export async function GET(_request: Request, ctx: RouteContext<"/api/qr/[credentialId]/png">) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { credentialId } = await ctx.params;
  const row = await getCredentialWithPerson(credentialId);
  if (!row || !row.person) return Response.json({ error: "QR not found" }, { status: 404 });
  if (row.credential.status !== "ACTIVE") {
    return Response.json({ error: "Revoked or replaced QR codes cannot be downloaded" }, { status: 409 });
  }

  const png = await renderQrPng(row.credential.payload);
  await recordCredentialOutput(credentialId, "DOWNLOAD", { id: session.sub, name: session.name });

  const filename = `${row.person.displayId}-qr-v${row.credential.version}.png`;
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
