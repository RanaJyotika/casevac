"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonSize, type ButtonVariant } from "./button";

interface SubmitButtonProps {
  children: ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Submit button that disables itself while its form's action is running. */
export function SubmitButton({ children, pendingLabel = "Saving…", variant = "primary", size = "md", className = "" }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClasses(variant, size, className)}>
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
