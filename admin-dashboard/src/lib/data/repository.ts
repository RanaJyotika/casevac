/**
 * Repository contract for CASEVAC administrative data.
 *
 * Services depend only on this interface. The MVP ships a development/demo
 * implementation backed by a local JSON file (json-file-repository.ts).
 * A PostgreSQL/API implementation should implement the same interface, with
 * `transaction` mapped to a database transaction.
 */
import type {
  AdminPasskey,
  AuditEvent,
  IdentityCredential,
  MedicalTeam,
  MobileLoginAccount,
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

  listMobileAccounts(): Promise<MobileLoginAccount[]>;
  /** Looks up by normalised (upper-case) sign-in user ID. */
  findMobileAccountByUserId(userId: string): Promise<MobileLoginAccount | null>;

  listAdminPasskeys(adminId: string): Promise<AdminPasskey[]>;

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
  /** Fails if the user ID is already used by a non-revoked account. */
  insertMobileAccount(account: MobileLoginAccount): Promise<void>;
  updateMobileAccount(account: MobileLoginAccount): Promise<void>;
  insertAdminPasskey(passkey: AdminPasskey): Promise<void>;
  updateAdminPasskey(passkey: AdminPasskey): Promise<void>;
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
