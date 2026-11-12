/**
 * DEVELOPMENT / DEMO PERSISTENCE — NOT FOR REAL PERSONNEL DATA.
 *
 * Stores all records in one local JSON file on the server (never in the
 * browser). Writes are serialised through an in-process lock and committed
 * atomically (write temp file → rename). There is no encryption, no
 * multi-process locking and no backup. Use fictional records only.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  AuditEvent,
  DatabaseSnapshot,
  IdentityCredential,
  MedicalTeam,
  PersonRecord,
  SequenceKey,
} from "../domain/types";
import type { CasevacRepository, RepositoryWriter } from "./repository";

export function emptySnapshot(): DatabaseSnapshot {
  return {
    schemaVersion: 1,
    counters: { SOLDIER: 0, MEDIC: 0, DOCTOR: 0, STAFF: 0, TEAM: 0 },
    persons: [],
    credentials: [],
    teams: [],
    auditLog: [],
  };
}

const clone = <T>(value: T): T => structuredClone(value);

/** In-memory view over a snapshot. Used for reads and inside transactions. */
class SnapshotStore implements RepositoryWriter {
  constructor(private readonly db: DatabaseSnapshot) {}

  async listPersons() {
    return clone(this.db.persons);
  }
  async getPerson(id: string) {
    const found = this.db.persons.find(p => p.id === id);
    return found ? clone(found) : null;
  }
  async findPersonByServiceNumber(serviceNumber: string) {
    const key = serviceNumber.trim().toUpperCase();
    const found = this.db.persons.find(p => p.serviceNumber === key);
    return found ? clone(found) : null;
  }
  async listCredentials() {
    return clone(this.db.credentials);
  }
  async getCredential(id: string) {
    const found = this.db.credentials.find(c => c.id === id);
    return found ? clone(found) : null;
  }
  async findCredentialByToken(token: string) {
    const found = this.db.credentials.find(c => c.token === token);
    return found ? clone(found) : null;
  }
  async listTeams() {
    return clone(this.db.teams);
  }
  async getTeam(id: string) {
    const found = this.db.teams.find(t => t.id === id);
    return found ? clone(found) : null;
  }
  async listAuditEvents(limit: number) {
    return clone(this.db.auditLog.slice(-limit).reverse());
  }

  async nextSequence(key: SequenceKey) {
    this.db.counters[key] += 1;
    return this.db.counters[key];
  }
  async insertPerson(person: PersonRecord) {
    if (this.db.persons.some(p => p.id === person.id || p.serviceNumber === person.serviceNumber)) {
      throw new Error("Constraint violation: duplicate person id or service number");
    }
    this.db.persons.push(clone(person));
  }
  async updatePerson(person: PersonRecord) {
    replaceById(this.db.persons, person, "person");
  }
  async insertCredential(credential: IdentityCredential) {
    if (this.db.credentials.some(c => c.id === credential.id || c.token === credential.token)) {
      throw new Error("Constraint violation: duplicate credential id or token");
    }
    if (
      credential.status === "ACTIVE" &&
      this.db.credentials.some(c => c.personId === credential.personId && c.status === "ACTIVE")
    ) {
      throw new Error("Constraint violation: person already has an active credential");
    }
    this.db.credentials.push(clone(credential));
  }
  async updateCredential(credential: IdentityCredential) {
    replaceById(this.db.credentials, credential, "credential");
  }
  async insertTeam(team: MedicalTeam) {
    if (this.db.teams.some(t => t.id === team.id)) {
      throw new Error("Constraint violation: duplicate team id");
    }
    this.db.teams.push(clone(team));
  }
  async updateTeam(team: MedicalTeam) {
    replaceById(this.db.teams, team, "team");
  }
  async appendAudit(event: AuditEvent) {
    this.db.auditLog.push(clone(event));
    // Keep the demo file bounded.
    if (this.db.auditLog.length > 2000) {
      this.db.auditLog.splice(0, this.db.auditLog.length - 2000);
    }
  }
}

function replaceById<T extends { id: string }>(list: T[], item: T, label: string) {
  const index = list.findIndex(x => x.id === item.id);
  if (index === -1) throw new Error(`Cannot update missing ${label}`);
  list[index] = clone(item);
}

/** One promise chain per file path serialises writes within this process. */
const locks = new Map<string, Promise<unknown>>();

async function withLock<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(work);
  locks.set(key, run.catch(() => undefined));
  return run;
}

async function sleep(ms: number) {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

export class JsonFileRepository implements CasevacRepository {
  readonly kind = "demo-file" as const;
  readonly description: string;

  constructor(private readonly filePath: string) {
    this.description = `Local demo JSON file (${path.basename(filePath)}) on the dashboard server`;
  }

  private async load(): Promise<DatabaseSnapshot> {
    try {
      const raw = await fs.readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as DatabaseSnapshot;
      if (parsed.schemaVersion !== 1) {
        throw new Error(`Unsupported demo data schema version: ${String(parsed.schemaVersion)}`);
      }
      return { ...emptySnapshot(), ...parsed, counters: { ...emptySnapshot().counters, ...parsed.counters } };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptySnapshot();
      throw error;
    }
  }

  private async save(snapshot: DatabaseSnapshot): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const temp = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(temp, JSON.stringify(snapshot, null, 2), "utf8");
    // Windows can briefly lock the target (antivirus/indexer); retry rename.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(temp, this.filePath);
        return;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (attempt < 5 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) {
          await sleep(40 * (attempt + 1));
          continue;
        }
        await fs.rm(temp, { force: true });
        throw error;
      }
    }
  }

  private async view() {
    return new SnapshotStore(await this.load());
  }

  async listPersons() { return (await this.view()).listPersons(); }
  async getPerson(id: string) { return (await this.view()).getPerson(id); }
  async findPersonByServiceNumber(sn: string) { return (await this.view()).findPersonByServiceNumber(sn); }
  async listCredentials() { return (await this.view()).listCredentials(); }
  async getCredential(id: string) { return (await this.view()).getCredential(id); }
  async findCredentialByToken(token: string) { return (await this.view()).findCredentialByToken(token); }
  async listTeams() { return (await this.view()).listTeams(); }
  async getTeam(id: string) { return (await this.view()).getTeam(id); }
  async listAuditEvents(limit: number) { return (await this.view()).listAuditEvents(limit); }

  async transaction<T>(work: (tx: RepositoryWriter) => Promise<T>): Promise<T> {
    return withLock(this.filePath, async () => {
      const snapshot = await this.load();
      const result = await work(new SnapshotStore(snapshot));
      await this.save(snapshot);
      return result;
    });
  }

  async resetAll(): Promise<void> {
    await withLock(this.filePath, () => this.save(emptySnapshot()));
  }
}
