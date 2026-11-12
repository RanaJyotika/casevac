"use client";

import { Alert } from "@/components/ui/layout";
import { Button } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Alert tone="danger" title="This page could not be loaded">
        {error.message || "An unexpected error occurred."} No data was changed by this error.
      </Alert>
      <div>
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
