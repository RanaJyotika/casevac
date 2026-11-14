"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Check, Copy, Eye, EyeOff, Fingerprint } from "lucide-react";
import {
  beginPasskeyRegistrationAction,
  beginPasswordRevealAction,
  finishPasskeyRegistrationAction,
  finishPasswordRevealAction,
  revealWithAdminPasswordAction,
  type RevealResult,
} from "@/app/actions/password-reveal-actions";
import { buttonClasses } from "@/components/ui/button";

const MASK = "••••••••••";
const AUTO_HIDE_SECONDS = 30;

/* base64url <-> bytes for WebAuthn's ArrayBuffer fields */
function toB64(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /Linux/.test(ua) ? "Linux" : "PC";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "browser";
  return `${os} · ${browser}`;
}

async function platformVerifierAvailable(): Promise<boolean> {
  try {
    return typeof window.PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

const isDomError = (error: unknown, name: string) => error instanceof DOMException && error.name === name;

type Mode = "idle" | "setup" | "retry" | "admin-password";

/**
 * Masked mobile sign-in password with an eye button. Showing it requires
 * Windows Hello (PC PIN, fingerprint or face) — or the dashboard admin
 * password on PCs without Windows Hello — verified on the server.
 */
export function PasswordReveal({ personId, viewable }: { personId: string; viewable: boolean }) {
  const [password, setPassword] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [hideAt, setHideAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const adminPasswordId = useId();
  const secondsLeft = hideAt === null ? 0 : Math.max(0, Math.ceil((hideAt - now) / 1000));

  function hide() {
    setPassword(null);
    setHideAt(null);
    setCopied(false);
  }

  useEffect(() => {
    if (hideAt === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      if (t >= hideAt) hide();
      else setNow(t);
    }, 1000);
    return () => clearInterval(timer);
  }, [hideAt]);

  function showResult(result: RevealResult) {
    if (result.ok) {
      const t = Date.now();
      setPassword(result.password);
      setNow(t);
      setHideAt(t + AUTO_HIDE_SECONDS * 1000);
      setMode("idle");
      setMessage(null);
    } else {
      setMessage(result.message);
    }
  }

  async function verifyWithWindowsHello() {
    const begin = await beginPasswordRevealAction(personId);
    if (begin.status === "error") {
      setMessage(begin.message);
      return;
    }
    if (begin.status === "needs-setup") {
      setMode("setup");
      setMessage("Windows Hello isn’t set up for this dashboard on this PC yet. You only need to do this once.");
      return;
    }
    const { options } = begin;
    let credential: PublicKeyCredential;
    try {
      credential = (await navigator.credentials.get({
        publicKey: {
          challenge: fromB64(options.challenge),
          rpId: options.rpId,
          allowCredentials: options.allowCredentials.map(c => ({ type: c.type, id: fromB64(c.id), transports: ["internal"] })),
          userVerification: "required",
          timeout: options.timeout,
        },
      })) as PublicKeyCredential;
    } catch (error) {
      setMode("retry");
      setMessage(
        isDomError(error, "NotAllowedError")
          ? "Verification was cancelled, or Windows Hello on this PC is not set up for this dashboard yet."
          : "Windows Hello could not verify you on this PC.",
      );
      return;
    }
    const response = credential.response as AuthenticatorAssertionResponse;
    showResult(
      await finishPasswordRevealAction(personId, {
        credentialId: toB64(credential.rawId),
        clientDataJSON: toB64(response.clientDataJSON),
        authenticatorData: toB64(response.authenticatorData),
        signature: toB64(response.signature),
      }),
    );
  }

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch {
      setMessage("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function onEyeClick() {
    if (password !== null) {
      hide();
      return;
    }
    setMessage(null);
    void run(async () => {
      if (!(await platformVerifierAvailable())) {
        setMode("admin-password");
        setMessage("Windows Hello is not available on this PC. Confirm with your dashboard admin password instead.");
        return;
      }
      await verifyWithWindowsHello();
    });
  }

  function onSetUp() {
    setMessage(null);
    void run(async () => {
      const options = await beginPasskeyRegistrationAction();
      let credential: PublicKeyCredential;
      try {
        credential = (await navigator.credentials.create({
          publicKey: {
            challenge: fromB64(options.challenge),
            rp: options.rp,
            user: { id: fromB64(options.user.id), name: options.user.name, displayName: options.user.displayName },
            pubKeyCredParams: options.pubKeyCredParams,
            excludeCredentials: options.excludeCredentials.map(c => ({ type: c.type, id: fromB64(c.id), transports: ["internal"] })),
            authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
            attestation: "none",
            timeout: options.timeout,
          },
        })) as PublicKeyCredential;
      } catch (error) {
        if (isDomError(error, "InvalidStateError")) {
          // excludeCredentials matched: this PC is already set up.
          await verifyWithWindowsHello();
          return;
        }
        setMessage(isDomError(error, "NotAllowedError") ? "Setup was cancelled." : "Windows Hello setup failed on this PC.");
        return;
      }
      const response = credential.response as AuthenticatorAttestationResponse;
      const publicKey = response.getPublicKey?.();
      const algorithm = response.getPublicKeyAlgorithm?.();
      const authenticatorData = response.getAuthenticatorData?.();
      if (!publicKey || algorithm === undefined || !authenticatorData) {
        setMessage("This browser cannot complete Windows Hello setup. Use an up-to-date Chrome or Edge.");
        return;
      }
      const saved = await finishPasskeyRegistrationAction(
        {
          credentialId: toB64(credential.rawId),
          clientDataJSON: toB64(response.clientDataJSON),
          authenticatorData: toB64(authenticatorData),
          publicKey: toB64(publicKey),
          algorithm,
        },
        deviceLabel(),
      );
      if (!saved.ok) {
        setMessage(saved.message);
        return;
      }
      setMessage("This PC is set up. Confirm with Windows Hello once more to show the password.");
      await verifyWithWindowsHello();
    });
  }

  function onAdminPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("adminPassword") ?? "");
    setMessage(null);
    void run(async () => showResult(await revealWithAdminPasswordAction(personId, value)));
  }

  async function onCopy() {
    if (password === null) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMessage("Could not copy automatically. Select the password and copy it manually.");
    }
  }

  if (!viewable) {
    return (
      <div className="flex flex-col gap-1">
        <span className="font-mono tracking-wider text-muted">{MASK}</span>
        <span className="text-xs leading-5 text-muted">Issued before password viewing was enabled. Reset the password to make it viewable.</span>
      </div>
    );
  }

  const showPanel = message !== null || mode !== "idle";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-8 flex-wrap items-center gap-x-2 gap-y-1">
        <span className={`font-mono ${password === null ? "tracking-wider" : "select-all"}`} aria-live="polite">
          {password ?? MASK}
        </span>
        <button
          type="button"
          onClick={onEyeClick}
          disabled={busy}
          aria-label={password === null ? "Show password (asks Windows Hello)" : "Hide password"}
          title={password === null ? "Show password (asks Windows Hello)" : "Hide password"}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-brand hover:bg-brand-soft disabled:opacity-50"
        >
          {password === null ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
        </button>
        {password !== null ? (
          <>
            <button type="button" onClick={onCopy} className={buttonClasses("secondary", "sm", "h-8")}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </button>
            <span className="text-xs text-muted">Hides in {secondsLeft} s</span>
          </>
        ) : null}
        {busy ? <span className="text-xs text-muted">Waiting for verification…</span> : null}
      </div>

      {showPanel ? (
        <div className="flex flex-col gap-3 rounded-md border border-line bg-canvas p-3">
          {message ? <p className="text-xs leading-5 text-ink-2">{message}</p> : null}

          {mode === "setup" || mode === "retry" ? (
            <div className="flex flex-col gap-2">
              {mode === "retry" ? (
                <button type="button" onClick={onEyeClick} disabled={busy} className={buttonClasses("secondary", "sm", "w-full")}>
                  Try again
                </button>
              ) : null}
              <button
                type="button"
                onClick={onSetUp}
                disabled={busy}
                className={buttonClasses(mode === "setup" ? "primary" : "secondary", "sm", "w-full")}
              >
                <Fingerprint className="size-4" aria-hidden /> Set up Windows Hello
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("admin-password");
                  setMessage(null);
                }}
                disabled={busy}
                className={buttonClasses("ghost", "sm", "w-full")}
              >
                Use admin password instead
              </button>
            </div>
          ) : null}

          {mode === "admin-password" ? (
            <form onSubmit={onAdminPasswordSubmit} className="flex flex-col gap-2">
              <label htmlFor={adminPasswordId} className="text-xs font-medium">
                Dashboard admin password
              </label>
              <input
                id={adminPasswordId}
                name="adminPassword"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
                className="h-9 w-full min-w-0 rounded-md border border-line bg-surface px-3 text-sm"
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy} className={buttonClasses("primary", "sm", "flex-1")}>
                  Verify &amp; show
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("idle");
                    setMessage(null);
                  }}
                  className={buttonClasses("secondary", "sm", "flex-1")}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {mode === "idle" && message ? (
            <button type="button" onClick={() => setMessage(null)} className={buttonClasses("ghost", "sm", "self-start")}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
