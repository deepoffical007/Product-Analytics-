import { can } from '@/lib/permissions';
import { monthEnd, monthStart, today } from '@/lib/dates';
import { commit, getDb } from '../store';
import { computePayroll, validatePayroll } from '../payroll-calc';
import { firstError, payrollSchema, type PayrollInput } from '../schemas';
import type { Database, PayrollRecord, PayrollStatus, User } from '../types';
import { auditEntry, fail, makeNotifications, ok, requireActor, run, userForEmployee, withAudit, withNotifications, type Result } from './core';

/** Server-side style row filter: employees only ever receive their own payroll rows. */
export function visiblePayroll(actor: User | null, db: Database = getDb()): PayrollRecord[] {
  if (!actor) return [];
  const all = Object.values(db.payroll);
  if (can(actor, 'payroll.view_all')) return all;
  // Employees see finalised payslips only.
  return all.filter((p) => p.employeeId === actor.employeeId && (p.status === 'Paid' || p.status === 'Processed'));
}

export function generatePayroll(actor: User | null, period: string): Promise<Result<number>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'payroll.manage')) return fail('You do not have permission to run payroll.');
    if (!/^\d{4}-\d{2}$/.test(period)) return fail('Select a valid pay period.');
    if (period > today().slice(0, 7)) return fail('Payroll cannot be generated for a future period.');
    const db = getDb();
    const ps = monthStart(period);
    const pe = monthEnd(period);
    const created: Record<string, PayrollRecord> = {};
    for (const e of db.employees) {
      if (e.status === 'Inactive') continue;
      if (e.joiningDate > pe || (e.exitDate && e.exitDate < ps)) continue;
      const id = `${e.id}:${period}`;
      if (db.payroll[id]) continue; // one record per employee per period
      const cat = db.designations.find((d) => d.id === e.designationId)?.category ?? 'administrative';
      created[id] = { id, employeeId: e.id, period, ...computePayroll(e.basicSalary, cat), status: 'Pending', paidOn: null, updatedAt: new Date().toISOString() };
    }
    const n = Object.keys(created).length;
    if (!n) return fail(`Payroll for ${period} already exists for all eligible employees.`);
    commit((d) => ({ payroll: { ...d.payroll, ...created }, auditLogs: withAudit(d, auditEntry(actor, 'payroll.generate', 'payroll', period, `Generated ${n} payroll record(s) for ${period}`)) }));
    return ok(n);
  });
}

export function updatePayroll(actor: User | null, id: string, input: PayrollInput): Promise<Result<PayrollRecord>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'payroll.manage')) return fail('You do not have permission to edit payroll.');
    const parsed = payrollSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const before = db.payroll[id];
    if (!before) return fail('Payroll record not found.');
    if (before.status === 'Paid') return fail('Paid payroll records are locked and cannot be edited.');
    const v = parsed.data;
    const net = v.basic + v.hra + v.da + v.otherAllowances - v.pf - v.tax - v.otherDeductions;
    const next = { ...v, net };
    const err = validatePayroll(next);
    if (err) return fail(err);
    const after: PayrollRecord = { ...before, ...next, updatedAt: new Date().toISOString() };
    commit((d) => ({ payroll: { ...d.payroll, [id]: after }, auditLogs: withAudit(d, auditEntry(actor, 'payroll.update', 'payroll', id, `Adjusted payroll ${before.period} for ${before.employeeId}`)) }));
    return ok(after);
  });
}

const TRANSITIONS: Record<PayrollStatus, PayrollStatus[]> = {
  Pending: ['Processed', 'On Hold', 'Paid'],
  Processed: ['Paid', 'On Hold', 'Pending'],
  'On Hold': ['Pending', 'Processed'],
  Paid: [],
};

export function setPayrollStatus(actor: User | null, ids: string[], status: PayrollStatus): Promise<Result<number>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'payroll.manage')) return fail('You do not have permission to update payroll.');
    const db = getDb();
    const targets = ids.map((id) => db.payroll[id]).filter((p): p is PayrollRecord => !!p && TRANSITIONS[p.status].includes(status));
    if (!targets.length) return fail(`None of the selected records can be moved to “${status}”. Paid records are final.`);
    const now = new Date().toISOString();
    commit((d) => {
      const payroll = { ...d.payroll };
      for (const p of targets) payroll[p.id] = { ...p, status, paidOn: status === 'Paid' ? today() : null, updatedAt: now };
      const notes =
        status === 'Paid' || status === 'Processed'
          ? targets.flatMap((p) => {
              const u = userForEmployee(d, p.employeeId);
              return u ? makeNotifications([u.id], { title: 'Payslip available', message: `Your payslip for ${p.period} is ${status === 'Paid' ? 'paid' : 'processed'} and ready to view.`, kind: 'payroll', link: '/payroll' }, actor.id) : [];
            })
          : [];
      return { payroll, notifications: withNotifications(d, notes), auditLogs: withAudit(d, auditEntry(actor, 'payroll.status', 'payroll', targets[0]!.period, `Marked ${targets.length} payroll record(s) as ${status}`)) };
    });
    return ok(targets.length);
  });
}
