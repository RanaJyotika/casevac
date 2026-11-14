import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { loadPersonProfileView, PersonProfileDetails, PersonProfileSummary } from "@/components/personnel/person-profile";
import { LinkButton } from "@/components/ui/button";
import { Alert, PageHeader } from "@/components/ui/layout";
import { CATEGORY_LABELS } from "@/lib/domain/roles";
import { param } from "@/lib/format";

export const metadata: Metadata = { title: "Personnel profile" };

const NOTICES: Record<string, string> = {
  registered: "Registration saved.",
  updated: "Changes saved.",
  "qr-issued": "New QR issued.",
  "qr-reissued": "QR reissued. The previous code no longer resolves.",
  "qr-revoked": "QR revoked. This soldier has no active QR until a new one is issued.",
  "wristband-issued": "Wristband marked as issued.",
  "mobile-revoked": "Mobile sign-in revoked. Tablets delete their offline copy the next time they connect.",
};

export default async function PersonProfilePage({ params, searchParams }: PageProps<"/personnel/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const view = await loadPersonProfileView(id);
  if (!view) notFound();
  const { person } = view;
  const notice = NOTICES[param(sp.notice)];

  return (
    <>
      <PageHeader
        eyebrow={`Personnel / ${CATEGORY_LABELS[person.category]}`}
        title={person.fullName}
        description={<PersonProfileSummary person={person} />}
        actions={
          <LinkButton href={`/personnel/${person.id}/edit`} variant="secondary">
            <Pencil className="size-4" aria-hidden /> Edit details
          </LinkButton>
        }
      />
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      <PersonProfileDetails view={view} />
    </>
  );
}
