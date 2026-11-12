import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addTeamMemberAction, removeTeamMemberAction, updateTeamAction } from "@/app/actions/team-actions";
import { AddMemberForm, TeamForm } from "@/components/forms/team-form";
import { ConfirmActionButton } from "@/components/ui/action-form";
import { Badge, RecordStatusBadge } from "@/components/ui/badge";
import { Alert, EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { ROLE_DEFINITIONS } from "@/lib/domain/roles";
import { formatDateTime, param } from "@/lib/format";
import { getTeamView, listTeamEligibleStaff } from "@/lib/services/team-service";

export const metadata: Metadata = { title: "Team" };

const NOTICES: Record<string, string> = {
  created: "Team created.",
  updated: "Team details saved.",
  "member-added": "Member added.",
  "member-removed": "Member removed.",
};

export default async function TeamDetailPage({ params, searchParams }: PageProps<"/teams/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const [view, eligible] = await Promise.all([getTeamView(id), listTeamEligibleStaff()]);
  if (!view) notFound();
  const { team, leader, members } = view;
  const notice = NOTICES[param(sp.notice)];
  const label = (p: (typeof eligible)[number]) => `${p.displayId} — ${p.fullName} (${ROLE_DEFINITIONS[p.staff.role].label})`;
  const leaders = eligible.map(p => ({ value: p.id, label: label(p) }));
  const candidates = eligible.filter(p => !team.memberIds.includes(p.id)).map(p => ({ value: p.id, label: label(p) }));

  return (
    <>
      <PageHeader
        eyebrow={`Medical teams / ${team.teamCode}`}
        title={team.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{team.teamCode}</span>
            <RecordStatusBadge status={team.status} />
            <span className="text-muted">Updated {formatDateTime(team.updatedAt)}</span>
          </span>
        }
      />
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {team.status === "INACTIVE" ? (
        <Alert tone="warn">This team is inactive. Reactivate it to add members.</Alert>
      ) : null}

      <Panel title={`Members (${members.length})`}>
        {members.length === 0 ? (
          <EmptyState title="No members yet" />
        ) : (
          <Table caption="Team members">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th>Unit</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id}>
                  <Td className="font-mono text-[13px]">
                    <Link href={`/personnel/${m.id}`} className="text-brand hover:underline">
                      {m.displayId}
                    </Link>
                  </Td>
                  <Td>
                    {m.rank} {m.fullName} {leader?.id === m.id ? <Badge tone="info">Leader</Badge> : null}
                  </Td>
                  <Td>{ROLE_DEFINITIONS[m.staff.role].label}</Td>
                  <Td className="text-ink-2">{m.unit}</Td>
                  <Td>
                    <RecordStatusBadge status={m.status} />
                  </Td>
                  <Td className="text-right">
                    {leader?.id === m.id ? (
                      <span className="text-xs text-muted">Change leader to remove</span>
                    ) : (
                      <ConfirmActionButton
                        action={removeTeamMemberAction.bind(null, team.id, m.id)}
                        triggerLabel="Remove"
                        triggerVariant="danger"
                        title={`Remove ${m.displayId} from ${team.teamCode}?`}
                        description="The person keeps their personnel record and other team memberships."
                        confirmLabel="Remove member"
                        confirmVariant="danger"
                      />
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {team.status === "ACTIVE" ? (
          <div className="border-t border-line">
            <AddMemberForm action={addTeamMemberAction.bind(null, team.id)} candidates={candidates} />
          </div>
        ) : null}
      </Panel>

      <Panel title="Team details">
        <TeamForm
          action={updateTeamAction.bind(null, team.id)}
          mode="edit"
          leaders={leaders}
          initial={{
            name: team.name,
            unit: team.unit,
            description: team.description,
            leaderId: team.leaderId ?? "",
            status: team.status,
          }}
        />
      </Panel>
    </>
  );
}
