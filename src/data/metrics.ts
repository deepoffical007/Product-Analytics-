import { addDays, addMonths, currentPeriod, daysUntilAnniversary, formatPeriod, monthEnd, monthStart, today, yearsBetween } from '@/lib/dates';
import type { AttendanceRecord, Database, Employee, LeaveType, StaffCategory } from './types';
import { LEAVE_TYPES } from './types';

export const isCurrent = (e: Employee) => e.status === 'Active' || e.status === 'Probation';

export function categoryOf(db: Database, e: Employee): StaffCategory {
  return db.designations.find((d) => d.id === e.designationId)?.category ?? 'administrative';
}

export function onLeaveOn(db: Database, date: string) {
  return db.leaveRequests.filter((r) => r.status === 'approved' && r.startDate <= date && r.endDate >= date);
}

export function attendanceOn(db: Database, date: string): AttendanceRecord[] {
  return Object.values(db.attendance).filter((r) => r.date === date);
}

/** Attendance rate = (present + late) ÷ (present + late + absent). Leave days are excluded. */
export function attendanceRate(records: AttendanceRecord[]) {
  let p = 0;
  let a = 0;
  for (const r of records) {
    if (r.status === 'present' || r.status === 'late') p++;
    else if (r.status === 'absent') a++;
  }
  return p + a === 0 ? 0 : (p / (p + a)) * 100;
}

export function summarize(records: AttendanceRecord[]) {
  const out = { present: 0, late: 0, absent: 0, on_leave: 0 };
  for (const r of records) out[r.status]++;
  return out;
}

export function headline(db: Database) {
  const t = today();
  const current = db.employees.filter(isCurrent);
  const faculty = current.filter((e) => categoryOf(db, e) === 'faculty');
  const todays = attendanceOn(db, t);
  const currentIds = new Set(current.map((e) => e.id));
  const presentToday = todays.filter((r) => currentIds.has(r.employeeId) && (r.status === 'present' || r.status === 'late')).length;
  const onLeave = new Set(onLeaveOn(db, t).map((r) => r.employeeId)).size;
  return {
    totalEmployees: db.employees.filter((e) => e.status !== 'Resigned').length,
    current: current.length,
    activeFaculty: faculty.length,
    adminStaff: current.length - faculty.length,
    presentToday,
    markedToday: todays.filter((r) => currentIds.has(r.employeeId)).length,
    onLeaveToday: onLeave,
    pendingLeave: db.leaveRequests.filter((r) => r.status === 'pending').length,
    departments: db.departments.filter((d) => d.status === 'active').length,
  };
}

export function departmentDistribution(db: Database, deptFilter?: string) {
  return db.departments
    .filter((d) => d.status === 'active' && (!deptFilter || d.id === deptFilter))
    .map((d) => {
      const emps = db.employees.filter((e) => e.departmentId === d.id && isCurrent(e));
      const faculty = emps.filter((e) => categoryOf(db, e) === 'faculty').length;
      return { id: d.id, name: d.name, code: d.code, total: emps.length, faculty, administrative: emps.length - faculty };
    })
    .sort((a, b) => b.total - a.total);
}

export function monthlyAttendance(db: Database, months = 6, deptFilter?: string) {
  const cur = currentPeriod();
  const empDept = new Map(db.employees.map((e) => [e.id, e.departmentId]));
  const buckets = new Map<string, AttendanceRecord[]>();
  for (const r of Object.values(db.attendance)) {
    if (r.date > today()) continue;
    if (deptFilter && empDept.get(r.employeeId) !== deptFilter) continue;
    const p = r.date.slice(0, 7);
    (buckets.get(p) ?? buckets.set(p, []).get(p)!).push(r);
  }
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const p = addMonths(cur, -i);
    const recs = buckets.get(p) ?? [];
    const s = summarize(recs);
    out.push({ period: p, label: formatPeriod(p), rate: Math.round(attendanceRate(recs) * 10) / 10, ...s, records: recs.length });
  }
  return out.filter((m) => m.records > 0);
}

export function leaveOverview(db: Database, year = Number(today().slice(0, 4))) {
  const reqs = db.leaveRequests.filter((r) => r.startDate.startsWith(String(year)));
  const byStatus = { pending: 0, approved: 0, rejected: 0, cancelled: 0 };
  for (const r of reqs) byStatus[r.status]++;
  const byType = LEAVE_TYPES.map((t) => ({
    type: t.value as LeaveType,
    label: t.label.replace(' Approved Leave', '').replace(' Leave', ''),
    approvedDays: reqs.filter((r) => r.type === t.value && r.status === 'approved').reduce((a, r) => a + r.days, 0),
    requests: reqs.filter((r) => r.type === t.value).length,
  }));
  return { byStatus, byType, total: reqs.length };
}

export function upcomingCelebrations(db: Database, withinDays = 30) {
  const t = today();
  const out: { employee: Employee; kind: 'birthday' | 'anniversary'; inDays: number; years?: number; date: string }[] = [];
  for (const e of db.employees.filter(isCurrent)) {
    const b = daysUntilAnniversary(e.dateOfBirth, t);
    if (b <= withinDays) out.push({ employee: e, kind: 'birthday', inDays: b, date: addDays(t, b) });
    const a = daysUntilAnniversary(e.joiningDate, t);
    const years = yearsBetween(e.joiningDate, addDays(t, a));
    if (a <= withinDays && years >= 1) out.push({ employee: e, kind: 'anniversary', inDays: a, years, date: addDays(t, a) });
  }
  return out.sort((x, y) => x.inDays - y.inDays);
}

/** Joiners and exits per month (headcount trend). */
export function joiningExitTrend(db: Database, months = 12, deptFilter?: string) {
  const cur = currentPeriod();
  const emps = db.employees.filter((e) => !deptFilter || e.departmentId === deptFilter);
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const p = addMonths(cur, -i);
    const s = monthStart(p);
    const en = monthEnd(p);
    out.push({
      period: p,
      label: formatPeriod(p),
      joined: emps.filter((e) => e.joiningDate >= s && e.joiningDate <= en).length,
      exited: emps.filter((e) => e.exitDate && e.exitDate >= s && e.exitDate <= en).length,
      headcount: emps.filter((e) => e.joiningDate <= en && (!e.exitDate || e.exitDate > en) && e.status !== 'Inactive').length,
    });
  }
  return out;
}

export function employeeAttendanceStats(db: Database, employeeId: string, from?: string, to?: string) {
  const recs = Object.values(db.attendance).filter((r) => r.employeeId === employeeId && r.date <= today() && (!from || r.date >= from) && (!to || r.date <= to));
  return { ...summarize(recs), rate: attendanceRate(recs), records: recs };
}
