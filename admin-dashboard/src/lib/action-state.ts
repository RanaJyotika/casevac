/** Shape returned by every form server action (safe to import in client code). */
export interface ActionState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Submitted values, echoed back so forms keep input after an error. */
  values?: Record<string, string>;
}

export const IDLE_STATE: ActionState = { status: "idle" };
