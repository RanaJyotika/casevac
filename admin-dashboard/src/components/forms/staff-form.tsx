"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { SelectField, TextField, toOptions } from "@/components/ui/fields";
import { Alert } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { IDLE_STATE, type ActionState } from "@/lib/action-state";
import { STATUS_OPTIONS } from "@/lib/domain/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface RoleOption {
  value: string;
  label: string;
  description: string;
}

const fieldset = "grid grid-cols-1 gap-4 rounded-md border border-line bg-surface p-5 sm:grid-cols-2";
const legend = "px-1.5 text-sm font-semibold text-ink";

/** Medic / doctor / other authorised personnel — create or edit. */
export function StaffForm({
  action,
  mode,
  roles,
  teams = [],
  initial = {},
  serviceNumber,
  cancelHref,
}: {
  action: Action;
  mode: "create" | "edit";
  roles: RoleOption[];
  teams?: { value: string; label: string }[];
  initial?: Record<string, string>;
  serviceNumber?: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  const v = state.values ?? initial;
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {state.status === "error" ? (
        <Alert tone="danger" title="Not saved">
          {state.message}
        </Alert>
      ) : null}

      <fieldset className={fieldset}>
        <legend className={legend}>Role</legend>
        <SelectField
          name="role"
          label="Role"
          required
          placeholder="Select a role"
          options={roles}
          defaultValue={v.role}
          error={e.role}
          className="sm:col-span-2"
          hint={
            <span className="flex flex-col gap-0.5">
              {roles.map(r => (
                <span key={r.value}>
                  <strong className="font-semibold text-ink-2">{r.label}:</strong> {r.description}
                </span>
              ))}
            </span>
          }
        />
      </fieldset>

      <fieldset className={fieldset}>
        <legend className={legend}>Personnel details</legend>
        <TextField name="fullName" label="Full name" required maxLength={100} defaultValue={v.fullName} error={e.fullName} />
        {mode === "create" ? (
          <TextField name="serviceNumber" label="Personnel / service number" required maxLength={30} defaultValue={v.serviceNumber} error={e.serviceNumber} hint="Must be unique across all personnel." />
        ) : (
          <TextField name="serviceNumberLocked" label="Personnel / service number" readOnly defaultValue={serviceNumber} hint="Identity-defining; cannot be edited in the MVP." />
        )}
        <TextField name="rank" label="Rank" required maxLength={40} defaultValue={v.rank} error={e.rank} />
        <TextField name="designation" label="Designation" maxLength={60} defaultValue={v.designation} error={e.designation} hint="Required for doctors / medical officers (e.g. Regimental Medical Officer)." />
        <TextField name="unit" label="Unit / facility" required maxLength={80} defaultValue={v.unit} error={e.unit} />
        <TextField name="professionalRegistration" label="Professional registration" maxLength={60} defaultValue={v.professionalRegistration} error={e.professionalRegistration} hint="Where applicable. Not verified in the demo." />
        <TextField name="contactPhone" label="Contact phone" type="tel" maxLength={20} defaultValue={v.contactPhone} error={e.contactPhone} />
        <SelectField name="status" label="Account status" options={toOptions(STATUS_OPTIONS)} defaultValue={v.status || "ACTIVE"} error={e.status} hint="Sign-in credentials are not issued in the MVP." />
      </fieldset>

      {mode === "create" ? (
        <fieldset className={fieldset}>
          <legend className={legend}>Team assignment</legend>
          <SelectField
            name="teamId"
            label="Medical team"
            placeholder="No team for now"
            options={teams}
            defaultValue={v.teamId}
            error={e.teamId}
            hint={teams.length === 0 ? "No active teams yet — create one under Medical Teams." : "Optional. Admin roles cannot join teams."}
          />
        </fieldset>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses("secondary", "md")}>
          Cancel
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Registering…" : "Saving…"}>
          {mode === "create" ? "Register personnel" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
