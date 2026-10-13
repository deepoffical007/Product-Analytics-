import { can } from '@/lib/permissions';
import { commit, getDb } from '../store';
import { departmentSchema, designationSchema, firstError, type DepartmentInput, type DesignationInput } from '../schemas';
import type { Department, Designation, User } from '../types';
import { auditEntry, fail, ok, requireActor, run, withAudit, type Result } from './core';

const activeStaff = (deptOrDesKey: 'departmentId' | 'designationId', id: string) =>
  getDb().employees.filter((e) => e[deptOrDesKey] === id && (e.status === 'Active' || e.status === 'Probation'));

function validateDept(v: DepartmentInput, selfId?: string): string | null {
  const db = getDb();
  if (db.departments.some((d) => d.code === v.code && d.id !== selfId)) return `Department code ${v.code} is already in use.`;
  if (db.departments.some((d) => d.name.toLowerCase() === v.name.toLowerCase() && d.id !== selfId)) return `A department named “${v.name}” already exists.`;
  if (v.headId) {
    const head = db.employees.find((e) => e.id === v.headId);
    if (!head) return 'Selected department head was not found.';
    if (head.status === 'Inactive' || head.status === 'Resigned') return 'Department head must be an active employee.';
    if (selfId && head.departmentId !== selfId) return 'Department head must belong to this department.';
    const other = db.departments.find((d) => d.headId === v.headId && d.id !== selfId && d.status === 'active');
    if (other) return `${head.firstName} ${head.lastName} already heads ${other.name}.`;
  }
  return null;
}

export function createDepartment(actor: User | null, input: DepartmentInput): Promise<Result<Department>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage departments.');
    const parsed = departmentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    // A new department has no members yet, so a head can only be assigned after staff are moved in.
    const err = validateDept({ ...v, headId: null });
    if (err) return fail(err);
    const dept: Department = { id: `dept-${v.code.toLowerCase()}`, code: v.code, name: v.name, headId: null, status: 'active', description: v.description, createdAt: new Date().toISOString() };
    if (getDb().departments.some((d) => d.id === dept.id)) return fail(`Department code ${v.code} is already in use.`);
    commit((d) => ({ departments: [...d.departments, dept], auditLogs: withAudit(d, auditEntry(actor, 'department.create', 'department', dept.id, `Created department ${dept.name}`)) }));
    return ok(dept);
  });
}

export function updateDepartment(actor: User | null, id: string, input: DepartmentInput): Promise<Result<Department>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage departments.');
    const parsed = departmentSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const before = db.departments.find((d) => d.id === id);
    if (!before) return fail('Department not found.');
    const err = validateDept(parsed.data, id);
    if (err) return fail(err);
    const after: Department = { ...before, ...parsed.data };
    commit((d) => ({
      departments: d.departments.map((x) => (x.id === id ? after : x)),
      // Members who reported to the previous head now report to the new head.
      employees:
        before.headId !== after.headId && after.headId
          ? d.employees.map((e) => (e.departmentId === id && e.id !== after.headId && (e.reportingManagerId === before.headId || !e.reportingManagerId) ? { ...e, reportingManagerId: after.headId } : e))
          : d.employees,
      auditLogs: withAudit(d, auditEntry(actor, 'department.update', 'department', id, `Updated department ${after.name}${before.headId !== after.headId ? ' (new head assigned)' : ''}`)),
    }));
    return ok(after);
  });
}

export function setDepartmentStatus(actor: User | null, id: string, status: Department['status']): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage departments.');
    const dept = getDb().departments.find((d) => d.id === id);
    if (!dept) return fail('Department not found.');
    if (status === 'inactive') {
      const staff = activeStaff('departmentId', id);
      if (staff.length) return fail(`${dept.name} still has ${staff.length} active employee(s). Move them to another department before deactivating.`);
      if (getDb().jobs.some((j) => j.departmentId === id && j.status === 'Open')) return fail(`${dept.name} has open job postings. Close them first.`);
    }
    commit((d) => ({
      departments: d.departments.map((x) => (x.id === id ? { ...x, status, headId: status === 'inactive' ? null : x.headId } : x)),
      auditLogs: withAudit(d, auditEntry(actor, `department.${status === 'inactive' ? 'deactivate' : 'activate'}`, 'department', id, `${status === 'inactive' ? 'Deactivated' : 'Reactivated'} department ${dept.name}`)),
    }));
    return ok(undefined);
  });
}

export function createDesignation(actor: User | null, input: DesignationInput): Promise<Result<Designation>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage designations.');
    const parsed = designationSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const db = getDb();
    if (db.designations.some((d) => d.title.toLowerCase() === v.title.toLowerCase())) return fail(`Designation “${v.title}” already exists.`);
    const des: Designation = { id: `des-${v.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, ...v, status: 'active' };
    commit((d) => ({ designations: [...d.designations, des], auditLogs: withAudit(d, auditEntry(actor, 'designation.create', 'designation', des.id, `Created designation ${des.title}`)) }));
    return ok(des);
  });
}

export function updateDesignation(actor: User | null, id: string, input: DesignationInput): Promise<Result<Designation>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage designations.');
    const parsed = designationSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const before = db.designations.find((d) => d.id === id);
    if (!before) return fail('Designation not found.');
    if (db.designations.some((d) => d.title.toLowerCase() === parsed.data.title.toLowerCase() && d.id !== id)) return fail(`Designation “${parsed.data.title}” already exists.`);
    if (parsed.data.category !== before.category && activeStaff('designationId', id).length) return fail('Cannot change the staff category while employees hold this designation.');
    const after = { ...before, ...parsed.data };
    commit((d) => ({ designations: d.designations.map((x) => (x.id === id ? after : x)), auditLogs: withAudit(d, auditEntry(actor, 'designation.update', 'designation', id, `Updated designation ${after.title}`)) }));
    return ok(after);
  });
}

export function setDesignationStatus(actor: User | null, id: string, status: Designation['status']): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'departments.manage')) return fail('Only a Super Admin can manage designations.');
    const des = getDb().designations.find((d) => d.id === id);
    if (!des) return fail('Designation not found.');
    if (status === 'inactive') {
      const n = activeStaff('designationId', id).length;
      if (n) return fail(`${n} active employee(s) hold the designation “${des.title}”. Reassign them before deactivating.`);
    }
    commit((d) => ({ designations: d.designations.map((x) => (x.id === id ? { ...x, status } : x)), auditLogs: withAudit(d, auditEntry(actor, `designation.${status}`, 'designation', id, `${status === 'inactive' ? 'Deactivated' : 'Reactivated'} designation ${des.title}`)) }));
    return ok(undefined);
  });
}
