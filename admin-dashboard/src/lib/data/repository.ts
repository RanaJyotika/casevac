/**
 * Repository contract for CASEVAC administrative data.
 *
 * Services depend only on this interface. The MVP ships a development/demo
 * implementation backed by a local JSON file (json-file-repository.ts).
 * A PostgreSQL/API implementation should implement the same interface, with
 * `transaction` mapped to a database transaction.
 */
import type {
  AuditEvent,
  IdentityCredential,
  MedicalTeam,
  PersonRecord,
  SequenceKey,
} from "../domain/types";

export type DataSourceKind = "demo-file" | "backend";

export interface RepositoryReader {
  listPersons(): Promise<PersonRecord[]>;
  getPerson(id: string): Promise<PersonRecord | null>;
  findPersonByServiceNumber(serviceNumber: string): Promise<PersonRecord | null>;

  listCredentials(): Promise<IdentityCredential[]>;
  getCredential(id: string): Promise<IdentityCredential | null>;
  findCredentialByToken(token: string): Promise<IdentityCredential | null>;

  listTeams(): Promise<MedicalTeam[]>;
  getTeam(id: string): Promise<MedicalTeam | null>;

  listAuditEvents(limit: number): Promise<AuditEvent[]>;
}

export interface RepositoryWriter extends RepositoryReader {
  /** Returns the next value in a per-key sequence (1, 2, 3 …). */
  nextSequence(key: SequenceKey): Promise<number>;
  insertPerson(person: PersonRecord): Promise<void>;
  updatePerson(person: PersonRecord): Promise<void>;
  insertCredential(credential: IdentityCredential): Promise<void>;
  updateCredential(credential: IdentityCredential): Promise<void>;
  insertTeam(team: MedicalTeam): Promise<void>;
  updateTeam(team: MedicalTeam): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
}

export interface CasevacRepository extends RepositoryReader {
  readonly kind: DataSourceKind;
  /** Plain-language description for the Settings page. Never includes secrets. */
  readonly description: string;
  /** Runs `work` atomically: all writes commit together or none do. */
  transaction<T>(work: (tx: RepositoryWriter) => Promise<T>): Promise<T>;
  /** Demo only: erase all records. */
  resetAll(): Promise<void>;
}
