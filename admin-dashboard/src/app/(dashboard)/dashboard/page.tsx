import type { Metadata } from "next";
import Link from "next/link";
import { Badge, RecordStatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Alert, EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { CATEGORY_LABELS } from "@/lib/domain/roles";
import { formatDateTime } from "@/lib/format";
import { getDashboardSummary } from "@/lib/services/stats-service";

export const metadata: Metadata = { title: "Dashboard" };

function StatCard({ label, value, detail, href }: { label: string; value: number; detail: string; href: string }) {
  return (
    <Link href={href} className="flex flex-col gap-1.5 rounded-md border border-line bg-surface p-4 hover:border-brand">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-3xl font-bold text-ink">{value}</span>
      <span className="text-xs text-muted">{detail}</span>
    </Link>
  );
}

export default async function DashboardPage() {
  const s = await getDashboardSummary();
  const attention = [
    { count: s.soldiersWithoutActiveQr, text: "Active soldiers without an active QR", href: "/qr?view=unassigned" },
    { count: s.qr.awaitingWristband, text: "QR codes not yet marked as issued on a wristband", href: "/qr?view=awaiting" },
    { count: s.clinicalStaffWithoutTeam, text: "Team-eligible personnel not in an active team", href: "/teams" },
  ].filter(item => item.count > 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Figures are calculated live from the current data source."
      />

      <Alert tone="info">
        Fictional records only. Registered identities are <strong>not yet available on medic phones</strong> — mobile
        provisioning requires the backend (see Settings → Mobile integration).
      </Alert>

      {s.isEmpty ? (
        <Panel>
          <EmptyState
            title="No records yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/register/soldier">Register soldier</LinkButton>
                <LinkButton href="/settings" variant="secondary">
                  Load fictional sample data
                </LinkButton>
              </div>
            }
          >
            Register the first soldier, or load clearly fictional sample records from Settings.
          </EmptyState>
        </Panel>
      ) : null}

      <section aria-label="Totals" className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        <StatCard label="Soldiers" value={s.people.SOLDIER.total} detail={`${s.people.SOLDIER.active} active`} href="/personnel?category=SOLDIER" />
        <StatCard label="Medics" value={s.people.MEDIC.total} detail={`${s.people.MEDIC.active} active`} href="/personnel?category=MEDIC" />
        <StatCard label="Doctors / MOs" value={s.people.DOCTOR.total} detail={`${s.people.DOCTOR.active} active`} href="/personnel?category=DOCTOR" />
        <StatCard label="Active medical teams" value={s.teams.active} detail={`${s.teams.total} teams in total`} href="/teams" />
        <StatCard label="Active QR codes" value={s.qr.active} detail={`${s.qr.revokedOrReplaced} revoked or replaced`} href="/qr" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <Panel
          title="Recent registrations"
          actions={<Link href="/personnel" className="text-sm font-medium text-brand hover:underline">View directory</Link>}
          className="min-w-0 flex-[999_1_520px]"
        >
          {s.recentRegistrations.length === 0 ? (
            <EmptyState title="No registrations yet" />
          ) : (
            <Table caption="Recent registrations">
              <thead>
                <tr>
                  <Th>ID</Th>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Unit</Th>
                  <Th>Status</Th>
                  <Th>Registered</Th>
                </tr>
              </thead>
              <tbody>
                {s.recentRegistrations.map(p => (
                  <tr key={p.id}>
                    <Td className="font-mono text-[13px]">
                      <Link href={`/personnel/${p.id}`} className="text-brand hover:underline">
                        {p.displayId}
                      </Link>
                    </Td>
                    <Td>{p.fullName}</Td>
                    <Td>{CATEGORY_LABELS[p.category]}</Td>
                    <Td className="text-ink-2">{p.unit}</Td>
                    <Td>
                      <RecordStatusBadge status={p.status} />
                    </Td>
                    <Td className="whitespace-nowrap text-ink-2">{formatDateTime(p.registeredAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <Panel title="Needs attention">
            {attention.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted">No pending administrative actions.</p>
            ) : (
              <ul>
                {attention.map(item => (
                  <li key={item.text} className="border-t border-line-soft first:border-t-0">
                    <Link href={item.href} className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-canvas">
                      <Badge tone="warn">{item.count}</Badge>
                      {item.text}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Quick actions" bodyClassName="flex flex-col gap-2 p-4">
            <LinkButton href="/register/soldier">Register soldier</LinkButton>
            <div className="grid grid-cols-3 gap-2">
              <LinkButton href="/register/staff?role=MEDIC" variant="secondary">Medic</LinkButton>
              <LinkButton href="/register/staff?role=MEDICAL_OFFICER" variant="secondary">Doctor</LinkButton>
              <LinkButton href="/teams#create" variant="secondary">Team</LinkButton>
            </div>
          </Panel>
        </div>
      </div>

      <Panel title="Recent administrative activity">
        {s.recentActivity.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No activity recorded yet.</p>
        ) : (
          <ul>
            {s.recentActivity.map(e => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line-soft px-5 py-2.5 text-sm first:border-t-0">
                <span>{e.summary}</span>
                <span className="text-xs text-muted">
                  <span className="font-mono">{e.actorId}</span> · {formatDateTime(e.at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
