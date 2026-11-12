import type { Metadata } from "next";
import Link from "next/link";
import { createTeamAction } from "@/app/actions/team-actions";
import { TeamForm } from "@/components/forms/team-form";
import { RecordStatusBadge } from "@/components/ui/badge";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { ROLE_DEFINITIONS } from "@/lib/domain/roles";
import { listTeamEligibleStaff, listTeamViews } from "@/lib/services/team-service";

export const metadata: Metadata = { title: "Medical teams" };

export default async function TeamsPage() {
  const [teams, eligible] = await Promise.all([listTeamViews(), listTeamEligibleStaff()]);
  const leaders = eligible.map(p => ({
    value: p.id,
    label: `${p.displayId} — ${p.fullName} (${ROLE_DEFINITIONS[p.staff.role].label})`,
  }));

  return (
    <>
      <PageHeader
        title="Medical teams"
        description="Group medics and doctors into teams. Members keep their individual personnel identity and may belong to more than one team."
      />
      <Panel title={`Teams (${teams.length})`}>
        {teams.length === 0 ? (
          <EmptyState title="No medical teams yet">Create the first team below.</EmptyState>
        ) : (
          <Table caption="Medical teams">
            <thead>
              <tr>
                <Th>Team ID</Th>
                <Th>Name</Th>
                <Th>Unit</Th>
                <Th>Leader</Th>
                <Th>Members</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {teams.map(({ team, leader, members }) => (
                <tr key={team.id} className="hover:bg-canvas">
                  <Td className="font-mono text-[13px]">
                    <Link href={`/teams/${team.id}`} className="text-brand hover:underline">
                      {team.teamCode}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/teams/${team.id}`} className="font-medium hover:underline">
                      {team.name}
                    </Link>
                  </Td>
                  <Td className="text-ink-2">{team.unit || "—"}</Td>
                  <Td>{leader ? `${leader.rank} ${leader.fullName}` : <span className="text-muted">Not set</span>}</Td>
                  <Td>{members.length}</Td>
                  <Td>
                    <RecordStatusBadge status={team.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      <div id="create" className="scroll-mt-24">
        <Panel title="Create team">
          <TeamForm action={createTeamAction} mode="create" leaders={leaders} />
        </Panel>
      </div>
    </>
  );
}
