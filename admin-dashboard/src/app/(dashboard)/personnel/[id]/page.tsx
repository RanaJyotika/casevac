import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Pencil, Printer } from "lucide-react";
import {
  issueQrAction,
  markWristbandIssuedAction,
  reissueQrAction,
  revokeQrAction,
} from "@/app/actions/identity-actions";
import { issueMobileLoginAction, revokeMobileLoginAction } from "@/app/actions/mobile-access-actions";
import { IssueMobileLoginButton } from "@/components/mobile/issue-mobile-login";
import { QrImage } from "@/components/qr/qr-image";
import { ConfirmActionButton, InlineActionButton } from "@/components/ui/action-form";
import { Badge, CredentialStatusBadge, MobileLoginStatusBadge, RecordStatusBadge } from "@/components/ui/badge";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Alert, DefinitionGrid, EmptyState, PageHeader, Panel, Table, Td, Th } from "@/components/ui/layout";
import { CATEGORY_LABELS, PERMISSIONS, ROLE_DEFINITIONS } from "@/lib/domain/roles";
import type { IdentityCredential, SoldierRecord, StaffRecord } from "@/lib/domain/types";
import { BLOOD_GROUP_OPTIONS, RH_OPTIONS, SEX_OPTIONS } from "@/lib/domain/validation";
import { formatDate, formatDateTime, param } from "@/lib/format";
import {
  getMobileAccessForPerson,
  mobileAccessProblem,
  type MobileAccountView,
} from "@/lib/services/mobile-access-service";
import { getPersonProfile } from "@/lib/services/personnel-service";

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
  const profile = await getPersonProfile(id);
  if (!profile) notFound();
  const { person, credentials, teams } = profile;
  const notice = NOTICES[param(sp.notice)];
  const isSoldier = person.category === "SOLDIER";
  const mobileAccess = isSoldier ? null : await getMobileAccessForPerson(person.id);

  return (
    <>
      <PageHeader
        eyebrow={`Personnel / ${CATEGORY_LABELS[person.category]}`}
        title={person.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{person.displayId}</span>
            <RecordStatusBadge status={person.status} />
            {!isSoldier ? <Badge tone="info">{ROLE_DEFINITIONS[person.staff.role].label}</Badge> : null}
          </span>
        }
        actions={
          <LinkButton href={`/personnel/${person.id}/edit`} variant="secondary">
            <Pencil className="size-4" aria-hidden /> Edit details
          </LinkButton>
        }
      />
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {isSoldier ? (
        <SoldierProfile person={person} credentials={credentials} />
      ) : (
        <StaffProfile person={person} mobileAccess={mobileAccess ?? { current: null, history: [] }} teams={teams.map(t => ({ id: t.id, label: `${t.teamCode} — ${t.name}`, leader: t.leaderId === person.id, active: t.status === "ACTIVE" }))} />
      )}
    </>
  );
}

function SoldierProfile({ person, credentials }: { person: SoldierRecord; credentials: IdentityCredential[] }) {
  const s = person.soldier;
  const active = credentials.find(c => c.status === "ACTIVE") ?? null;
  const nok = s.nextOfKin.name
    ? `${s.nextOfKin.name}${s.nextOfKin.relationship ? ` (${s.nextOfKin.relationship})` : ""}${s.nextOfKin.phone ? ` · ${s.nextOfKin.phone}` : ""}`
    : "";

  return (
    <>
      {person.status === "INACTIVE" && active ? (
        <Alert tone="warn" title="Inactive soldier with an active QR">
          This record is inactive but its QR still resolves. Revoke the QR if the wristband should no longer be used.
        </Alert>
      ) : null}
      <div className="flex flex-wrap items-start gap-6">
        <Panel
          title="Registration details"
          className="min-w-0 flex-[999_1_460px]"
          footer={
            <>
              Mobile availability: <strong>not provisioned</strong> — there is no backend sync yet, so medic phones
              cannot resolve this QR.
            </>
          }
        >
          <DefinitionGrid
            items={[
              {
                label: "ID photo",
                value: s.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- stored data URL
                  <img src={s.photo} alt={`ID photo of ${person.fullName}`} className="size-24 rounded-md border border-line object-cover" />
                ) : (
                  ""
                ),
              },
              { label: "Patient ID (display)", value: person.displayId, mono: true },
              { label: "Service number", value: person.serviceNumber, mono: true },
              { label: "Rank", value: person.rank },
              { label: "Unit / formation", value: person.unit },
              { label: "Date of birth", value: s.dateOfBirth ? formatDate(s.dateOfBirth) : "" },
              { label: "Sex", value: s.sex === "NOT_RECORDED" ? "" : SEX_OPTIONS[s.sex] },
              {
                label: "Blood group / Rh",
                value: s.bloodGroup === "UNKNOWN" && s.rhFactor === "UNKNOWN" ? "" : `${BLOOD_GROUP_OPTIONS[s.bloodGroup]} · ${RH_OPTIONS[s.rhFactor]}`,
              },
              { label: "Medical category", value: s.medicalCategory },
              { label: "Identification marks", value: s.identificationMarks },
              { label: "Next of kin", value: nok },
              { label: "Contact phone", value: person.contactPhone },
              { label: "Registered", value: `${formatDateTime(person.registeredAt)} by ${person.registeredBy}` },
              { label: "Last updated", value: formatDateTime(person.updatedAt) },
              { label: "Internal ID", value: person.id, mono: true },
            ]}
          />
        </Panel>

        <Panel
          title="QR wristband"
          actions={active ? <CredentialStatusBadge status="ACTIVE" version={active.version} /> : <Badge tone="warn">No active QR</Badge>}
          className="min-w-0 flex-[1_1_300px]"
        >
          {active ? (
            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col items-center gap-2">
                <div className="rounded border border-line-soft bg-white p-2">
                  <QrImage payload={active.payload} label={`QR code for ${person.displayId}, version ${active.version}`} size={190} />
                </div>
                <span className="font-mono text-base font-semibold">{person.displayId}</span>
                <span className="text-center text-xs text-muted">
                  {active.formatVersion === 2
                    ? `Signed credential (Ed25519, key ${active.keyId}) · Issued ${formatDateTime(active.issuedAt)}`
                    : `Legacy unsigned format v1 · Issued ${formatDateTime(active.issuedAt)}`}
                </span>
                {active.formatVersion !== 2 ? (
                  <Alert tone="warn" title="Unsigned legacy QR">
                    The medic app rejects unsigned wristbands. Reissue this QR to produce a digitally signed credential.
                  </Alert>
                ) : null}
                <span className="text-xs">
                  {active.wristbandIssuedAt ? (
                    <Badge tone="ok">Wristband issued {formatDate(active.wristbandIssuedAt)}</Badge>
                  ) : (
                    <Badge tone="warn">Not yet issued on a wristband</Badge>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`/print/qr/${active.id}`} target="_blank" rel="noopener" className={buttonClasses("primary", "sm")}>
                  <Printer className="size-4" aria-hidden /> Print label
                </a>
                <a href={`/api/qr/${active.id}/png`} download className={buttonClasses("secondary", "sm")}>
                  <Download className="size-4" aria-hidden /> Download PNG
                </a>
                <ConfirmActionButton
                  action={reissueQrAction.bind(null, person.id)}
                  triggerLabel="Reissue QR"
                  fullWidth
                  title={`Reissue QR for ${person.displayId}?`}
                  description={
                    <>
                      A new signed credential (v{active.version + 1}) replaces v{active.version}. The old wristband is
                      marked replaced and phones reject it once their identity directory is refreshed. The patient
                      identity and history are kept.
                    </>
                  }
                  confirmLabel="Reissue QR"
                  reasonField={{ label: "Reason for reissue", placeholder: "e.g. Wristband damaged" }}
                />
                <ConfirmActionButton
                  action={revokeQrAction.bind(null, person.id)}
                  triggerLabel="Revoke"
                  triggerVariant="danger"
                  fullWidth
                  title={`Revoke QR for ${person.displayId}?`}
                  description="The QR stops resolving immediately and no replacement is issued. The soldier will appear under ‘without active QR’."
                  confirmLabel="Revoke QR"
                  confirmVariant="danger"
                  reasonField={{ label: "Reason for revocation", placeholder: "e.g. Wristband lost" }}
                />
              </div>
              {!active.wristbandIssuedAt ? (
                <InlineActionButton
                  action={markWristbandIssuedAction.bind(null, active.id, person.id)}
                  label="Mark wristband as issued"
                  pendingLabel="Saving…"
                />
              ) : null}
              <p className="text-xs text-muted">
                Printed {active.printCount} {active.printCount === 1 ? "time" : "times"}
                {active.lastPrintedAt ? ` · last ${formatDateTime(active.lastPrintedAt)}` : ""}. Reprinting never creates a new identity.
              </p>
            </div>
          ) : (
            <EmptyState title="No active QR">
              <div className="flex flex-col items-center gap-3">
                <span>{person.status === "ACTIVE" ? "Issue a new QR to make this soldier identifiable by wristband." : "Reactivate this soldier before issuing a QR."}</span>
                {person.status === "ACTIVE" ? (
                  <ConfirmActionButton
                    action={issueQrAction.bind(null, person.id)}
                    triggerLabel="Issue QR"
                    triggerVariant="primary"
                    title={`Issue a new QR for ${person.displayId}?`}
                    description="A new digitally signed credential will be generated and linked to this patient identity."
                    confirmLabel="Issue QR"
                  />
                ) : null}
              </div>
            </EmptyState>
          )}
        </Panel>
      </div>

      <Panel title="QR issuance history">
        {credentials.length === 0 ? (
          <EmptyState title="No QR codes issued yet" />
        ) : (
          <Table caption="QR issuance history">
            <thead>
              <tr>
                <Th>Version</Th>
                <Th>Status</Th>
                <Th>Issued</Th>
                <Th>Wristband</Th>
                <Th>Revoked / replaced</Th>
                <Th>Reason</Th>
                <Th>By</Th>
              </tr>
            </thead>
            <tbody>
              {credentials.map(c => (
                <tr key={c.id}>
                  <Td className="font-mono text-[13px]">v{c.version}</Td>
                  <Td>
                    <CredentialStatusBadge status={c.status} />
                  </Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDateTime(c.issuedAt)}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{c.wristbandIssuedAt ? formatDate(c.wristbandIssuedAt) : "—"}</Td>
                  <Td className="whitespace-nowrap text-ink-2">{formatDateTime(c.revokedAt)}</Td>
                  <Td className="text-ink-2">{c.revocationReason ?? (c.version === 1 ? "Initial issue" : "—")}</Td>
                  <Td className="font-mono text-[13px]">{c.revokedBy ?? c.issuedBy}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}

function StaffProfile({
  person,
  teams,
  mobileAccess,
}: {
  person: StaffRecord;
  teams: { id: string; label: string; leader: boolean; active: boolean }[];
  mobileAccess: { current: MobileAccountView | null; history: MobileAccountView[] };
}) {
  const role = ROLE_DEFINITIONS[person.staff.role];
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Panel title="Personnel details" className="min-w-0 flex-[999_1_460px]">
        <DefinitionGrid
          items={[
            { label: "Personnel ID", value: person.displayId, mono: true },
            { label: "Service number", value: person.serviceNumber, mono: true },
            { label: "Rank", value: person.rank },
            { label: "Designation", value: person.staff.designation },
            { label: "Unit / facility", value: person.unit },
            { label: "Professional registration", value: person.staff.professionalRegistration ? `${person.staff.professionalRegistration} (not verified)` : "" },
            { label: "Contact phone", value: person.contactPhone },
            { label: "Medic app sign-in", value: <MobileLoginStatusBadge status={mobileAccess.current?.status ?? null} /> },
            { label: "Registered", value: `${formatDateTime(person.registeredAt)} by ${person.registeredBy}` },
            { label: "Last updated", value: formatDateTime(person.updatedAt) },
          ]}
        />
      </Panel>
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
        <MobileLoginPanel person={person} current={mobileAccess.current} history={mobileAccess.history} />
        <Panel title="Role & permissions" bodyClassName="flex flex-col gap-3 p-5">
          <p className="text-sm">
            <span className="font-semibold">{role.label}</span>{" "}
            {role.clinical ? <Badge tone="info">Clinical</Badge> : <Badge>Non-clinical</Badge>}
          </p>
          <p className="text-sm text-ink-2">{role.description}</p>
          {role.permissions.length ? (
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
              {role.permissions.map(p => (
                <li key={p}>
                  {PERMISSIONS[p].label} <span className="text-xs text-muted">({PERMISSIONS[p].surface})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No system permissions.</p>
          )}
        </Panel>
        <Panel title="Medical teams">
          {teams.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">{role.teamEligible ? "Not assigned to a team." : `${role.label} cannot join medical teams.`}</p>
          ) : (
            <ul>
              {teams.map(t => (
                <li key={t.id} className="flex items-center justify-between gap-2 border-t border-line-soft px-5 py-3 text-sm first:border-t-0">
                  <Link href={`/teams/${t.id}`} className="text-brand hover:underline">
                    {t.label}
                  </Link>
                  <span className="flex gap-1">
                    {t.leader ? <Badge tone="info">Leader</Badge> : null}
                    {!t.active ? <Badge>Inactive team</Badge> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function MobileLoginPanel({
  person,
  current,
  history,
}: {
  person: StaffRecord;
  current: MobileAccountView | null;
  history: MobileAccountView[];
}) {
  const role = ROLE_DEFINITIONS[person.staff.role];
  if (!role.permissions.includes("clinical.record")) {
    return (
      <Panel title="Medic app sign-in">
        <p className="px-5 py-4 text-sm text-muted">{role.label} does not use the medic app.</p>
      </Panel>
    );
  }
  const problem = mobileAccessProblem(person);
  const label = person.displayId;
  const revokedCount = history.filter(a => a.status === "REVOKED").length;

  return (
    <Panel
      title="Medic app sign-in"
      actions={<MobileLoginStatusBadge status={current?.status ?? null} />}
      footer={
        <>
          First sign-in must be online at base camp; the tablet then keeps a hashed copy for offline sign-in. Offline
          sign-ins are reported here when the tablet next connects.
        </>
      }
      bodyClassName="flex flex-col gap-4 p-5"
    >
      {current ? (
        <>
          {current.status === "PENDING_FIRST_LOGIN" ? (
            <Alert tone="warn" title="Not used yet">
              Credentials were issued but the medic has not signed in on a tablet yet. Offline sign-in works only after
              that first online sign-in.
            </Alert>
          ) : null}
          <DefinitionGrid
            items={[
              { label: "User ID", value: current.userId, mono: true },
              { label: "Issued", value: `${formatDateTime(current.issuedAt)} by ${current.issuedBy}` },
              { label: "First sign-in (online)", value: formatDateTime(current.firstLoginAt) },
              { label: "Last online sign-in", value: formatDateTime(current.lastOnlineLoginAt) },
              {
                label: "Last offline sign-in",
                value: current.lastOfflineLoginAt
                  ? `${formatDateTime(current.lastOfflineLoginAt)} (${current.offlineLoginCount} total)`
                  : "None reported",
              },
              { label: "Online sign-ins", value: String(current.onlineLoginCount) },
              { label: "Last device", value: current.lastDevice ?? "" },
            ]}
          />
        </>
      ) : problem ? (
        <p className="text-sm text-muted">{problem}</p>
      ) : (
        <p className="text-sm text-ink-2">
          No sign-in issued. Generate a user ID and password and hand them to {person.fullName}.
        </p>
      )}
      {/*
        One issue/reset button in a fixed position. Issuing a login re-renders
        this panel (no account → account); keeping the button in the same place
        keeps its dialog open, so the one-time password stays visible.
      */}
      {current || !problem ? (
        <div className="flex flex-wrap gap-2">
          <IssueMobileLoginButton
            action={issueMobileLoginAction.bind(null, person.id)}
            triggerLabel={current ? "Reset password" : "Generate app login"}
            triggerVariant={current ? "secondary" : "primary"}
            isReset={Boolean(current)}
            personLabel={label}
          />
          {current ? (
            <ConfirmActionButton
              action={revokeMobileLoginAction.bind(null, person.id)}
              triggerLabel="Revoke sign-in"
              triggerVariant="danger"
              title={`Revoke mobile sign-in for ${label}?`}
              description="Online sign-in stops immediately. A tablet that is offline can still use its saved copy until it next connects to the server, when the copy is deleted."
              confirmLabel="Revoke"
              confirmVariant="danger"
              reasonField={{ label: "Reason", placeholder: "e.g. Tablet lost, posted out" }}
            />
          ) : null}
        </div>
      ) : null}
      {revokedCount ? (
        <p className="text-xs text-muted">
          {revokedCount} earlier {revokedCount === 1 ? "sign-in was" : "sign-ins were"} revoked or reset.
        </p>
      ) : null}
    </Panel>
  );
}
