"use client";

import { useActionState, useEffect, useId, useRef, type ReactNode } from "react";
import { IDLE_STATE, type ActionState } from "@/lib/action-state";
import { buttonClasses, type ButtonVariant } from "./button";
import { Alert } from "./layout";
import { SubmitButton } from "./submit-button";
import { TextAreaField, TextField } from "./fields";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/** One-click action (no confirmation), e.g. "Mark wristband issued". */
export function InlineActionButton({
  action,
  label,
  pendingLabel,
  variant = "secondary",
}: {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  variant?: ButtonVariant;
}) {
  const [state, formAction] = useActionState(action, IDLE_STATE);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <SubmitButton variant={variant} size="sm" pendingLabel={pendingLabel ?? "Working…"}>
        {label}
      </SubmitButton>
      {state.status === "error" ? <p className="text-xs font-medium text-danger">{state.message}</p> : null}
    </form>
  );
}

/**
 * Button that opens a modal confirmation (native <dialog>) before running a
 * server action. Optionally collects a required reason or typed confirmation.
 */
export function ConfirmActionButton({
  action,
  triggerLabel,
  triggerVariant = "secondary",
  title,
  description,
  confirmLabel,
  confirmVariant = "primary",
  reasonField,
  confirmTextField,
  fullWidth = false,
}: {
  action: FormAction;
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmVariant?: ButtonVariant;
  reasonField?: { label: string; placeholder?: string };
  confirmTextField?: { label: string; hint?: string };
  fullWidth?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction] = useActionState(action, IDLE_STATE);

  useEffect(() => {
    if (state.status === "error" && dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        className={buttonClasses(triggerVariant, "sm", fullWidth ? "w-full" : "")}
        onClick={() => dialogRef.current?.showModal()}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto w-[min(92vw,460px)] rounded-lg border border-line bg-surface p-0 text-ink shadow-xl"
      >
        <form action={formAction} className="flex flex-col gap-4 p-6">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <div className="text-sm leading-6 text-ink-2">{description}</div>
          {state.status === "error" && !state.fieldErrors ? <Alert tone="danger">{state.message}</Alert> : null}
          {reasonField ? (
            <TextAreaField
              name="reason"
              label={reasonField.label}
              required
              rows={2}
              maxLength={200}
              placeholder={reasonField.placeholder}
              defaultValue={state.values?.reason}
              error={state.fieldErrors?.reason}
            />
          ) : null}
          {confirmTextField ? (
            <TextField
              name="confirmation"
              label={confirmTextField.label}
              required
              hint={confirmTextField.hint}
              error={state.fieldErrors?.confirmation}
              autoComplete="off"
            />
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={buttonClasses("secondary", "md")} onClick={() => dialogRef.current?.close()}>
              Cancel
            </button>
            <SubmitButton variant={confirmVariant} pendingLabel="Working…">
              {confirmLabel}
            </SubmitButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
