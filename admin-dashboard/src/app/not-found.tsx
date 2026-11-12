import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-start gap-3 px-6 py-20">
      <p className="font-mono text-sm text-muted">404</p>
      <h1 className="text-2xl font-bold">Record not found</h1>
      <p className="text-sm text-ink-2">The page or record does not exist in the current data source.</p>
      <Link href="/dashboard" className={buttonClasses("secondary", "md")}>
        Back to dashboard
      </Link>
    </main>
  );
}
