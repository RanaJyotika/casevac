import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAdmin } from "@/lib/auth/session";
import { getRepository } from "@/lib/data";

/** Every route in this group requires a (demo) admin session, checked on the server. */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const actor = await requireAdmin();
  const repo = getRepository();
  const dataSourceLabel = repo.kind === "demo-file" ? "local demo file" : "backend";
  return (
    <AppShell actor={actor} dataSourceLabel={dataSourceLabel}>
      {children}
    </AppShell>
  );
}
