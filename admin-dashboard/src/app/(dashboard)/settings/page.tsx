import type { Metadata } from "next";
import { Download } from "lucide-react";
import { logoutAction } from "@/app/actions/auth-actions";
import { resetDemoDataAction, seedDemoDataAction } from "@/app/actions/system-actions";
import { ConfirmActionButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Alert, DefinitionGrid, PageHeader, Panel } from "@/components/ui/layout";
import { requireAdmin } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";
import { QR_FORMAT_VERSION } from "@/lib/domain/qr-format";
import { param } from "@/lib/format";
import { getDashboardSummary } from "@/lib/services/stats-service";
import packageJson from "../../../../package.json";

export const metadata: Metadata = { title: "Settings" };

const NOTICES: Record<string, string> = {
  seeded: "Fictional sample records loaded.",
  reset: "All demo records erased.",
};

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const actor = await requireAdmin();
  const sp = await searchParams;
  const notice = NOTICES[param(sp.notice)];
  const repo = getRepository();
  const summary = await getDashboardSummary();

  return (
    <>
      <PageHeader title="Settings & system status" />
      {notice ? <Alert tone="ok">{notice}</Alert> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Panel title="System status">
          <DefinitionGrid
            items={[
              { label: "Application", value: `CASEVAC Admin Dashboard v${packageJson.version}` },
              { label: "Environment", value: process.env.NODE_ENV === "production" ? "Production build" : "Development" },
              { label: "Data source", value: <span className="flex flex-wrap items-center gap-2"><Badge tone="warn">DEMO</Badge> {repo.description}</span> },
              { label: "Authentication", value: "Demo administrator session (signed cookie, 8 h)" },
              { label: "QR payload format", value: `CASEVAC:${QR_FORMAT_VERSION}:<token>`, mono: true },
              { label: "Backend / PostgreSQL", value: "Not configured" },
              { label: "Mobile synchronisation", value: "Not connected" },
              { label: "RFID / NFC", value: "Not available (future phase)" },
            ]}
          />
        </Panel>

        <Panel title="Session">
          <DefinitionGrid
            items={[
              { label: "Signed in as", value: actor.name },
              { label: "Administrator ID", value: actor.id, mono: true },
              { label: "Role", value: "System Administrator (demo)" },
            ]}
          />
          <div className="p-5">
            <form action={logoutAction}>
              <button type="submit" className={buttonClasses("secondary", "md")}>Sign out</button>
            </form>
          </div>
        </Panel>
      </div>

      <Panel title="Mobile integration">
        <div className="flex flex-col gap-4 p-5 text-sm leading-6 text-ink-2">
          <Alert tone="warn" title="Not synchronised">
            Generating a QR here does <strong>not</strong> make the patient available on a disconnected medic phone.
            Phones need a provisioned identity directory, which requires the shared backend, device enrolment and
            encryption. None of these exist yet.
          </Alert>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>Mobile app scans the wristband and parses <span className="font-mono">CASEVAC:1:&lt;token&gt;</span>.</li>
            <li>It looks the token up in a locally cached, encrypted identity directory (provisioned while online).</li>
            <li>If found, it shows the verified identity; if not, it reports “Identity not available offline”.</li>
            <li>Evacuation incidents and clinical events stay in the mobile app and sync later via the backend.</li>
          </ol>
          <p>
            For integration testing you can download the directory format the backend will serve. It contains only active
            soldiers with an active QR and minimal identity fields.
          </p>
          <div>
            <a href="/api/integration/identity-directory" className={buttonClasses("secondary", "md")}>
              <Download className="size-4" aria-hidden /> Download demo identity directory (JSON)
            </a>
          </div>
          <p className="text-xs text-muted">The export is unencrypted and for fictional demo data only. Each download is logged.</p>
        </div>
      </Panel>

      <Panel title="Demo data">
        <div className="flex flex-col gap-4 p-5 text-sm text-ink-2">
          <p>
            Records are stored in a local JSON file on the dashboard server. It is not encrypted or backed up and must
            never hold real personnel data.
          </p>
          <div className="flex flex-wrap gap-3">
            {summary.isEmpty ? (
              <ConfirmActionButton
                action={seedDemoDataAction}
                triggerLabel="Load fictional sample records"
                triggerVariant="primary"
                title="Load fictional sample records?"
                description="Adds 3 fictional soldiers (with QR), 2 medics, 1 doctor and 1 medical team. Only available when the store is empty."
                confirmLabel="Load sample records"
              />
            ) : (
              <span className="text-xs text-muted">Sample records can be loaded only into an empty store.</span>
            )}
            <ConfirmActionButton
              action={resetDemoDataAction}
              triggerLabel="Erase all demo records"
              triggerVariant="danger"
              title="Erase all demo records?"
              description="Deletes every person, QR record, team and activity entry in the demo store. This cannot be undone."
              confirmLabel="Erase everything"
              confirmVariant="danger"
              confirmTextField={{ label: "Type RESET to confirm" }}
            />
          </div>
        </div>
      </Panel>
    </>
  );
}
