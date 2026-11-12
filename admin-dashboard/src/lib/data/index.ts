import path from "node:path";
import { JsonFileRepository } from "./json-file-repository";
import type { CasevacRepository } from "./repository";

export type { CasevacRepository, RepositoryWriter } from "./repository";

let repository: CasevacRepository | null = null;

/**
 * Returns the configured repository.
 * CASEVAC_DATA_SOURCE=demo-file (default) → local JSON demo store.
 * CASEVAC_DATA_SOURCE=backend → not implemented yet; fails loudly rather
 * than silently falling back to demo data.
 */
export function getRepository(): CasevacRepository {
  if (repository) return repository;
  const source = process.env.CASEVAC_DATA_SOURCE ?? "demo-file";
  if (source === "demo-file") {
    const file =
      process.env.CASEVAC_DEMO_DATA_FILE ??
      path.join(process.cwd(), ".data", "casevac-demo-db.json");
    repository = new JsonFileRepository(file);
    return repository;
  }
  if (source === "backend") {
    throw new Error(
      "CASEVAC_DATA_SOURCE=backend is not available yet: the shared PostgreSQL/API backend has not been implemented.",
    );
  }
  throw new Error(`Unknown CASEVAC_DATA_SOURCE "${source}".`);
}

/** Test helper: inject a repository (e.g. a temp-file store). */
export function setRepositoryForTesting(repo: CasevacRepository | null): void {
  repository = repo;
}
