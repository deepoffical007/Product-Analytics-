import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useDb } from '@/data/store';
import type { Database, Employee, User } from '@/data/types';

/**
 * DEMO authentication. Sessions are a user id in localStorage and the shared
 * demo password is public. This is NOT production security — see README for
 * wiring Supabase Auth (JWT + row-level security) instead.
 */
const SESSION_KEY = 'cems.session';
export const DEMO_PASSWORD = 'demo1234';

interface AuthValue {
  user: User | null;
  employee: Employee | null;
  db: Database;
  login: (userId: string) => void;
  loginWithPassword: (email: string, password: string) => string | null;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

/** Set on explicit sign-out so the route guard doesn't remember the old page as a return target. */
export const authFlags = { signedOut: false };

function readSession() {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const db = useDb();
  const [userId, setUserId] = useState<string | null>(readSession);
  const user = useMemo(() => db.users.find((u) => u.id === userId && u.active) ?? null, [db.users, userId]);
  const employee = useMemo(() => (user?.employeeId ? (db.employees.find((e) => e.id === user.employeeId) ?? null) : null), [db.employees, user]);

  const login = useCallback((id: string) => {
    authFlags.signedOut = false;
    try {
      localStorage.setItem(SESSION_KEY, id);
    } catch {
      /* ignore */
    }
    setUserId(id);
  }, []);

  const loginWithPassword = useCallback(
    (email: string, password: string) => {
      const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
      if (!u || password !== DEMO_PASSWORD) return 'Invalid email or password.';
      if (!u.active) return 'This account has been disabled. Contact your administrator.';
      login(u.id);
      return null;
    },
    [db.users, login],
  );

  const logout = useCallback(() => {
    authFlags.signedOut = true;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
    setUserId(null);
  }, []);

  return <Ctx.Provider value={{ user, employee, db, login, loginWithPassword, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
