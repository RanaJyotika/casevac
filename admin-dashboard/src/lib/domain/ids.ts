import { randomBytes, randomUUID } from "node:crypto";
import type { SequenceKey } from "./types";

/** Random internal identifier (UUID v4, CSPRNG). */
export function newInternalId(): string {
  return randomUUID();
}

/** 128-bit random opaque token, base64url (22 chars). */
export function newOpaqueToken(): string {
  return randomBytes(16).toString("base64url");
}

export const DISPLAY_PREFIX: Record<SequenceKey, string> = {
  SOLDIER: "PAT",
  MEDIC: "MED",
  DOCTOR: "DOC",
  STAFF: "STF",
  TEAM: "TEAM",
};

/** Human-readable admin reference, e.g. PAT-00001 or TEAM-001. */
export function formatDisplayId(key: SequenceKey, sequence: number): string {
  const width = key === "TEAM" ? 3 : 5;
  return `${DISPLAY_PREFIX[key]}-${String(sequence).padStart(width, "0")}`;
}
