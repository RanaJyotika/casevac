import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QrImage } from "@/components/qr/qr-image";
import { buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth/session";
import { getCredentialWithPerson } from "@/lib/services/identity-service";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Print QR label" };

/**
 * Wristband label. Shows only the display ID and QR (data minimisation):
 * no name, service number or medical data is printed.
 */
export default async function PrintQrPage({ params }: PageProps<"/print/qr/[credentialId]">) {
  await requireAdmin();
  const { credentialId } = await params;
  const row = await getCredentialWithPerson(credentialId);
  if (!row || !row.person) notFound();
  const { credential, person } = row;
  const printable = credential.status === "ACTIVE";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 print:p-0">
      <div className="flex flex-col gap-3 print:hidden">
        <h1 className="text-xl font-bold">Print wristband label — {person.displayId}</h1>
        <Alert tone="warn" title="Demonstration label">
          Fictional record. The label shows the display ID and QR only. Use your printer’s actual-size setting.
        </Alert>
        <div className="flex flex-wrap gap-2">
          {printable ? <PrintButton credentialId={credential.id} /> : null}
          <Link href={`/personnel/${person.id}`} className={buttonClasses("secondary", "md")}>
            Back to profile
          </Link>
        </div>
        {!printable ? (
          <Alert tone="danger">This QR is {credential.status.toLowerCase()} and cannot be printed.</Alert>
        ) : null}
      </div>

      {printable ? (
        <div className="mx-auto flex w-[62mm] flex-col items-center gap-1.5 rounded border border-dashed border-line p-3 print:border-solid print:border-ink">
          <span className="text-[9pt] font-bold tracking-[0.15em]">CASEVAC</span>
          <QrImage payload={credential.payload} label={`QR code for ${person.displayId}`} size={170} />
          <span className="font-mono text-[12pt] font-semibold">{person.displayId}</span>
          <span className="text-[7pt] text-ink-2">QR v{credential.version} · DEMO</span>
        </div>
      ) : null}
    </div>
  );
}
