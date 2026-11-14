"use client";

import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

/**
 * Large modal whose open state lives in the URL (e.g. `?profile=<id>`).
 * The server renders it only while the param is present; closing (Esc, the
 * close button or a backdrop click) navigates to `closeHref`, which drops the
 * param. Uses a native <dialog> so nested confirmation dialogs stack on top.
 */
export function RouteModal({
  closeHref,
  title,
  description,
  actions,
  children,
}: {
  closeHref: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const titleId = useId();

  useEffect(() => {
    closingRef.current = false;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      // Unmounting (e.g. following "Edit details") must not trigger a close navigation.
      closingRef.current = true;
      html.style.overflow = previousOverflow;
    };
  }, []);

  function handleClose(e: SyntheticEvent<HTMLDialogElement>) {
    // React propagates `close` from nested dialogs (e.g. a "Reissue QR"
    // confirmation) to ancestors; only react to this dialog closing.
    if (e.target !== e.currentTarget || closingRef.current) return;
    closingRef.current = true;
    router.replace(closeHref, { scroll: false });
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={handleClose}
      onClick={e => {
        // A click on the <dialog> element itself (not its content) is a backdrop click.
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto max-h-[92vh] w-[min(96vw,1180px)] overflow-hidden rounded-lg border border-line bg-canvas p-0 text-ink shadow-xl"
    >
      <div className="flex max-h-[92vh] flex-col">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-surface px-5 py-4 sm:px-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id={titleId} className="text-xl font-bold tracking-tight">
              {title}
            </h2>
            {description ? <div className="text-sm text-ink-2">{description}</div> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-canvas hover:text-ink"
            >
              <X className="size-5" aria-hidden />
              <span className="sr-only">Close</span>
            </button>
          </div>
        </header>
        <div className="flex flex-col gap-6 overflow-y-auto p-5 sm:p-6">{children}</div>
      </div>
    </dialog>
  );
}
