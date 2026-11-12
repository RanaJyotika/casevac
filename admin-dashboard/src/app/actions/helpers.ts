import type { ActionState } from "@/lib/action-state";
import type { ServiceResult } from "@/lib/services/common";

/** Reads named string fields from FormData (missing → ""). */
export function readForm<K extends string>(formData: FormData, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>;
  for (const key of keys) {
    const value = formData.get(key);
    out[key] = typeof value === "string" ? value : "";
  }
  return out;
}

export function errorState(result: Extract<ServiceResult<unknown>, { ok: false }>, values?: Record<string, string>): ActionState {
  return { status: "error", message: result.message, fieldErrors: result.fieldErrors, values };
}
