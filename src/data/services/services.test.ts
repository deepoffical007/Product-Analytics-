import { beforeEach, describe, expect, it } from 'vitest';
import { __setDb, getDb } from '../store';
import { createSeedDatabase, DEMO_USERS } from '../seed';
import { addDays, isWorkingDay, today } from '@/lib/dates';
import { can } from '@/lib/permissions';
import { computePayroll, validatePayroll } from '../payroll-calc';
import type { EmployeeInput } from '../schemas';
import {
  applyLeave,
  cancelLeave,
  createAttendance,
  createEmployee,
  deleteEmployee,
  generatePayroll,
  getBalance,
  markAttendance,
  nextEmployeeId,
  reviewLeave,
  setDepartmentStatus,
  setDesignationStatus,
  setPayrollStatus,
  updateEmployee,
  updateLeave,
  updatePayroll,
  visibleEmployees,
  visibleLeaveRequests,
  visiblePayroll,
} from './index';

const user = (id: string) => getDb().users.find((u) => u.id === id)!;
const admin = () => user(DEMO_USERS.admin);
const hr = () => user(DEMO_USERS.hr);
const head = () => user(DEMO_USERS.head);
const faculty = () => user(DEMO_USERS.faculty);

/** Next working day at least `offset` days ahead. */
function workday(offset: number) {
  let d = addDays(today(), offset);
  while (!isWorkingDay(d, getDb().settings.holidays)) d = addDays(d, 1);
  return d;
}

function lastWorkday() {
  let d = today();
  while (!isWorkingDay(d, getDb().settings.holidays)) d = addDays(d, -1);
  return d;
}

function employeeInput(over: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    id: nextEmployeeId(),
    firstName: 'Test',
    lastName: 'Person',
    email: 'test.person@northfield.edu.in',
    phone: '+91 98765 43210',
    gender: 'Female',
    dateOfBirth: '1990-04-12',
    address: '1 Test Road',
    emergencyContact: 'Someone',
    departmentId: 'dept-cse',
    designationId: 'des-asst',
    employmentType: 'Full-time',
    joiningDate: today(),
    reportingManagerId: getDb().departments.find((d) => d.id === 'dept-cse')!.headId,
    status: 'Probation',
    qualification: 'Ph.D.',
    specialization: 'NLP',
    basicSalary: 75000,
    bankAccount: '123456789012',
    ...over,
  };
}

beforeEach(() => {
  __setDb(createSeedDatabase());
});

describe('seed data integrity', () => {
  it('has unique ids, emails and attendance keys', () => {
    const db = getDb();
    expect(new Set(db.employees.map((e) => e.id)).size).toBe(db.employees.length);
    expect(new Set(db.employees.map((e) => e.email)).size).toBe(db.employees.length);
    for (const [k, r] of Object.entries(db.attendance)) expect(k).toBe(`${r.employeeId}:${r.date}`);
    expect(db.employees.length).toBeGreaterThan(80);
  });

  it('keeps leave balances consistent with approved requests and policy', () => {
    const db = getDb();
    for (const b of Object.values(db.leaveBalances)) {
      const g = getBalance(db, b.employeeId, b.type, b.year);
      expect(g.used).toBe(b.used);
      expect(b.used).toBeLessThanOrEqual(b.allocated);
    }
  });

  it('every department head belongs to that department', () => {
    const db = getDb();
    for (const d of db.departments) if (d.headId) expect(db.employees.find((e) => e.id === d.headId)!.departmentId).toBe(d.id);
  });
});

describe('journey: admin creates an employee', () => {
  it('creates, validates and rejects duplicates', async () => {
    const r = await createEmployee(admin(), employeeInput());
    expect(r.ok).toBe(true);
    const dupId = await createEmployee(admin(), employeeInput({ id: 'NIT-1001', email: 'x@y.in' }));
    expect(dupId.ok).toBe(false);
    const dupEmail = await createEmployee(admin(), employeeInput());
    expect(dupEmail.ok).toBe(false);
    if (!dupEmail.ok) expect(dupEmail.error).toMatch(/already used/);
    const bad = await createEmployee(admin(), employeeInput({ email: 'not-an-email', id: nextEmployeeId() }));
    expect(bad.ok).toBe(false);
    expect(getDb().auditLogs[0]!.action).toBe('employee.create');
  });

  it('faculty cannot create employees', async () => {
    const r = await createEmployee(faculty(), employeeInput());
    expect(r.ok).toBe(false);
  });
});

describe('journey: HR updates an employee department', () => {
  it('moves the employee and re-points the reporting line to the new head', async () => {
    const db = getDb();
    const emp = db.employees.find((e) => e.id === faculty().employeeId)!;
    const ece = db.departments.find((d) => d.id === 'dept-ece')!;
    const r = await updateEmployee(hr(), emp.id, { ...(emp as unknown as EmployeeInput), departmentId: ece.id });
    expect(r.ok).toBe(true);
    const after = getDb().employees.find((e) => e.id === emp.id)!;
    expect(after.departmentId).toBe('dept-ece');
    expect(after.reportingManagerId).toBe(ece.headId);
    // employee is notified
    expect(getDb().notifications.some((n) => n.userId === DEMO_USERS.faculty && n.title.includes('record was updated'))).toBe(true);
  });

  it('blocks moving a department head and HR deactivation', async () => {
    const db = getDb();
    const headEmp = db.employees.find((e) => e.id === head().employeeId)!;
    const r = await updateEmployee(hr(), headEmp.id, { ...(headEmp as unknown as EmployeeInput), departmentId: 'dept-ece' });
    expect(r.ok).toBe(false);
    const fac = db.employees.find((e) => e.id === faculty().employeeId)!;
    const r2 = await updateEmployee(hr(), fac.id, { ...(fac as unknown as EmployeeInput), status: 'Inactive' });
    expect(r2.ok).toBe(false);
  });
});

describe('journey: leave request and approval', () => {
  it('submits, approves once, and never deducts twice', async () => {
    const start = workday(20);
    const before = getBalance(getDb(), faculty().employeeId!, 'casual', Number(start.slice(0, 4)));
    const r = await applyLeave(faculty(), { type: 'casual', startDate: start, endDate: start, reason: 'Family function' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // pending reserves days but does not count as used
    const pend = getBalance(getDb(), faculty().employeeId!, 'casual', Number(start.slice(0, 4)));
    expect(pend.used).toBe(before.used);
    expect(pend.pending).toBe(before.pending + 1);

    // editing the pending request does not double count
    const e = await updateLeave(faculty(), r.data.id, { type: 'casual', startDate: start, endDate: start, reason: 'Family function (updated)' });
    expect(e.ok).toBe(true);
    expect(getBalance(getDb(), faculty().employeeId!, 'casual', Number(start.slice(0, 4))).pending).toBe(before.pending + 1);

    // the employee cannot approve their own request; the department head can
    expect((await reviewLeave(faculty(), r.data.id, 'approved', '')).ok).toBe(false);
    const a = await reviewLeave(head(), r.data.id, 'approved', 'OK');
    expect(a.ok).toBe(true);
    const again = await reviewLeave(hr(), r.data.id, 'approved', 'OK');
    expect(again.ok).toBe(false);
    const after = getBalance(getDb(), faculty().employeeId!, 'casual', Number(start.slice(0, 4)));
    expect(after.used).toBe(before.used + 1);
    expect(getDb().leaveBalances[after.id]!.used).toBe(after.used);
    // attendance is marked on leave for that day
    expect(getDb().attendance[`${faculty().employeeId}:${start}`]!.status).toBe('on_leave');
    // the employee is notified
    expect(getDb().notifications.some((n) => n.userId === DEMO_USERS.faculty && n.title === 'Leave approved')).toBe(true);
  });

  it('rejects with a mandatory comment, blocks overlaps and over-balance', async () => {
    const start = workday(30);
    const r = await applyLeave(faculty(), { type: 'casual', startDate: start, endDate: start, reason: 'Personal work' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const overlap = await applyLeave(faculty(), { type: 'sick', startDate: start, endDate: start, reason: 'Overlapping request' });
    expect(overlap.ok).toBe(false);
    expect((await reviewLeave(hr(), r.data.id, 'rejected', '')).ok).toBe(false);
    expect((await reviewLeave(hr(), r.data.id, 'rejected', 'Exam duty')).ok).toBe(true);
    const huge = await applyLeave(faculty(), { type: 'other', startDate: workday(60), endDate: addDays(workday(60), 30), reason: 'Too many days' });
    expect(huge.ok).toBe(false);
  });

  it('allows cancelling only own pending requests', async () => {
    const start = workday(40);
    const r = await applyLeave(faculty(), { type: 'casual', startDate: start, endDate: start, reason: 'Personal work' });
    if (!r.ok) throw new Error(r.error);
    expect((await cancelLeave(hr(), r.data.id)).ok).toBe(false);
    expect((await cancelLeave(faculty(), r.data.id)).ok).toBe(true);
    expect((await cancelLeave(faculty(), r.data.id)).ok).toBe(false);
  });

  it('scopes leave visibility', () => {
    const own = visibleLeaveRequests(faculty());
    expect(own.every((r) => r.employeeId === faculty().employeeId)).toBe(true);
    const team = visibleLeaveRequests(head());
    expect(team.length).toBeGreaterThan(own.length);
    expect(visibleLeaveRequests(hr()).length).toBe(getDb().leaveRequests.length);
  });
});

describe('attendance', () => {
  it('prevents duplicate entries and future dates', async () => {
    const db = getDb();
    const d = lastWorkday();
    const emp = db.employees.find((e) => (e.status === 'Active' || e.status === 'Probation') && !db.leaveRequests.some((r) => r.employeeId === e.id && r.status === 'approved' && r.startDate <= d && r.endDate >= d))!;
    const key = `${emp.id}:${d}`;
    const exists = !!db.attendance[key];
    const c = await createAttendance(hr(), { employeeId: emp.id, date: d, status: 'present' });
    if (exists) expect(c.ok).toBe(false);
    else {
      expect(c.ok).toBe(true);
      expect((await createAttendance(hr(), { employeeId: emp.id, date: d, status: 'late' })).ok).toBe(false);
    }
    const count = Object.keys(getDb().attendance).length;
    const m = await markAttendance(hr(), [
      { employeeId: emp.id, date: d, status: 'absent' },
      { employeeId: emp.id, date: d, status: 'absent' },
    ]);
    expect(m.ok).toBe(true);
    expect(Object.keys(getDb().attendance).length).toBe(count);
    expect(getDb().attendance[key]!.status).toBe('absent');
    expect((await markAttendance(hr(), [{ employeeId: emp.id, date: addDays(today(), 3), status: 'present' }])).ok).toBe(false);
    expect((await markAttendance(faculty(), [{ employeeId: emp.id, date: d, status: 'present' }])).ok).toBe(false);
  });
});

describe('departments & designations', () => {
  it('prevents deactivating departments/designations with active employees', async () => {
    expect((await setDepartmentStatus(admin(), 'dept-cse', 'inactive')).ok).toBe(false);
    expect((await setDesignationStatus(admin(), 'des-asst', 'inactive')).ok).toBe(false);
    expect((await setDepartmentStatus(hr(), 'dept-cse', 'inactive')).ok).toBe(false);
  });
});

describe('payroll', () => {
  it('computes and validates salary maths', () => {
    const p = computePayroll(80000, 'faculty');
    expect(p.net).toBe(p.basic + p.hra + p.da + p.otherAllowances - p.pf - p.tax - p.otherDeductions);
    expect(validatePayroll(p)).toBeNull();
    expect(validatePayroll({ ...p, net: p.net + 1 })).not.toBeNull();
    expect(validatePayroll({ ...p, pf: 10_000_000, net: 0 })).not.toBeNull();
  });

  it('employees only see their own finalised payslips', () => {
    const rows = visiblePayroll(faculty());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.employeeId === faculty().employeeId)).toBe(true);
    expect(can(faculty(), 'payroll.view_all')).toBe(false);
    expect(visiblePayroll(hr()).length).toBe(Object.keys(getDb().payroll).length);
  });

  it('does not generate duplicates and locks paid records', async () => {
    const period = today().slice(0, 7);
    const g = await generatePayroll(hr(), period);
    expect(g.ok).toBe(false); // seed already has the current period
    const paid = Object.values(getDb().payroll).find((p) => p.status === 'Paid')!;
    expect((await updatePayroll(hr(), paid.id, { ...paid, basic: 1 })).ok).toBe(false);
    const pending = Object.values(getDb().payroll).find((p) => p.status === 'Pending')!;
    const u = await updatePayroll(hr(), pending.id, { ...pending, otherAllowances: pending.otherAllowances + 1000 });
    expect(u.ok).toBe(true);
    if (u.ok) expect(u.data.net).toBe(pending.net + 1000);
    expect((await setPayrollStatus(hr(), [pending.id], 'Paid')).ok).toBe(true);
    expect((await setPayrollStatus(hr(), [pending.id], 'Pending')).ok).toBe(false);
    expect((await updatePayroll(faculty(), pending.id, pending)).ok).toBe(false);
  });
});

describe('access control', () => {
  it('scopes the directory and guards deletion', async () => {
    expect(visibleEmployees(faculty()).map((e) => e.id)).toEqual([faculty().employeeId]);
    expect(visibleEmployees(head()).length).toBeGreaterThan(1);
    expect((await deleteEmployee(hr(), 'NIT-1050')).ok).toBe(false);
    expect((await deleteEmployee(admin(), head().employeeId!)).ok).toBe(false);
  });
});
