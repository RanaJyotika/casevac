import type { Metadata } from "next";
import { registerStaffAction } from "@/app/actions/personnel-actions";
import { StaffForm } from "@/components/forms/staff-form";
import { Alert, PageHeader } from "@/components/ui/layout";
import { isRoleId, ROLE_DEFINITIONS, ROLE_IDS } from "@/lib/domain/roles";
import { param } from "@/lib/format";
import { listActiveTeams } from "@/lib/services/team-service";

export const metadata: Metadata = { title: "Register medic / doctor" };

export default async function RegisterStaffPage({ searchParams }: PageProps<"/register/staff">) {
  const sp = await searchParams;
  const requestedRole = param(sp.role);
  const teams = await listActiveTeams();
  const roles = ROLE_IDS.map(id => ({
    value: id,
    label: ROLE_DEFINITIONS[id].label,
    description: ROLE_DEFINITIONS[id].description,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Personnel / Register"
        title="Register medic, doctor or other personnel"
        description="Generates a unique personnel ID (MED-, DOC- or STF-) and records the approved role."
      />
      <Alert tone="info">
        Registration records identity and role only. It does <strong>not</strong> verify professional credentials or
        issue sign-in credentials for the mobile app — both require client-approved processes.
      </Alert>
      <div className="max-w-4xl">
        <StaffForm
          action={registerStaffAction}
          mode="create"
          roles={roles}
          teams={teams.map(t => ({ value: t.id, label: `${t.teamCode} — ${t.name}` }))}
          initial={{ role: isRoleId(requestedRole) ? requestedRole : "" }}
          cancelHref="/personnel"
        />
      </div>
    </>
  );
}
