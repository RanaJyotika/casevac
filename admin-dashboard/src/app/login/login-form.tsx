"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth-actions";
import { TextField } from "@/components/ui/fields";
import { Alert } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE_STATE } from "@/lib/action-state";

export function LoginForm({ demoAdminId }: { demoAdminId: string }) {
  const [state, formAction] = useActionState(loginAction, IDLE_STATE);
  const showSummary = state.status === "error" && !state.fieldErrors;
  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {showSummary ? (
        <Alert tone="danger" title="Sign-in failed">
          {state.message}
        </Alert>
      ) : null}
      <TextField
        name="adminId"
        label="Administrator ID"
        required
        autoComplete="username"
        placeholder={`e.g. ${demoAdminId}`}
        defaultValue={state.values?.adminId}
        error={state.fieldErrors?.adminId}
      />
      <TextField
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Signing in…" className="mt-1 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
