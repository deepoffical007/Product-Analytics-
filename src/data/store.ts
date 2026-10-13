import { useSyncExternalStore } from 'react';
import { createSeedDatabase, DB_VERSION } from './seed';
import type { AttendanceRecord, Database } from './types';

/**
 * DEMO persistence layer.
 * The whole database lives in browser localStorage. All reads go through
 * `getDb()` / `useDb()` and every write goes through `commit()`, which keeps
 * the swap to a real backend (Supabase/PostgreSQL) contained to the services.
 */
export const STORAGE_KEY = 'cems.db';

type Listener = () => void;

const memory = new Map<string, string>();
const storage = {
  get(key: string): string | null {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : (memory.get(key) ?? null);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  set(key: string, value: string) {
    if (typeof localStorage === 'undefined') {
      memory.set(key, value);
      return;
    }
    localStorage.setItem(key, value); // may throw QuotaExceededError — surfaced by commit()
  },
  remove(key: string) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    memory.delete(key);
  },
};

let db: Database | null = null;

// Attendance is by far the largest collection, so it is stored as compact
// pipe-delimited rows to stay well inside the browser storage quota.
const STATUS_CODES = { present: 'p', absent: 'a', late: 'l', on_leave: 'o' } as const;
const SOURCE_CODES = { register: 'r', leave: 'v', seed: 's' } as const;
const invert = <T extends Record<string, string>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
const STATUS_FROM = invert(STATUS_CODES) as Record<string, AttendanceRecord['status']>;
const SOURCE_FROM = invert(SOURCE_CODES) as Record<string, AttendanceRecord['source']>;

type StoredDatabase = Omit<Database, 'attendance'> & { attendance: string[] };

function encode(d: Database): StoredDatabase {
  return {
    ...d,
    attendance: Object.values(d.attendance).map((r) => [r.employeeId, r.date, STATUS_CODES[r.status], r.checkIn ?? '', SOURCE_CODES[r.source], r.markedBy ?? '', r.source === 'seed' ? '' : r.updatedAt].join('|')),
  };
}

function decode(s: StoredDatabase): Database {
  const attendance: Database['attendance'] = {};
  for (const row of s.attendance) {
    const [employeeId, date, st, checkIn, src, markedBy, updatedAt] = row.split('|') as string[];
    const id = `${employeeId}:${date}`;
    attendance[id] = { id, employeeId: employeeId!, date: date!, status: STATUS_FROM[st!]!, checkIn: checkIn || null, source: SOURCE_FROM[src!]!, markedBy: markedBy || null, updatedAt: updatedAt || `${date}T10:30:00.000Z` };
  }
  return { ...s, attendance };
}
const listeners = new Set<Listener>();
let persistError: string | null = null;

function load(): Database {
  const raw = storage.get(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredDatabase;
      if (parsed.version === DB_VERSION && Array.isArray(parsed.attendance)) return decode(parsed);
    } catch {
      /* fall through to reseed */
    }
  }
  const fresh = createSeedDatabase();
  persist(fresh);
  return fresh;
}

function persist(next: Database) {
  try {
    storage.set(STORAGE_KEY, JSON.stringify(encode(next)));
    persistError = null;
  } catch (e) {
    persistError = e instanceof Error ? e.message : 'Unable to save changes to browser storage.';
  }
}

export function getDb(): Database {
  if (!db) db = load();
  return db;
}

export function getPersistError() {
  return persistError;
}

/** Apply an immutable update. Return only the collections that changed. */
export function commit(updater: (current: Database) => Partial<Database>): Database {
  const current = getDb();
  const patch = updater(current);
  db = { ...current, ...patch };
  persist(db);
  listeners.forEach((l) => l());
  return db;
}

export function resetDb(): Database {
  storage.remove(STORAGE_KEY);
  db = createSeedDatabase();
  persist(db);
  listeners.forEach((l) => l());
  return db;
}

/** Approximate persisted size in bytes (shown in Settings). */
export function storageSize() {
  return (storage.get(STORAGE_KEY) ?? '').length;
}

/** Replace in-memory state (used by tests). */
export function __setDb(next: Database) {
  db = next;
  listeners.forEach((l) => l());
}

export function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

// Keep multiple tabs in sync.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    if (!e.newValue) return;
    try {
      const parsed = JSON.parse(e.newValue) as StoredDatabase;
      if (parsed.version === DB_VERSION && Array.isArray(parsed.attendance)) {
        db = decode(parsed);
        listeners.forEach((l) => l());
      }
    } catch {
      /* ignore */
    }
  });
}

export function useDb(): Database {
  return useSyncExternalStore(subscribe, getDb, getDb);
}
