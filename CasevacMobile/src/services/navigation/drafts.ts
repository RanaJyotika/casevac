/**
 * Unsaved form input, kept per patient tab, so a medic can switch to another
 * casualty mid-form and come back to exactly what they had typed — also
 * after the app restarts or the battery dies.
 *
 * Held in memory (instant when switching tabs) and mirrored to the tablet's
 * private storage (written shortly after each change). Cleared when the form
 * is saved or its tab is closed. Nothing here is a clinical record: saved
 * records live in the evacuation stores.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'casevac.drafts.v1';
const WRITE_DELAY_MS = 400;

let memory: Record<string, unknown> = {};
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function persistSoon(): void {
  if (timer) {
    clearTimeout(timer);
  }
  timer = setTimeout(() => {
    timer = null;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory)).catch(() => {});
  }, WRITE_DELAY_MS);
}

/** Loads saved drafts once (call before restoring tabs). */
export async function loadDrafts(): Promise<void> {
  if (loaded) {
    return;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    memory = {
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      ...memory,
    };
  } catch {
    // Start empty: drafts are a convenience, never the only copy of a record.
  }
  loaded = true;
}

export function getDraft<T>(key: string): T | undefined {
  return memory[key] as T | undefined;
}

export function setDraft(key: string, value: unknown): void {
  memory[key] = value;
  persistSoon();
}

export function clearDraft(key: string): void {
  if (key in memory) {
    delete memory[key];
    persistSoon();
  }
}

/** Drops every draft of a tab (when the tab is closed). */
export function clearDraftsWithPrefix(prefix: string): void {
  let changed = false;
  for (const key of Object.keys(memory)) {
    if (key.startsWith(prefix)) {
      delete memory[key];
      changed = true;
    }
  }
  if (changed) {
    persistSoon();
  }
}

/** Tests only. */
export function resetDraftsForTesting(): void {
  memory = {};
  loaded = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/**
 * useState that survives tab switches and restarts when given a key.
 * Without a key it behaves exactly like useState.
 * Returns [value, setValue, clear].
 */
export function useDraftState<T>(
  key: string | undefined,
  initial: T | (() => T),
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(() => {
    const saved = key ? getDraft<T>(key) : undefined;
    if (saved !== undefined) {
      return saved;
    }
    return typeof initial === 'function' ? (initial as () => T)() : initial;
  });
  const keyRef = useRef(key);
  keyRef.current = key;

  // Mirror every change (after the first render) into the draft store.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (keyRef.current) {
      setDraft(keyRef.current, value);
    }
  }, [value]);

  const clear = useCallback(() => {
    if (keyRef.current) {
      clearDraft(keyRef.current);
    }
  }, []);
  return [value, setValue, clear];
}
