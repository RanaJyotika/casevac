/**
 * A patient's previous records on this tablet (evacuations, handovers,
 * treatment notes), shown on Patient Identification (screen 3).
 *
 * Written by the evacuation workflow (M06+, next phase) — until then the store
 * is empty and screen 3 says "No previous record found". Nothing is ever
 * invented here: an entry exists only if a medic recorded it.
 *
 * A patient can be known by several keys (dashboard patient UUID, display ID
 * such as PAT-00012, or a field registration's TEMP- ID); entries match on
 * any of them.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'casevac.patientHistory.v1';

export interface HistoryEntry {
  id: string;
  /** Keys this entry belongs to: patient UUID, display ID and/or TEMP- ID. */
  patientKeys: string[];
  /** ISO-8601 time of the event. */
  at: string;
  /** Short heading, e.g. "Evacuation started", "Handed over at CCP". */
  title: string;
  /** Optional one-line detail, e.g. triage and location. */
  detail?: string;
  /** User ID of the medic who recorded it. */
  recordedBy: string;
}

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const norm = (key: string) => key.trim().toUpperCase();

export class PatientHistoryStore {
  constructor(private readonly storage: KeyValueStorage = AsyncStorage) {}

  private async all(): Promise<HistoryEntry[]> {
    try {
      const raw = await this.storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Entries for any of the patient's keys, newest first. */
  async listFor(
    keys: Array<string | null | undefined>,
  ): Promise<HistoryEntry[]> {
    const wanted = new Set(keys.filter((k): k is string => !!k).map(norm));
    if (wanted.size === 0) {
      return [];
    }
    return (await this.all())
      .filter(e => e.patientKeys.some(k => wanted.has(norm(k))))
      .sort((a, b) => b.at.localeCompare(a.at));
  }

  /** Used by the evacuation workflow to record an event. */
  async add(entry: HistoryEntry): Promise<void> {
    const all = await this.all();
    await this.storage.setItem(STORAGE_KEY, JSON.stringify([...all, entry]));
  }
}

let defaultStore: PatientHistoryStore | null = null;
export function getPatientHistoryStore(): PatientHistoryStore {
  defaultStore ??= new PatientHistoryStore();
  return defaultStore;
}
