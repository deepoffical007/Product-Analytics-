import { getDb } from '../store';
import type { AuditLog, Database, Notification, User } from '../types';
import { uid } from '@/lib/utils';

export type Result<T = void> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T,>(data: T): Result<T> => ({ ok: true, data });
export const fail = <T = never,>(error: string): Result<T> => ({ ok: false, error });

const isTest = typeof import.meta !== 'undefined' && (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test';

/** Simulated network latency so the UI exercises real loading states. */
export async function latency(ms = 220) {
  if (isTest) return;
  await new Promise((r) => setTimeout(r, ms * (0.6 + Math.random() * 0.8)));
}

export function requireActor(actor: User | null | undefined): asserts actor is User {
  if (!actor || !actor.active) throw new Error('You must be signed in to perform this action.');
}

/** Wraps a service body: adds latency, converts thrown errors into failed Results. */
export async function run<T>(fn: () => Result<T>): Promise<Result<T>> {
  await latency();
  try {
    return fn();
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'Something went wrong.');
  }
}

export function auditEntry(actor: User, action: string, entity: string, entityId: string, summary: string, changes?: AuditLog['changes']): AuditLog {
  return { id: uid('A-'), at: new Date().toISOString(), actorId: actor.id, actorName: actor.name, actorRole: actor.role, action, entity, entityId, summary, changes };
}

export function withAudit(db: Database, ...entries: AuditLog[]): AuditLog[] {
  return [...entries, ...db.auditLogs].slice(0, 2000);
}

export function makeNotifications(userIds: Iterable<string>, n: Pick<Notification, 'title' | 'message' | 'kind' | 'link'>, exclude?: string): Notification[] {
  const seen = new Set<string>();
  const out: Notification[] = [];
  for (const userId of userIds) {
    if (seen.has(userId) || userId === exclude) continue;
    seen.add(userId);
    out.push({ id: uid('N-'), userId, read: false, createdAt: new Date().toISOString(), ...n });
  }
  return out;
}

export function withNotifications(db: Database, list: Notification[]): Notification[] {
  return [...list, ...db.notifications].slice(0, 1500);
}

export const usersWithRole = (db: Database, ...roles: User['role'][]) => db.users.filter((u) => u.active && roles.includes(u.role)).map((u) => u.id);
export const userForEmployee = (db: Database, employeeId: string | null | undefined) => (employeeId ? db.users.find((u) => u.employeeId === employeeId && u.active) : undefined);

export function diff<T extends object>(before: T, after: T, keys: (keyof T)[]): AuditLog['changes'] {
  const changes: NonNullable<AuditLog['changes']> = {};
  for (const k of keys) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changes[String(k)] = { from: before[k], to: after[k] };
  return changes;
}

export const currentDb = getDb;
