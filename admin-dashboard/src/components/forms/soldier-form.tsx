"use client";

import Link from "next/link";
import { useActionState } from "react";
import { SelectField, TextField, toOptions } from "@/components/ui/fields";
import { Alert } from "@/components/ui/layout";
import { buttonClasses } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { PhotoField } from "./photo-field";
import { IDLE_STATE, type ActionState } from "@/lib/action-state";
import { BLOOD_GROUP_OPTIONS, RH_OPTIONS, SEX_OPTIONS, STATUS_OPTIONS } from "@/lib/domain/validation";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const fieldset = "grid grid-cols-1 gap-4 rounded-md border border-line bg-surface p-5 sm:grid-cols-2";
const legend = "px-1.5 text-sm font-semibold text-ink";

/**
 * Soldier registration / edit form.
 * `mode="edit"` locks the service number (identity-defining) and shows status.
 */
export function SoldierForm({
  action,
  mode,
  initial = {},
  serviceNumber,
  cancelHref,
}: {
  action: Action;
  mode: "create" | "edit";
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
        <legend className={legend}>Service identity</legend>
        <TextField name="fullName" label="Full name" required maxLength={100} defaultValue={v.fullName} error={e.fullName} placeholder="As on service record" />
        {mode === "create" ? (
          <TextField
            name="serviceNumber"
            label="Service number"
            required
            maxLength={30}
            defaultValue={v.serviceNumber}
            error={e.serviceNumber}
            hint="Must be unique. Stored in upper case."
          />
        ) : (
          <TextField name="serviceNumberLocked" label="Service number" readOnly defaultValue={serviceNumber} hint="Identity-defining; cannot be edited in the MVP." />
        )}
        <TextField name="rank" label="Rank" required maxLength={40} defaultValue={v.rank} error={e.rank} placeholder="e.g. Sepoy" />
        <TextField name="unit" label="Unit / formation" required maxLength={80} defaultValue={v.unit} error={e.unit} placeholder="e.g. 2 Demo Rifles" />
        <PhotoField defaultValue={v.photo} error={e.photo} />
      </fieldset>

      <fieldset className={`${fieldset} lg:grid-cols-4`}>
        <legend className={legend}>Personal &amp; medical identification</legend>
        <TextField name="dateOfBirth" label="Date of birth" type="date" defaultValue={v.dateOfBirth} error={e.dateOfBirth} />
        <SelectField name="sex" label="Sex" options={toOptions(SEX_OPTIONS)} defaultValue={v.sex || "NOT_RECORDED"} error={e.sex} />
        <SelectField name="bloodGroup" label="Blood group" options={toOptions(BLOOD_GROUP_OPTIONS)} defaultValue={v.bloodGroup || "UNKNOWN"} error={e.bloodGroup} />
        <SelectField name="rhFactor" label="Rh factor" options={toOptions(RH_OPTIONS)} defaultValue={v.rhFactor || "UNKNOWN"} error={e.rhFactor} />
        <TextField name="medicalCategory" label="Medical category" maxLength={40} defaultValue={v.medicalCategory} error={e.medicalCategory} placeholder="As per unit records" className="lg:col-span-2" />
        <TextField name="identificationMarks" label="Identification marks" maxLength={200} defaultValue={v.identificationMarks} error={e.identificationMarks} placeholder="e.g. Scar, left forearm" className="lg:col-span-2" />
      </fieldset>

      <fieldset className={`${fieldset} lg:grid-cols-4`}>
        <legend className={legend}>Next of kin &amp; contact</legend>
        <TextField name="nextOfKinName" label="Next of kin name" maxLength={100} defaultValue={v.nextOfKinName} error={e.nextOfKinName} />
        <TextField name="nextOfKinRelationship" label="Relationship" maxLength={40} defaultValue={v.nextOfKinRelationship} error={e.nextOfKinRelationship} />
        <TextField name="nextOfKinPhone" label="Next of kin phone" type="tel" maxLength={20} defaultValue={v.nextOfKinPhone} error={e.nextOfKinPhone} />
        <TextField name="contactPhone" label="Soldier contact phone" type="tel" maxLength={20} defaultValue={v.contactPhone} error={e.contactPhone} />
      </fieldset>

      {mode === "edit" ? (
        <fieldset className={fieldset}>
          <legend className={legend}>Record status</legend>
          <SelectField
            name="status"
            label="Status"
            options={toOptions(STATUS_OPTIONS)}
            defaultValue={v.status || "ACTIVE"}
            error={e.status}
            hint="Deactivating does not revoke the QR automatically — revoke it separately if required."
          />
        </fieldset>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Link href={cancelHref} className={buttonClasses("secondary", "md")}>
          Cancel
        </Link>
        <SubmitButton pendingLabel={mode === "create" ? "Registering…" : "Saving…"}>
          {mode === "create" ? "Register & issue QR" : "Save changes"}
        </SubmitButton>
      </div>
    </form>
  );
}
