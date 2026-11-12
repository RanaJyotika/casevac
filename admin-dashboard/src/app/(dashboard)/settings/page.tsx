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
import { getIssuerKey } from "@/lib/crypto/qr-issuer";
import { QR_FORMAT_DESCRIPTION } from "@/lib/domain/qr-format";
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
  const issuer = getIssuerKey();

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
              { label: "QR payload format", value: QR_FORMAT_DESCRIPTION, mono: true },
              {
                label: "QR signing key",
                value: issuer.ok ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="warn">DEVELOPMENT</Badge> Ed25519 · key ID <span className="font-mono">{issuer.key.keyId}</span>
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2"><Badge tone="danger">Not configured</Badge> {issuer.message}</span>
                ),
              },
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
            Generating a QR here does <strong>not</strong> make the patient&apos;s details available on a disconnected
            medic phone. A phone can verify the QR signature offline, but names and revocations come from an identity
            directory provisioned to it beforehand. Live provisioning needs the shared backend, device enrolment and
            encryption, none of which exist yet.
          </Alert>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            <li>The medic app scans the wristband and checks the Ed25519 signature against its trusted issuer public key.</li>
            <li>It looks the credential up in its local identity directory to check revocation and show the soldier&apos;s details.</li>
            <li>A verified credential missing from the directory is shown as “Patient details unavailable offline”, never guessed.</li>
            <li>Evacuation incidents and clinical events stay in the mobile app and sync later via the backend.</li>
          </ol>
          {issuer.ok ? (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Issuer public key (phones trust this)</span>
              <code className="break-all rounded border border-line-soft bg-canvas p-2 font-mono text-xs">{issuer.key.publicKeyBase64Url}</code>
            </div>
          ) : null}
          <p>
            <strong>Demo provisioning:</strong> run <span className="font-mono">npm run mobile:provision</span> in
            admin-dashboard to write the identity directory and trusted public key into the mobile app, then reload the
            app. You can also download the directory for inspection; it lists active soldiers with an active signed QR
            plus the revoked/replaced credential list.
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
