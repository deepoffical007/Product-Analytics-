import { can } from '@/lib/permissions';
import { isWeekend, today } from '@/lib/dates';
import { commit, getDb } from '../store';
import type { AttendanceRecord, AttendanceStatus, Database, Employee, User } from '../types';
import { auditEntry, fail, ok, requireActor, run, withAudit, type Result } from './core';

export const attendanceKey = (employeeId: string, date: string) => `${employeeId}:${date}`;

export function isEmployedOn(e: Employee, date: string) {
  return e.status !== 'Inactive' && e.joiningDate <= date && (!e.exitDate || e.exitDate >= date);
}

export function approvedLeaveOn(db: Database, employeeId: string, date: string) {
  return db.leaveRequests.find((r) => r.employeeId === employeeId && r.status === 'approved' && r.startDate <= date && r.endDate >= date);
}

export interface AttendanceEntry {
  employeeId: string;
  date: string;
  status: Exclude<AttendanceStatus, 'on_leave'>;
  checkIn?: string | null;
}

function validateEntry(db: Database, entry: AttendanceEntry): string | null {
  const emp = db.employees.find((e) => e.id === entry.employeeId);
  if (!emp) return `Employee ${entry.employeeId} not found.`;
  if (entry.date > today()) return 'Attendance cannot be recorded for a future date.';
  if (isWeekend(entry.date)) return 'Attendance is not recorded on weekends.';
  const hol = db.settings.holidays.find((h) => h.date === entry.date);
  if (hol) return `${entry.date} is a holiday (${hol.name}).`;
  if (!isEmployedOn(emp, entry.date)) return `${emp.firstName} ${emp.lastName} was not employed on this date.`;
  if (approvedLeaveOn(db, emp.id, entry.date)) return `${emp.firstName} ${emp.lastName} has approved leave on this date. The status is set automatically.`;
  if (!['present', 'absent', 'late'].includes(entry.status)) return 'Invalid attendance status.';
  if (entry.checkIn && !/^([01]\d|2[0-3]):[0-5]\d$/.test(entry.checkIn)) return 'Check-in time must be HH:mm.';
  return null;
}

function toRecord(db: Database, actor: User, e: AttendanceEntry): AttendanceRecord {
  const defaultIn = e.status === 'present' ? db.settings.workdayStart : e.status === 'late' ? '09:40' : null;
  return {
    id: attendanceKey(e.employeeId, e.date),
    employeeId: e.employeeId,
    date: e.date,
    status: e.status,
    checkIn: e.status === 'absent' ? null : (e.checkIn ?? defaultIn),
    source: 'register',
    markedBy: actor.id,
    updatedAt: new Date().toISOString(),
  };
}

/** Insert-only: rejects when a record already exists for that employee and date. */
export function createAttendance(actor: User | null, entry: AttendanceEntry): Promise<Result<AttendanceRecord>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'attendance.mark')) return fail('You do not have permission to record attendance.');
    const db = getDb();
    const err = validateEntry(db, entry);
    if (err) return fail(err);
    const key = attendanceKey(entry.employeeId, entry.date);
    if (db.attendance[key]) return fail('Attendance is already recorded for this employee on this date. Update the existing entry instead.');
    const rec = toRecord(db, actor, entry);
    commit((d) => ({ attendance: { ...d.attendance, [key]: rec }, auditLogs: withAudit(d, auditEntry(actor, 'attendance.create', 'attendance', key, `Recorded ${entry.status} for ${entry.employeeId} on ${entry.date}`)) }));
    return ok(rec);
  });
}

/**
 * Register marking: creates or updates one record per employee/date (natural key),
 * so repeated clicks can never produce duplicates.
 */
export function markAttendance(actor: User | null, entries: AttendanceEntry[]): Promise<Result<{ created: number; updated: number; skipped: string[] }>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'attendance.mark')) return fail('You do not have permission to record attendance.');
    if (!entries.length) return fail('Nothing to update.');
    const db = getDb();
    const seen = new Set<string>();
    const next: Record<string, AttendanceRecord> = {};
    const skipped: string[] = [];
    let created = 0;
    let updated = 0;
    for (const entry of entries) {
      const key = attendanceKey(entry.employeeId, entry.date);
      if (seen.has(key)) continue; // de-duplicate within the batch
      seen.add(key);
      const err = validateEntry(db, entry);
      if (err) {
        skipped.push(err);
        continue;
      }
      const existing = db.attendance[key];
      if (existing && existing.status === entry.status && (entry.checkIn === undefined || existing.checkIn === entry.checkIn)) continue;
      next[key] = toRecord(db, actor, entry);
      existing ? updated++ : created++;
    }
    if (!created && !updated) {
      if (skipped.length) return fail(skipped[0]!);
      return ok({ created, updated, skipped });
    }
    const date = entries[0]!.date;
    commit((d) => ({
      attendance: { ...d.attendance, ...next },
      auditLogs: withAudit(d, auditEntry(actor, 'attendance.mark', 'attendance', date, `Attendance register ${date}: ${created} recorded, ${updated} updated`)),
    }));
    return ok({ created, updated, skipped });
  });
}

export function clearAttendance(actor: User | null, employeeId: string, date: string): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'attendance.mark')) return fail('You do not have permission to change attendance.');
    const db = getDb();
    const key = attendanceKey(employeeId, date);
    const rec = db.attendance[key];
    if (!rec) return fail('No attendance entry to clear.');
    if (rec.status === 'on_leave') return fail('Leave entries are managed through leave requests.');
    commit((d) => {
      const attendance = { ...d.attendance };
      delete attendance[key];
      return { attendance, auditLogs: withAudit(d, auditEntry(actor, 'attendance.clear', 'attendance', key, `Cleared attendance for ${employeeId} on ${date}`)) };
    });
    return ok(undefined);
  });
}
