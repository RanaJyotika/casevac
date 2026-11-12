/**
 * Shared service helpers: result types, transactions with rollback, audit.
 */
import { getRepository, type RepositoryWriter } from "../data";
import { newInternalId } from "../domain/ids";
import type { Actor, AuditAction, AuditEvent } from "../domain/types";
import type { FieldErrors } from "../domain/validation";

export type ServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

export const ok = <T>(value: T): ServiceResult<T> => ({ ok: true, value });

export const fail = (message: string, fieldErrors?: FieldErrors): { ok: false; message: string; fieldErrors?: FieldErrors } => ({
  ok: false,
  message,
  fieldErrors,
});

export const invalid = (fieldErrors: FieldErrors) =>
  fail("Please correct the highlighted fields.", fieldErrors);

export const nowIso = () => new Date().toISOString();

/* ------------------------------ Audit ------------------------------ */

/**
 * Hook for forwarding audit events to a future central audit service.
 * Events are always stored in the repository first; sinks receive them only
 * after the transaction commits.
 */
export interface AuditSink {
  publish(event: AuditEvent): void | Promise<void>;
}

let auditSink: AuditSink | null = null;

export function setAuditSink(sink: AuditSink | null): void {
  auditSink = sink;
}

export type AuditFn = (
  action: AuditAction,
  entityType: AuditEvent["entityType"],
  entityId: string | null,
  summary: string,
) => Promise<void>;

/* --------------------------- Transactions -------------------------- */

class Rollback {
  constructor(readonly result: { ok: false; message: string; fieldErrors?: FieldErrors }) {}
}

/**
 * Runs `work` in a repository transaction. Returning a failed result rolls
 * back every write made inside `work`.
 */
export async function runTransaction<T>(
  actor: Actor,
  work: (tx: RepositoryWriter, audit: AuditFn) => Promise<ServiceResult<T>>,
): Promise<ServiceResult<T>> {
  const events: AuditEvent[] = [];
  try {
    const result = await getRepository().transaction(async tx => {
      const audit: AuditFn = async (action, entityType, entityId, summary) => {
        const event: AuditEvent = {
          id: newInternalId(),
          at: nowIso(),
          actorId: actor.id,
          action,
          entityType,
          entityId,
          summary,
        };
        await tx.appendAudit(event);
        events.push(event);
      };
      const outcome = await work(tx, audit);
      if (!outcome.ok) throw new Rollback(outcome);
      return outcome;
    });
    if (auditSink) {
      for (const event of events) {
        try {
          await auditSink.publish(event);
        } catch {
          // Sink failures must never undo a committed administrative action.
        }
      }
    }
    return result;
  } catch (error) {
    if (error instanceof Rollback) return error.result;
    throw error;
  }
}
