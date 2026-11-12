"use client";

import { Printer } from "lucide-react";
import { useState, useTransition } from "react";
import { recordPrintAction } from "@/app/actions/identity-actions";
import { buttonClasses } from "@/components/ui/button";

/** Records the print in the audit log, then opens the browser print dialog. */
export function PrintButton({ credentialId }: { credentialId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={buttonClasses("primary", "md")}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await recordPrintAction(credentialId);
            if (result.status === "error") {
              setError(result.message ?? "Could not record the print.");
              return;
            }
            window.print();
          })
        }
      >
        <Printer className="size-4" aria-hidden />
        {pending ? "Preparing…" : "Print label"}
      </button>
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
