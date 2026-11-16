"use client";

import { useActionState, useId, useRef, useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { IDLE_STATE, type ActionState } from "@/lib/action-state";
import { buttonClasses, type ButtonVariant } from "@/components/ui/button";
import { Alert } from "@/components/ui/layout";
import { SubmitButton } from "@/components/ui/submit-button";
import { LOGIN_STATIONS, LOGIN_STATION_LABEL, isLoginStation, type LoginStation } from "@/lib/domain/types";

type FormAction = (prev: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Generate / reset a medic's mobile sign-in. The confirmation dialog turns
 * into a one-time credentials slip after success: the password is never
 * stored in plaintext, so it cannot be shown again.
 */
export function IssueMobileLoginButton({
  action,
  triggerLabel,
  triggerVariant = "primary",
  isReset,
  personLabel,
  currentStation = null,
}: {
  action: FormAction;
  triggerLabel: string;
  triggerVariant?: ButtonVariant;
  isReset: boolean;
  personLabel: string;
  /** Station of the live account (pre-selected on reset). */
  currentStation?: LoginStation | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction] = useActionState(action, IDLE_STATE);
  // The slip shows the latest successful result until it is dismissed.
  const [dismissed, setDismissed] = useState<ActionState | null>(null);
  const [copied, setCopied] = useState(false);
  const credentials = state.status === "success" && state !== dismissed ? state.values : undefined;

  const dismiss = () => {
    setDismissed(state);
    setCopied(false);
  };

  const close = () => {
    dialogRef.current?.close();
    dismiss();
  };

  const copy = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(
        `User ID: ${credentials.userId}\nPassword: ${credentials.password}\nLogin station: ${credentials.station ?? "RAP or ADS"}`,
      );
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={buttonClasses(triggerVariant, "sm")}
        onClick={() => {
          dismiss();
          dialogRef.current?.showModal();
        }}
      >
        <KeyRound className="size-4" aria-hidden /> {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onClose={dismiss}
        className="m-auto w-[min(92vw,480px)] rounded-lg border border-line bg-surface p-0 text-ink shadow-xl"
      >
        {credentials ? (
          <div className="flex flex-col gap-4 p-6">
            <h2 id={titleId} className="text-lg font-semibold">
              Mobile sign-in for {personLabel}
            </h2>
            <Alert tone="warn" title="Shown once">
              Copy or write these down now and hand them to the medic. The password cannot be displayed again — use
              Reset password if it is lost.
            </Alert>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-md border border-line bg-canvas p-4">
              <dt className="text-sm text-muted">User ID</dt>
              <dd className="font-mono text-lg font-semibold">{credentials.userId}</dd>
              <dt className="text-sm text-muted">Password</dt>
              <dd className="font-mono text-lg font-semibold tracking-wider">{credentials.password}</dd>
              <dt className="text-sm text-muted">Login station</dt>
              <dd className="text-lg font-semibold">
                {isLoginStation(credentials.station) ? LOGIN_STATION_LABEL[credentials.station] : "RAP or ADS"}
              </dd>
            </dl>
            <p className="text-sm text-ink-2">
              On the tablet, select this <strong>login station</strong> before signing in. The first sign-in must be
              made <strong>online at base camp</strong>. After that the tablet keeps a secure copy and the medic can
              sign in without a network.
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonClasses("secondary", "md")} onClick={copy}>
                {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" className={buttonClasses("primary", "md")} onClick={close}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-4 p-6">
            <h2 id={titleId} className="text-lg font-semibold">
              {isReset ? `Reset mobile password for ${personLabel}?` : `Generate mobile sign-in for ${personLabel}?`}
            </h2>
            <div className="text-sm leading-6 text-ink-2">
              {isReset
                ? "A new password is generated and the old one stops working. Tablets holding the old offline copy delete it the next time they connect to the server."
                : "A user ID and password are generated for the medic app. The medic must sign in once while online; the tablet then stores a copy for offline sign-in."}
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-sm font-medium">Login station</legend>
              <div className="grid grid-cols-2 gap-2">
                {LOGIN_STATIONS.map(s => (
                  <label
                    key={s}
                    className="flex cursor-pointer items-start gap-2 rounded-md border border-line bg-canvas p-3 has-[:checked]:border-brand has-[:checked]:bg-brand-soft"
                  >
                    <input
                      type="radio"
                      name="station"
                      value={s}
                      defaultChecked={s === (state.values?.station ?? currentStation ?? "RAP")}
                      className="mt-1"
                      required
                    />
                    <span className="flex flex-col">
                      <span className="font-semibold">{s}</span>
                      <span className="text-xs text-muted">{LOGIN_STATION_LABEL[s].split(" — ")[1]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted">The medic selects this station on the tablet&apos;s login screen.</p>
            </fieldset>
            {state.status === "error" ? <Alert tone="danger">{state.message}</Alert> : null}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" className={buttonClasses("secondary", "md")} onClick={close}>
                Cancel
              </button>
              <SubmitButton pendingLabel="Generating…">{isReset ? "Reset password" : "Generate"}</SubmitButton>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
