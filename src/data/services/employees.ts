import { can, canViewEmployee } from '@/lib/permissions';
import { today } from '@/lib/dates';
import { commit, getDb } from '../store';
import { employeeSchema, firstError, selfProfileSchema, type EmployeeInput, type SelfProfileInput } from '../schemas';
import type { Database, Employee, EmploymentStatus, LeaveBalance, LeaveType, User } from '../types';
import { auditEntry, diff, fail, makeNotifications, ok, requireActor, run, userForEmployee, usersWithRole, withAudit, withNotifications, type Result } from './core';

export const fullName = (e: Pick<Employee, 'firstName' | 'lastName'>) => `${e.firstName} ${e.lastName}`;

export function nextEmployeeId(db: Database = getDb()): string {
  const max = db.employees.reduce((m, e) => Math.max(m, Number(e.id.split('-')[1]) || 0), 1000);
  return `NIT-${max + 1}`;
}

/** Employees visible to the actor (directory scoping). */
export function visibleEmployees(actor: User | null, db: Database = getDb()): Employee[] {
  if (!actor) return [];
  if (can(actor, 'employees.view_all')) return db.employees;
  return db.employees.filter((e) => canViewEmployee(actor, e, db));
}

function balancesFor(db: Database, employeeId: string): Record<string, LeaveBalance> {
  const year = Number(today().slice(0, 4));
  const out: Record<string, LeaveBalance> = {};
  for (const type of Object.keys(db.settings.leavePolicy) as LeaveType[]) {
    const id = `${employeeId}:${year}:${type}`;
    if (!db.leaveBalances[id]) out[id] = { id, employeeId, year, type, allocated: db.settings.leavePolicy[type], used: 0 };
  }
  return out;
}

function validateRelations(db: Database, v: EmployeeInput, selfId?: string): string | null {
  const dept = db.departments.find((d) => d.id === v.departmentId);
  if (!dept) return 'Selected department does not exist.';
  if (dept.status !== 'active') return `${dept.name} is inactive. Choose an active department.`;
  const des = db.designations.find((d) => d.id === v.designationId);
  if (!des) return 'Selected designation does not exist.';
  if (des.status !== 'active') return `Designation “${des.title}” is inactive.`;
  if (v.reportingManagerId) {
    if (v.reportingManagerId === selfId) return 'An employee cannot report to themselves.';
    const mgr = db.employees.find((e) => e.id === v.reportingManagerId);
    if (!mgr) return 'Reporting manager not found.';
    if (mgr.status === 'Inactive' || mgr.status === 'Resigned') return 'Reporting manager must be an active employee.';
  }
  const email = v.email.toLowerCase();
  if (db.employees.some((e) => e.email.toLowerCase() === email && e.id !== selfId)) return `The email ${email} is already used by another employee.`;
  return null;
}

export function createEmployee(actor: User | null, input: EmployeeInput): Promise<Result<Employee>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'employees.create')) return fail('You do not have permission to add employees.');
    const parsed = employeeSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const db = getDb();
    if (db.employees.some((e) => e.id === v.id)) return fail(`Employee ID ${v.id} already exists. Use ${nextEmployeeId(db)}.`);
    const relErr = validateRelations(db, v);
    if (relErr) return fail(relErr);
    const now = new Date().toISOString();
    const colors = ['#4f46e5', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e'];
    const emp: Employee = {
      ...(v as Omit<Employee, 'avatarColor' | 'documents' | 'createdAt' | 'updatedAt' | 'exitDate'>),
      employmentType: v.employmentType as Employee['employmentType'],
      status: v.status as EmploymentStatus,
      avatarColor: colors[db.employees.length % colors.length]!,
      exitDate: null,
      documents: [
        { id: 'doc-id', name: 'Aadhaar / Government ID', type: 'Identity', status: 'Pending', uploadedAt: null },
        { id: 'doc-pan', name: 'PAN Card', type: 'Identity', status: 'Missing', uploadedAt: null },
        { id: 'doc-deg', name: 'Highest Degree Certificate', type: 'Academic', status: 'Missing', uploadedAt: null },
        { id: 'doc-offer', name: 'Signed Offer Letter', type: 'Employment', status: 'Pending', uploadedAt: null },
      ],
      createdAt: now,
      updatedAt: now,
    };
    commit((d) => ({
      employees: [...d.employees, emp],
      leaveBalances: { ...d.leaveBalances, ...balancesFor(d, emp.id) },
      auditLogs: withAudit(d, auditEntry(actor, 'employee.create', 'employee', emp.id, `Added employee ${fullName(emp)} (${emp.id})`)),
      notifications: withNotifications(
        d,
        makeNotifications(usersWithRole(d, 'super_admin', 'hr'), { title: 'New employee added', message: `${fullName(emp)} joined ${d.departments.find((x) => x.id === emp.departmentId)?.name}.`, kind: 'employee', link: `/employees/${emp.id}` }, actor.id),
      ),
    }));
    return ok(emp);
  });
}

const TRACKED: (keyof Employee)[] = ['firstName', 'lastName', 'email', 'phone', 'departmentId', 'designationId', 'employmentType', 'joiningDate', 'reportingManagerId', 'status', 'basicSalary', 'qualification', 'specialization', 'address', 'emergencyContact', 'bankAccount', 'gender', 'dateOfBirth'];

export function updateEmployee(actor: User | null, id: string, input: EmployeeInput): Promise<Result<Employee>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'employees.edit')) return fail('You do not have permission to edit employee records.');
    const db = getDb();
    const before = db.employees.find((e) => e.id === id);
    if (!before) return fail('Employee not found.');
    const parsed = employeeSchema.safeParse({ ...input, id });
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const relErr = validateRelations(db, v, id);
    if (relErr) return fail(relErr);
    if ((v.status === 'Inactive' || v.status === 'Resigned') && before.status !== v.status && !can(actor, 'employees.deactivate')) {
      return fail('Only a Super Admin can deactivate or mark an employee as resigned.');
    }

    let reportingManagerId = v.reportingManagerId;
    if (v.departmentId !== before.departmentId) {
      const headed = db.departments.find((d) => d.headId === id && d.status === 'active');
      if (headed) return fail(`${fullName(before)} is head of ${headed.name}. Assign a new department head before moving them.`);
      // Re-point the reporting line when it followed the old department head.
      const oldDept = db.departments.find((d) => d.id === before.departmentId);
      const newDept = db.departments.find((d) => d.id === v.departmentId);
      if (reportingManagerId && reportingManagerId === oldDept?.headId && newDept?.headId && newDept.headId !== id) reportingManagerId = newDept.headId;
    }

    const after: Employee = {
      ...before,
      ...(v as Partial<Employee>),
      reportingManagerId,
      employmentType: v.employmentType as Employee['employmentType'],
      status: v.status as EmploymentStatus,
      exitDate: v.status === 'Resigned' ? (before.exitDate ?? today()) : v.status === 'Inactive' ? before.exitDate : null,
      updatedAt: new Date().toISOString(),
    };
    const changes = diff(before, after, TRACKED);
    if (!changes || Object.keys(changes).length === 0) return ok(before);

    const changedLabels = Object.keys(changes).map((k) => k.replace(/Id$/, '').replace(/([A-Z])/g, ' $1').toLowerCase());
    const empUser = userForEmployee(db, id);
    const deptName = (dId: string) => db.departments.find((d) => d.id === dId)?.name ?? dId;
    const summary = changes.departmentId
      ? `Moved ${fullName(after)} from ${deptName(before.departmentId)} to ${deptName(after.departmentId)}`
      : `Updated ${fullName(after)}: ${changedLabels.join(', ')}`;
    // Salary/bank values are sensitive — keep them out of the audit payload.
    const safeChanges = { ...changes };
    if (safeChanges.basicSalary) safeChanges.basicSalary = { from: '•••', to: '•••' };
    if (safeChanges.bankAccount) safeChanges.bankAccount = { from: '•••', to: '•••' };

    commit((d) => ({
      employees: d.employees.map((e) => (e.id === id ? after : e)),
      auditLogs: withAudit(d, auditEntry(actor, 'employee.update', 'employee', id, summary, safeChanges)),
      notifications: withNotifications(
        d,
        empUser ? makeNotifications([empUser.id], { title: 'Your employee record was updated', message: `Changed: ${changedLabels.join(', ')}.`, kind: 'employee', link: `/employees/${id}` }, actor.id) : [],
      ),
    }));
    return ok(after);
  });
}

export function updateOwnProfile(actor: User | null, input: SelfProfileInput): Promise<Result<Employee>> {
  return run(() => {
    requireActor(actor);
    if (!actor.employeeId) return fail('Your account is not linked to an employee record.');
    const parsed = selfProfileSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const before = db.employees.find((e) => e.id === actor.employeeId);
    if (!before) return fail('Employee record not found.');
    const after: Employee = { ...before, ...parsed.data, updatedAt: new Date().toISOString() };
    const changes = diff(before, after, ['phone', 'address', 'emergencyContact']);
    if (!changes || !Object.keys(changes).length) return ok(before);
    commit((d) => ({
      employees: d.employees.map((e) => (e.id === after.id ? after : e)),
      auditLogs: withAudit(d, auditEntry(actor, 'employee.self_update', 'employee', after.id, `${fullName(after)} updated their contact details`, changes)),
      notifications: withNotifications(d, makeNotifications(usersWithRole(d, 'hr'), { title: 'Employee updated contact details', message: `${fullName(after)} changed ${Object.keys(changes).join(', ')}.`, kind: 'employee', link: `/employees/${after.id}` }, actor.id)),
    }));
    return ok(after);
  });
}

export function setEmployeesStatus(actor: User | null, ids: string[], status: EmploymentStatus): Promise<Result<number>> {
  return run(() => {
    requireActor(actor);
    const deactivating = status === 'Inactive' || status === 'Resigned';
    if (deactivating ? !can(actor, 'employees.deactivate') : !can(actor, 'employees.edit')) return fail('You do not have permission to change employment status.');
    const db = getDb();
    const targets = db.employees.filter((e) => ids.includes(e.id) && e.status !== status);
    if (!targets.length) return fail('No selected employees need this change.');
    if (deactivating) {
      const self = targets.find((e) => e.id === actor.employeeId);
      if (self) return fail('You cannot deactivate your own account.');
      const head = targets.find((e) => db.departments.some((d) => d.headId === e.id && d.status === 'active'));
      if (head) return fail(`${fullName(head)} is a department head. Assign a new head first.`);
    }
    const now = new Date().toISOString();
    const set = new Set(targets.map((t) => t.id));
    commit((d) => ({
      employees: d.employees.map((e) => (set.has(e.id) ? { ...e, status, exitDate: status === 'Resigned' ? today() : status === 'Inactive' ? e.exitDate : null, updatedAt: now } : e)),
      auditLogs: withAudit(d, ...targets.map((e) => auditEntry(actor, 'employee.status', 'employee', e.id, `Set ${fullName(e)} status to ${status}`, { status: { from: e.status, to: status } }))),
    }));
    return ok(targets.length);
  });
}

export function deleteEmployee(actor: User | null, id: string): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'employees.delete')) return fail('Only a Super Admin can permanently delete employee records.');
    const db = getDb();
    const emp = db.employees.find((e) => e.id === id);
    if (!emp) return fail('Employee not found.');
    if (emp.id === actor.employeeId) return fail('You cannot delete your own record.');
    const head = db.departments.find((d) => d.headId === id);
    if (head) return fail(`${fullName(emp)} is head of ${head.name}. Assign a new head first.`);
    const reports = db.employees.filter((e) => e.reportingManagerId === id && e.status !== 'Resigned');
    if (reports.length) return fail(`${reports.length} employee(s) report to ${fullName(emp)}. Reassign them first.`);
    if (db.users.some((u) => u.employeeId === id)) return fail('This employee has a login account. Deactivate the account instead of deleting.');
    commit((d) => {
      const attendance = { ...d.attendance };
      for (const k of Object.keys(attendance)) if (attendance[k]!.employeeId === id) delete attendance[k];
      const payroll = { ...d.payroll };
      for (const k of Object.keys(payroll)) if (payroll[k]!.employeeId === id) delete payroll[k];
      const leaveBalances = { ...d.leaveBalances };
      for (const k of Object.keys(leaveBalances)) if (leaveBalances[k]!.employeeId === id) delete leaveBalances[k];
      return {
        employees: d.employees.filter((e) => e.id !== id),
        attendance,
        payroll,
        leaveBalances,
        leaveRequests: d.leaveRequests.filter((r) => r.employeeId !== id),
        reviews: d.reviews.filter((r) => r.employeeId !== id),
        auditLogs: withAudit(d, auditEntry(actor, 'employee.delete', 'employee', id, `Permanently deleted ${fullName(emp)} (${id}) and related records`)),
      };
    });
    return ok(undefined);
  });
}

export function updateDocumentStatus(actor: User | null, employeeId: string, docId: string, status: Employee['documents'][number]['status']): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'employees.edit')) return fail('You do not have permission to verify documents.');
    const db = getDb();
    const emp = db.employees.find((e) => e.id === employeeId);
    const doc = emp?.documents.find((x) => x.id === docId);
    if (!emp || !doc) return fail('Document not found.');
    commit((d) => ({
      employees: d.employees.map((e) =>
        e.id === employeeId ? { ...e, documents: e.documents.map((x) => (x.id === docId ? { ...x, status, uploadedAt: status === 'Missing' ? null : (x.uploadedAt ?? today()) } : x)), updatedAt: new Date().toISOString() } : e,
      ),
      auditLogs: withAudit(d, auditEntry(actor, 'employee.document', 'employee', employeeId, `Marked “${doc.name}” as ${status} for ${fullName(emp)}`)),
    }));
    return ok(undefined);
  });
}

