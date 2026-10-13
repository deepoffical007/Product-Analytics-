import { can, canReviewLeaveFor, headedDepartmentIds, isManagerOf } from '@/lib/permissions';
import { addDays, rangesOverlap, today, workingDaysBetween } from '@/lib/dates';
import { commit, getDb } from '../store';
import { firstError, leaveSchema, type LeaveInput } from '../schemas';
import { leaveTypeLabel, type AttendanceRecord, type Database, type LeaveBalance, type LeaveRequest, type LeaveType, type User } from '../types';
import { auditEntry, fail, makeNotifications, ok, requireActor, run, userForEmployee, usersWithRole, withAudit, withNotifications, type Result } from './core';
import { fullName } from './employees';

export const SICK_BACKDATE_DAYS = 7;

export function countLeaveDays(db: Database, start: string, end: string) {
  return workingDaysBetween(start, end, db.settings.holidays).length;
}

/** Balance with pending days, computed from the source-of-truth request list. */
export function getBalance(db: Database, employeeId: string, type: LeaveType, year: number) {
  const id = `${employeeId}:${year}:${type}`;
  const stored = db.leaveBalances[id];
  const allocated = stored?.allocated ?? db.settings.leavePolicy[type];
  const inYear = db.leaveRequests.filter((r) => r.employeeId === employeeId && r.type === type && r.startDate.startsWith(String(year)));
  const used = inYear.filter((r) => r.status === 'approved').reduce((a, r) => a + r.days, 0);
  const pending = inYear.filter((r) => r.status === 'pending').reduce((a, r) => a + r.days, 0);
  return { id, allocated, used, pending, available: allocated - used - pending };
}

/**
 * Recalculates `used` from approved requests. Because the balance is derived
 * (not incremented), editing or re-processing a request can never deduct twice.
 */
function recomputeBalance(db: Database, requests: LeaveRequest[], employeeId: string, type: LeaveType, year: number): LeaveBalance {
  const id = `${employeeId}:${year}:${type}`;
  const used = requests.filter((r) => r.employeeId === employeeId && r.type === type && r.status === 'approved' && r.startDate.startsWith(String(year))).reduce((a, r) => a + r.days, 0);
  return { id, employeeId, year, type, allocated: db.leaveBalances[id]?.allocated ?? db.settings.leavePolicy[type], used };
}

function reviewerUserIds(db: Database, employeeId: string): string[] {
  const emp = db.employees.find((e) => e.id === employeeId);
  const ids = usersWithRole(db, 'hr', 'super_admin');
  if (emp) {
    const dept = db.departments.find((d) => d.id === emp.departmentId);
    for (const mgrEmpId of [emp.reportingManagerId, dept?.headId]) {
      const u = userForEmployee(db, mgrEmpId);
      if (u) ids.push(u.id);
    }
  }
  return ids;
}

function validateRequest(db: Database, employeeId: string, v: LeaveInput, excludeId?: string): { error: string } | { days: number } {
  const emp = db.employees.find((e) => e.id === employeeId);
  if (!emp) return { error: 'Employee record not found.' };
  if (emp.status === 'Inactive' || emp.status === 'Resigned') return { error: 'Inactive employees cannot apply for leave.' };
  const t = today();
  const earliest = v.type === 'sick' ? addDays(t, -SICK_BACKDATE_DAYS) : t;
  if (v.startDate < earliest) return { error: v.type === 'sick' ? `Sick leave can be back-dated by at most ${SICK_BACKDATE_DAYS} days.` : 'Start date cannot be in the past.' };
  if (v.endDate > addDays(t, 365)) return { error: 'Leave can be requested at most one year in advance.' };
  const days = countLeaveDays(db, v.startDate, v.endDate);
  if (days <= 0) return { error: 'The selected dates contain no working days (weekends and holidays are excluded).' };
  const clash = db.leaveRequests.find((r) => r.id !== excludeId && r.employeeId === employeeId && (r.status === 'pending' || r.status === 'approved') && rangesOverlap(r.startDate, r.endDate, v.startDate, v.endDate));
  if (clash) return { error: `These dates overlap your ${clash.status} request ${clash.id} (${clash.startDate} → ${clash.endDate}).` };
  const year = Number(v.startDate.slice(0, 4));
  const bal = getBalance(db, employeeId, v.type as LeaveType, year);
  const own = excludeId ? db.leaveRequests.find((r) => r.id === excludeId) : undefined;
  const reclaim = own && own.status === 'pending' && own.type === v.type && own.startDate.startsWith(String(year)) ? own.days : 0;
  if (days > bal.available + reclaim) return { error: `Insufficient ${leaveTypeLabel(v.type as LeaveType)} balance: ${bal.available + reclaim} day(s) available, ${days} requested.` };
  return { days };
}

export function applyLeave(actor: User | null, input: LeaveInput): Promise<Result<LeaveRequest>> {
  return run(() => {
    requireActor(actor);
    if (!actor.employeeId) return fail('Your account is not linked to an employee record.');
    const parsed = leaveSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const check = validateRequest(db, actor.employeeId, parsed.data);
    if ('error' in check) return fail(check.error);
    const max = db.leaveRequests.reduce((m, r) => Math.max(m, Number(r.id.split('-')[1]) || 0), 0);
    const req: LeaveRequest = {
      id: `LR-${String(max + 1).padStart(4, '0')}`,
      employeeId: actor.employeeId,
      type: parsed.data.type as LeaveType,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      days: check.days,
      reason: parsed.data.reason,
      status: 'pending',
      appliedAt: new Date().toISOString(),
      reviewedBy: null,
      reviewedAt: null,
      reviewComment: null,
    };
    const emp = db.employees.find((e) => e.id === actor.employeeId)!;
    commit((d) => ({
      leaveRequests: [req, ...d.leaveRequests],
      auditLogs: withAudit(d, auditEntry(actor, 'leave.apply', 'leave_request', req.id, `${fullName(emp)} applied for ${req.days} day(s) of ${leaveTypeLabel(req.type)}`)),
      notifications: withNotifications(d, makeNotifications(reviewerUserIds(d, emp.id), { title: 'New leave request', message: `${fullName(emp)} requested ${req.days} day(s) of ${leaveTypeLabel(req.type)} (${req.startDate} → ${req.endDate}).`, kind: 'leave', link: `/leave-management?request=${req.id}` }, actor.id)),
    }));
    return ok(req);
  });
}

/** Employees may edit their own *pending* requests. Balance is derived, so no double deduction. */
export function updateLeave(actor: User | null, id: string, input: LeaveInput): Promise<Result<LeaveRequest>> {
  return run(() => {
    requireActor(actor);
    const db = getDb();
    const req = db.leaveRequests.find((r) => r.id === id);
    if (!req) return fail('Leave request not found.');
    if (req.employeeId !== actor.employeeId) return fail('You can only edit your own leave requests.');
    if (req.status !== 'pending') return fail(`This request is already ${req.status} and can no longer be edited.`);
    const parsed = leaveSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const check = validateRequest(db, req.employeeId, parsed.data, id);
    if ('error' in check) return fail(check.error);
    const after: LeaveRequest = { ...req, type: parsed.data.type as LeaveType, startDate: parsed.data.startDate, endDate: parsed.data.endDate, reason: parsed.data.reason, days: check.days };
    commit((d) => ({ leaveRequests: d.leaveRequests.map((r) => (r.id === id ? after : r)), auditLogs: withAudit(d, auditEntry(actor, 'leave.edit', 'leave_request', id, `Edited pending leave request ${id}`)) }));
    return ok(after);
  });
}

export function cancelLeave(actor: User | null, id: string): Promise<Result<LeaveRequest>> {
  return run(() => {
    requireActor(actor);
    const db = getDb();
    const req = db.leaveRequests.find((r) => r.id === id);
    if (!req) return fail('Leave request not found.');
    if (req.employeeId !== actor.employeeId) return fail('You can only cancel your own leave requests.');
    if (req.status !== 'pending') return fail(`Only pending requests can be cancelled. This one is ${req.status}.`);
    const after: LeaveRequest = { ...req, status: 'cancelled' };
    commit((d) => ({ leaveRequests: d.leaveRequests.map((r) => (r.id === id ? after : r)), auditLogs: withAudit(d, auditEntry(actor, 'leave.cancel', 'leave_request', id, `Cancelled leave request ${id}`)) }));
    return ok(after);
  });
}

export function reviewLeave(actor: User | null, id: string, decision: 'approved' | 'rejected', comment: string): Promise<Result<LeaveRequest>> {
  return run(() => {
    requireActor(actor);
    const db = getDb();
    const req = db.leaveRequests.find((r) => r.id === id);
    if (!req) return fail('Leave request not found.');
    const emp = db.employees.find((e) => e.id === req.employeeId);
    if (!emp) return fail('Employee record not found.');
    if (!canReviewLeaveFor(actor, emp, db)) return fail(actor.employeeId === emp.id ? 'You cannot review your own leave request.' : 'You are not authorised to review this request.');
    // Status guard: a request is processed exactly once.
    if (req.status !== 'pending') return fail(`This request was already ${req.status}.`);
    const note = comment.trim();
    if (decision === 'rejected' && note.length < 3) return fail('Please add a comment explaining the rejection.');
    if (decision === 'approved') {
      const year = Number(req.startDate.slice(0, 4));
      const bal = getBalance(db, req.employeeId, req.type, year);
      // Only approved days count against the allocation at approval time.
      const remaining = bal.allocated - bal.used;
      if (req.days > remaining) return fail(`Approving would exceed the ${leaveTypeLabel(req.type)} balance (${remaining} day(s) left).`);
    }
    const after: LeaveRequest = { ...req, status: decision, reviewedBy: actor.id, reviewedAt: new Date().toISOString(), reviewComment: note || null };
    const empUser = userForEmployee(db, emp.id);

    commit((d) => {
      const leaveRequests = d.leaveRequests.map((r) => (r.id === id ? after : r));
      const year = Number(req.startDate.slice(0, 4));
      const bal = recomputeBalance(d, leaveRequests, req.employeeId, req.type, year);
      let attendance = d.attendance;
      if (decision === 'approved') {
        attendance = { ...d.attendance };
        for (const date of workingDaysBetween(req.startDate, req.endDate, d.settings.holidays)) {
          const key = `${req.employeeId}:${date}`;
          const rec: AttendanceRecord = { id: key, employeeId: req.employeeId, date, status: 'on_leave', checkIn: null, source: 'leave', markedBy: actor.id, updatedAt: new Date().toISOString() };
          attendance[key] = rec;
        }
      }
      return {
        leaveRequests,
        leaveBalances: { ...d.leaveBalances, [bal.id]: bal },
        attendance,
        auditLogs: withAudit(d, auditEntry(actor, `leave.${decision === 'approved' ? 'approve' : 'reject'}`, 'leave_request', id, `${decision === 'approved' ? 'Approved' : 'Rejected'} ${req.days} day(s) of ${leaveTypeLabel(req.type)} for ${fullName(emp)}`)),
        notifications: withNotifications(
          d,
          empUser
            ? makeNotifications([empUser.id], { title: `Leave ${decision}`, message: `Your ${leaveTypeLabel(req.type)} request (${req.startDate} → ${req.endDate}) was ${decision}${note ? `: “${note}”` : '.'}`, kind: 'leave', link: `/leave-management?request=${id}` }, actor.id)
            : [],
        ),
      };
    });
    return ok(after);
  });
}

/** Requests the actor can see: own, team (managers) or all (HR/admin). */
export function visibleLeaveRequests(actor: User | null, db: Database = getDb()): LeaveRequest[] {
  if (!actor) return [];
  if (can(actor, 'leave.review_all')) return db.leaveRequests;
  const heads = headedDepartmentIds(actor, db);
  return db.leaveRequests.filter((r) => {
    if (r.employeeId === actor.employeeId) return true;
    const emp = db.employees.find((e) => e.id === r.employeeId);
    return !!emp && (heads.includes(emp.departmentId) || isManagerOf(actor, emp, db));
  });
}

/** Other pending/approved requests in the same department that overlap the given one. */
export function overlappingRequests(db: Database, req: LeaveRequest): LeaveRequest[] {
  const emp = db.employees.find((e) => e.id === req.employeeId);
  if (!emp) return [];
  return db.leaveRequests.filter((r) => {
    if (r.id === req.id || r.employeeId === req.employeeId) return false;
    if (r.status !== 'pending' && r.status !== 'approved') return false;
    const other = db.employees.find((e) => e.id === r.employeeId);
    return other?.departmentId === emp.departmentId && rangesOverlap(r.startDate, r.endDate, req.startDate, req.endDate);
  });
}
