import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Badge, CredentialStatusBadge, MobileLoginStatusBadge, RecordStatusBadge } from "@/components/ui/badge";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { CATEGORY_LABELS, ROLE_DEFINITIONS, ROLE_IDS, isRoleId } from "@/lib/domain/roles";
import type { PersonCategory, RecordStatus } from "@/lib/domain/types";
import { formatDate, param } from "@/lib/format";
import { listLiveMobileAccounts } from "@/lib/services/mobile-access-service";
import { listPersonnel, listUnits } from "@/lib/services/personnel-service";

export const metadata: Metadata = { title: "Personnel" };

const selectClass = "h-10 rounded-md border border-line bg-surface px-3 text-sm";

export default async function PersonnelPage({ searchParams }: PageProps<"/personnel">) {
  const sp = await searchParams;
  const q = param(sp.q);
  const categoryRaw = param(sp.category);
  const category = (categoryRaw in CATEGORY_LABELS ? categoryRaw : "") as PersonCategory | "";
  const roleRaw = param(sp.role);
  const role = isRoleId(roleRaw) ? roleRaw : "";
  const unit = param(sp.unit);
  const statusRaw = param(sp.status);
  const status = (statusRaw === "ACTIVE" || statusRaw === "INACTIVE" ? statusRaw : "") as RecordStatus | "";
  const filtered = Boolean(q || category || role || unit || status);

  const [rows, units, mobileAccounts] = await Promise.all([
    listPersonnel({ q, category, role, unit, status }),
    listUnits(),
    listLiveMobileAccounts(),
  ]);

  return (
    <>
      <PageHeader
        title="Personnel directory"
        description="Soldiers (patient identities) and authorised personnel registered in this data source."
        actions={
          <>
            <LinkButton href="/register/soldier">Register soldier</LinkButton>
            <LinkButton href="/register/staff" variant="secondary">
              Register medic / doctor
            </LinkButton>
          </>
        }
      />

      <Panel>
        <form method="get" role="search" className="flex flex-wrap items-end gap-3 border-b border-line p-4">
          <div className="flex min-w-[220px] flex-[2_1_260px] flex-col gap-1.5">
            <label htmlFor="q" className="text-[13px] font-medium">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                id="q"
                name="q"
                defaultValue={q}
                placeholder="Name, service number or ID"
                className="h-10 w-full rounded-md border border-line bg-surface pr-3 pl-9 text-sm"
              />
            </div>
          </div>
          <div className="flex flex-[1_1_150px] flex-col gap-1.5">
            <label htmlFor="category" className="text-[13px] font-medium">Type</label>
            <select id="category" name="category" defaultValue={category} className={selectClass}>
              <option value="">All types</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-[1_1_170px] flex-col gap-1.5">
            <label htmlFor="role" className="text-[13px] font-medium">Role</label>
            <select id="role" name="role" defaultValue={role} className={selectClass}>
              <option value="">All roles</option>
              {ROLE_IDS.map(id => (
                <option key={id} value={id}>{ROLE_DEFINITIONS[id].label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-[1_1_170px] flex-col gap-1.5">
            <label htmlFor="unit" className="text-[13px] font-medium">Unit</label>
            <select id="unit" name="unit" defaultValue={unit} className={selectClass}>
              <option value="">All units</option>
              {units.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-[1_1_120px] flex-col gap-1.5">
            <label htmlFor="status" className="text-[13px] font-medium">Status</label>
            <select id="status" name="status" defaultValue={status} className={selectClass}>
              <option value="">Any</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className={buttonClasses("primary", "md")}>Apply</button>
            {filtered ? <LinkButton href="/personnel" variant="secondary">Clear</LinkButton> : null}
          </div>
        </form>

        <p className="px-4 py-2.5 text-xs text-muted" aria-live="polite">
          {rows.length} {rows.length === 1 ? "record" : "records"}
          {filtered ? " match the current filters" : ""}
        </p>

        {rows.length === 0 ? (
          <EmptyState
            title={filtered ? "No personnel match these filters" : "No personnel registered yet"}
            action={filtered ? <LinkButton href="/personnel" variant="secondary">Clear filters</LinkButton> : <LinkButton href="/register/soldier">Register soldier</LinkButton>}
          />
        ) : (
          <Table caption="Personnel">
            <thead>
              <tr>
                <Th>ID</Th>
                <Th>Name</Th>
                <Th>Service no.</Th>
                <Th>Type / role</Th>
                <Th>Unit</Th>
                <Th>Identity / team</Th>
                <Th>Status</Th>
                <Th>Registered</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, activeCredential, teams }) => (
                <tr key={person.id} className="hover:bg-canvas">
                  <Td className="font-mono text-[13px]">
                    <Link href={`/personnel/${person.id}`} className="text-brand hover:underline">
                      {person.displayId}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/personnel/${person.id}`} className="font-medium hover:underline">
                      {person.fullName}
                    </Link>
                    <div className="text-xs text-muted">{person.rank}</div>
                  </Td>
                  <Td className="font-mono text-[13px] text-ink-2">{person.serviceNumber}</Td>
                  <Td>
                    {person.category === "SOLDIER" ? "Soldier" : ROLE_DEFINITIONS[person.staff.role].label}
                    {person.category !== "SOLDIER" && ROLE_DEFINITIONS[person.staff.role].permissions.includes("clinical.record") ? (
                      <div className="mt-1">
                        <MobileLoginStatusBadge status={mobileAccounts.get(person.id)?.status ?? null} />
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-ink-2">{person.unit}</Td>
                  <Td>
                    {person.category === "SOLDIER" ? (
                      activeCredential ? (
                        <CredentialStatusBadge status="ACTIVE" version={activeCredential.version} />
                      ) : (
                        <Badge tone="warn">No active QR</Badge>
                      )
                    ) : teams.length ? (
                      <span className="font-mono text-[13px]">{teams.map(t => t.teamCode).join(", ")}</span>
                    ) : (
                      <span className="text-muted">No team</span>
                    )}
                  </Td>
                  <Td>
                    <RecordStatusBadge status={person.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDate(person.registeredAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}
