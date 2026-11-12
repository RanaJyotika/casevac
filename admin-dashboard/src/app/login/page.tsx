import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/shell/brand-mark";
import { Alert } from "@/components/ui/layout";
import { demoAdminAccount, getSession } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSession()) redirect("/dashboard");
  const account = demoAdminAccount();
  const configured = account.password.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 items-center border-b border-line bg-surface px-6">
        <BrandMark />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="flex w-full max-w-md flex-col gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-bold">Administrator sign in</h1>
            <p className="text-sm text-ink-2">
              Personnel enrolment and QR identity issuance for the Digital Evacuation Program.
            </p>
          </div>
          <Alert tone="warn" title="DEMO MODE">
            Demo authentication only — credentials are not verified against any personnel system. Use fictional
            records only.
          </Alert>
          {!configured ? (
            <Alert tone="danger" title="Sign-in is not configured">
              Set DEMO_ADMIN_PASSWORD and CASEVAC_SESSION_SECRET in .env.local, then restart the server.
            </Alert>
          ) : null}
          <div className="rounded-md border border-line bg-surface p-6">
            <LoginForm demoAdminId={account.id} />
          </div>
          <p className="text-center text-xs text-muted">
            Demo account ID: <span className="font-mono">{account.id}</span> · password is set in .env.local
          </p>
        </div>
      </main>
    </div>
  );
}
