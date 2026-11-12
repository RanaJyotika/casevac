import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Alert, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { PERMISSIONS, ROLE_DEFINITIONS, ROLE_IDS, type Permission } from "@/lib/domain/roles";

export const metadata: Metadata = { title: "Roles & access" };

export default function RolesPage() {
  const permissionIds = Object.keys(PERMISSIONS) as Permission[];
  return (
    <>
      <PageHeader
        title="Roles & access"
        description="Predefined MVP roles. New roles can be added in code (lib/domain/roles.ts) once approved by the client."
      />
      <Alert tone="warn" title="Reference only in the MVP">
        Only the demo System Administrator can sign in to this dashboard. Roles are recorded against personnel so
        permissions can be enforced once real accounts, the backend and mobile authentication exist. Administrative
        roles never receive clinical permissions automatically. Soldiers have no system access.
      </Alert>

      <Panel title="Role definitions">
        <Table caption="Role definitions">
          <thead>
            <tr>
              <Th>Role</Th>
              <Th>Type</Th>
              <Th>Team member</Th>
              <Th>Description</Th>
            </tr>
          </thead>
          <tbody>
            {ROLE_IDS.map(id => {
              const r = ROLE_DEFINITIONS[id];
              return (
                <tr key={id}>
                  <Td>
                    <div className="font-medium">{r.label}</div>
                    <div className="font-mono text-xs text-muted">{r.id}</div>
                  </Td>
                  <Td>{r.clinical ? <Badge tone="info">Clinical</Badge> : <Badge>Non-clinical</Badge>}</Td>
                  <Td>{r.teamEligible ? "Yes" : "No"}</Td>
                  <Td className="text-ink-2">{r.description}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Panel>

      <Panel title="Permission matrix">
        <Table caption="Permissions by role">
          <thead>
            <tr>
              <Th>Permission</Th>
              {ROLE_IDS.map(id => (
                <Th key={id} className="text-center">{ROLE_DEFINITIONS[id].label}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissionIds.map(p => (
              <tr key={p}>
                <Td>
                  <div>{PERMISSIONS[p].label}</div>
                  <div className="text-xs text-muted">{PERMISSIONS[p].surface}</div>
                </Td>
                {ROLE_IDS.map(id => {
                  const has = ROLE_DEFINITIONS[id].permissions.includes(p);
                  return (
                    <Td key={id} className="text-center">
                      {has ? (
                        <Check className="mx-auto size-4 text-ok" aria-label="Granted" />
                      ) : (
                        <Minus className="mx-auto size-4 text-line" aria-label="Not granted" />
                      )}
                    </Td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
