import { LogOut, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/actions/auth-actions";
import { Badge, DemoBadge } from "@/components/ui/badge";
import type { Actor } from "@/lib/domain/types";
import { BrandMark } from "./brand-mark";
import { SidebarNav } from "./sidebar-nav";

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="inline-flex h-9 items-center gap-2 rounded-md px-2.5 text-sm font-medium text-brand hover:bg-brand-soft"
      >
        <LogOut className="size-4" aria-hidden />
        {compact ? <span className="sr-only">Sign out</span> : "Sign out"}
      </button>
    </form>
  );
}

export function AppShell({ actor, dataSourceLabel, children }: { actor: Actor; dataSourceLabel: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <nav aria-label="Main" className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center border-b border-line px-5">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-semibold">{actor.name}</span>
            <span className="font-mono text-xs text-muted">{actor.id}</span>
          </div>
          <SignOutButton compact />
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-surface print:hidden">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-2 sm:px-8">
            <div className="lg:hidden">
              <BrandMark />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DemoBadge />
              <Badge tone="neutral">Data: {dataSourceLabel}</Badge>
              <Badge tone="neutral">Mobile sync: not connected</Badge>
            </div>
            <div className="hidden items-center gap-3 text-sm lg:flex">
              <span className="text-ink-2">
                Signed in as <span className="font-semibold text-ink">{actor.name}</span>
              </span>
              <SignOutButton />
            </div>
          </div>
          {/* Compact navigation below the lg breakpoint */}
          <details className="border-t border-line-soft px-4 py-2 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-ink-2">
              <Menu className="size-4" aria-hidden /> Menu
            </summary>
            <nav aria-label="Main (compact)" className="mt-2 flex flex-col gap-2">
              <SidebarNav />
              <div className="flex items-center justify-between border-t border-line-soft pt-2 text-sm">
                <span className="text-ink-2">{actor.name}</span>
                <SignOutButton />
              </div>
            </nav>
          </details>
        </header>
        <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col gap-6 px-4 py-7 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
