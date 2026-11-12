import type { ReactNode } from "react";
import type { CredentialStatus, RecordStatus } from "@/lib/domain/types";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-canvas text-ink-2",
  ok: "border-ok-line bg-ok-bg text-ok",
  warn: "border-warn-line bg-warn-bg text-warn",
  danger: "border-danger-line bg-danger-bg text-danger",
  info: "border-[#c5d4e0] bg-brand-soft text-brand-hover",
};

/** Text-labelled status chip. Meaning never depends on colour alone. */
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function RecordStatusBadge({ status }: { status: RecordStatus }) {
  return status === "ACTIVE" ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>;
}

export function CredentialStatusBadge({ status, version }: { status: CredentialStatus; version?: number }) {
  const suffix = version ? ` · v${version}` : "";
  if (status === "ACTIVE") return <Badge tone="ok">Active{suffix}</Badge>;
  if (status === "REPLACED") return <Badge tone="neutral">Replaced{suffix}</Badge>;
  return <Badge tone="danger">Revoked{suffix}</Badge>;
}

export function DemoBadge() {
  return <Badge tone="warn">DEMO MODE</Badge>;
}
