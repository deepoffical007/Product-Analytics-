import { can } from '@/lib/permissions';
import { commit, getDb, resetDb } from '../store';
import type { LeaveType, Role, Settings, User } from '../types';
import { auditEntry, fail, ok, requireActor, run, withAudit, type Result } from './core';

export function updateLeavePolicy(actor: User | null, policy: Record<LeaveType, number>): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'settings.manage')) return fail('Only a Super Admin can change the leave policy.');
    for (const [k, v] of Object.entries(policy)) if (!Number.isInteger(v) || v < 0 || v > 60) return fail(`${k}: entitlement must be a whole number between 0 and 60.`);
    const db = getDb();
    const year = new Date().getFullYear();
    // Entitlement below already-approved usage would make balances negative.
    const conflict = Object.values(db.leaveBalances).find((b) => b.year === year && b.used > policy[b.type]);
    if (conflict) {
      const e = db.employees.find((x) => x.id === conflict.employeeId);
      return fail(`${e ? `${e.firstName} ${e.lastName}` : conflict.employeeId} has already used ${conflict.used} ${conflict.type} day(s); entitlement cannot go below that.`);
    }
    commit((d) => {
      const leaveBalances = { ...d.leaveBalances };
      for (const [k, b] of Object.entries(leaveBalances)) if (b.year === year) leaveBalances[k] = { ...b, allocated: policy[b.type] };
      return { settings: { ...d.settings, leavePolicy: { ...policy } }, leaveBalances, auditLogs: withAudit(d, auditEntry(actor, 'settings.leave_policy', 'settings', 'leave_policy', 'Updated annual leave entitlements', Object.fromEntries((Object.keys(policy) as LeaveType[]).filter((k) => d.settings.leavePolicy[k] !== policy[k]).map((k) => [k, { from: d.settings.leavePolicy[k], to: policy[k] }])))) };
    });
    return ok(undefined);
  });
}

export function updateInstitution(actor: User | null, patch: Pick<Settings, 'institutionName' | 'lateAfter' | 'workdayStart'>): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'settings.manage')) return fail('Only a Super Admin can change institution settings.');
    if (patch.institutionName.trim().length < 3) return fail('Institution name is required.');
    if (!/^\d{2}:\d{2}$/.test(patch.lateAfter) || !/^\d{2}:\d{2}$/.test(patch.workdayStart)) return fail('Times must be HH:mm.');
    if (patch.lateAfter < patch.workdayStart) return fail('Late threshold must be after the workday start time.');
    commit((d) => ({ settings: { ...d.settings, ...patch, institutionName: patch.institutionName.trim() }, auditLogs: withAudit(d, auditEntry(actor, 'settings.update', 'settings', 'institution', 'Updated institution settings')) }));
    return ok(undefined);
  });
}

export function updateUserAccess(actor: User | null, userId: string, patch: { role?: Role; active?: boolean }): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'users.manage')) return fail('Only a Super Admin can manage user access.');
    if (userId === actor.id) return fail('You cannot change your own role or access.');
    const db = getDb();
    const user = db.users.find((u) => u.id === userId);
    if (!user) return fail('User not found.');
    const next = { ...user, ...patch };
    const admins = db.users.filter((u) => (u.id === userId ? next : u)).filter((u) => u.role === 'super_admin' && u.active);
    if (!admins.length) return fail('At least one active Super Admin is required.');
    commit((d) => ({
      users: d.users.map((u) => (u.id === userId ? next : u)),
      auditLogs: withAudit(d, auditEntry(actor, 'user.access', 'user', userId, `Changed access for ${user.name}${patch.role ? ` → role ${patch.role}` : ''}${patch.active !== undefined ? ` → ${patch.active ? 'active' : 'disabled'}` : ''}`)),
    }));
    return ok(undefined);
  });
}

export function resetDemoData() {
  return resetDb();
}
