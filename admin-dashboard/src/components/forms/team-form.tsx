"use client";

import { useActionState } from "react";
import { SelectField, TextAreaField, TextField, toOptions } from "@/components/ui/fields";
import { Alert } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE_STATE, type ActionState } from "@/lib/action-state";
import { STATUS_OPTIONS } from "@/lib/domain/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export function TeamForm({
  action,
  mode,
  leaders,
  initial = {},
}: {
  action: Action;
  mode: "create" | "edit";
  leaders: { value: string; label: string }[];
  initial?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="flex flex-col gap-4 p-5" noValidate>
      {state.status === "error" ? <Alert tone="danger" title="Not saved">{state.message}</Alert> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TextField name="name" label="Team name" required maxLength={60} defaultValue={v.name} error={e.name} placeholder="e.g. Forward Evacuation Team B" />
        <TextField name="unit" label="Unit" maxLength={80} defaultValue={v.unit} error={e.unit} />
        <SelectField
          name="leaderId"
          label="Team leader"
          placeholder="No leader yet"
          options={leaders}
          defaultValue={v.leaderId}
          error={e.leaderId}
          hint={leaders.length === 0 ? "Register an active medic, doctor or team leader first." : "The leader is added as a member automatically."}
        />
        <SelectField name="status" label="Status" options={toOptions(STATUS_OPTIONS)} defaultValue={v.status || "ACTIVE"} error={e.status} />
        <TextAreaField name="description" label="Description" maxLength={200} rows={2} defaultValue={v.description} error={e.description} className="sm:col-span-2" />
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving…">{mode === "create" ? "Create team" : "Save team"}</SubmitButton>
      </div>
    </form>
  );
}

export function AddMemberForm({ action, candidates }: { action: Action; candidates: { value: string; label: string }[] }) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 p-5" noValidate>
      <SelectField
        name="personId"
        label="Add member"
        placeholder={candidates.length ? "Select medic / doctor / team member" : "No eligible personnel available"}
        options={candidates}
        error={state.fieldErrors?.personId ?? (state.status === "error" && !state.fieldErrors ? state.message : undefined)}
        className="min-w-[240px] flex-1"
      />
      <SubmitButton pendingLabel="Adding…">Add to team</SubmitButton>
    </form>
  );
}
