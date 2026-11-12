import type { Metadata } from "next";
import Link from "next/link";
import { Badge, CredentialStatusBadge } from "@/components/ui/badge";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { formatDate, formatDateTime, param } from "@/lib/format";
import {
  listCredentialRows,
  listSoldiersWithoutActiveQr,
  type CredentialFilter,
} from "@/lib/services/identity-service";

export const metadata: Metadata = { title: "QR management" };

const VIEWS = {
  all: { label: "All QR records", filter: {} as CredentialFilter },
  active: { label: "Active", filter: { status: "ACTIVE" } as CredentialFilter },
  awaiting: { label: "Awaiting wristband", filter: { awaitingWristband: true } as CredentialFilter },
  revoked: { label: "Revoked", filter: { status: "REVOKED" } as CredentialFilter },
  replaced: { label: "Replaced", filter: { status: "REPLACED" } as CredentialFilter },
  unassigned: { label: "Soldiers without QR", filter: {} as CredentialFilter },
} as const;
type ViewKey = keyof typeof VIEWS;

export default async function QrManagementPage({ searchParams }: PageProps<"/qr">) {
  const sp = await searchParams;
  const viewRaw = param(sp.view);
  const view: ViewKey = viewRaw in VIEWS ? (viewRaw as ViewKey) : "all";
  const q = param(sp.q);

  const [rows, withoutQr] = await Promise.all([
    view === "unassigned" ? Promise.resolve([]) : listCredentialRows({ ...VIEWS[view].filter, q }),
    listSoldiersWithoutActiveQr(),
  ]);
  const unassigned = q
    ? withoutQr.filter(p => `${p.displayId} ${p.fullName} ${p.serviceNumber}`.toUpperCase().includes(q.toUpperCase()))
    : withoutQr;
  const href = (v: ViewKey) => `/qr?view=${v}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="QR management"
        description="Every QR ever issued is kept for traceability. Only one QR per soldier can be active; reissue and revocation are done from the soldier's profile."
      />

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line p-4">
          <nav aria-label="QR views" className="flex flex-wrap gap-1">
            {(Object.keys(VIEWS) as ViewKey[]).map(v => (
              <Link
                key={v}
                href={href(v)}
                aria-current={v === view ? "page" : undefined}
                className={`rounded-md px-3 py-2 text-sm ${v === view ? "bg-brand-soft font-semibold text-brand-hover" : "text-ink-2 hover:bg-canvas"}`}
              >
                {VIEWS[v].label}
                {v === "unassigned" && withoutQr.length > 0 ? <span className="ml-1.5"><Badge tone="warn">{withoutQr.length}</Badge></span> : null}
              </Link>
            ))}
          </nav>
          <form method="get" role="search" className="flex gap-2">
            <input type="hidden" name="view" value={view} />
            <label htmlFor="qr-q" className="sr-only">Search by patient ID, name or service number</label>
            <input id="qr-q" name="q" defaultValue={q} placeholder="Patient ID, name or service no." className="h-9 w-64 rounded-md border border-line px-3 text-sm" />
            <button type="submit" className={buttonClasses("secondary", "sm")}>Search</button>
          </form>
        </div>

        {view === "unassigned" ? (
          unassigned.length === 0 ? (
            <EmptyState title="Every active soldier has an active QR" />
          ) : (
            <Table caption="Active soldiers without an active QR">
              <thead>
                <tr>
                  <Th>Patient ID</Th>
                  <Th>Name</Th>
                  <Th>Unit</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {unassigned.map(p => (
                  <tr key={p.id}>
                    <Td className="font-mono text-[13px]">{p.displayId}</Td>
                    <Td>{p.fullName}</Td>
                    <Td className="text-ink-2">{p.unit}</Td>
                    <Td className="text-right">
                      <LinkButton href={`/personnel/${p.id}`} size="sm" variant="secondary">Open profile to issue QR</LinkButton>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )
        ) : rows.length === 0 ? (
          <EmptyState title="No QR records in this view" />
        ) : (
          <Table caption="QR records">
            <thead>
              <tr>
                <Th>Patient ID</Th>
                <Th>Name</Th>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Issued</Th>
                <Th>Wristband</Th>
                <Th>Prints</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ credential: c, person }) => (
                <tr key={c.id} className="hover:bg-canvas">
                  <Td className="font-mono text-[13px]">
                    {person ? (
                      <Link href={`/personnel/${person.id}`} className="text-brand hover:underline">{person.displayId}</Link>
                    ) : "—"}
                  </Td>
                  <Td>{person?.fullName ?? <span className="text-danger">Missing person record</span>}</Td>
                  <Td className="font-mono text-[13px]">v{c.version}</Td>
                  <Td>
                    <CredentialStatusBadge status={c.status} />
                    {c.revocationReason ? <div className="mt-1 text-xs text-muted">{c.revocationReason}</div> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDateTime(c.issuedAt)}</Td>
                  <Td className="whitespace-nowrap">
                    {c.status !== "ACTIVE" ? "—" : c.wristbandIssuedAt ? formatDate(c.wristbandIssuedAt) : <Badge tone="warn">Not issued</Badge>}
                  </Td>
                  <Td>{c.printCount}</Td>
                  <Td className="text-right">
                    {c.status === "ACTIVE" ? (
                      <span className="inline-flex gap-1">
                        <a href={`/print/qr/${c.id}`} target="_blank" rel="noopener" className={buttonClasses("ghost", "sm")}>Reprint</a>
                        <a href={`/api/qr/${c.id}/png`} download className={buttonClasses("ghost", "sm")}>PNG</a>
                      </span>
                    ) : (
                      <span className="text-xs text-muted">Not printable</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
