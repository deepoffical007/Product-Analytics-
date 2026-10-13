import type { Database, Employee, PerformanceReview, Role, User } from '@/data/types';

export type Permission =
  | 'employees.view_all'
  | 'employees.create'
  | 'employees.edit'
  | 'employees.deactivate'
  | 'employees.delete'
  | 'employees.export'
  | 'employees.view_sensitive'
  | 'departments.view'
  | 'departments.manage'
  | 'attendance.view_all'
  | 'attendance.mark'
  | 'attendance.export'
  | 'leave.review_all'
  | 'payroll.view_all'
  | 'payroll.manage'
  | 'performance.view_all'
  | 'performance.manage_all'
  | 'recruitment.view'
  | 'recruitment.manage'
  | 'reports.view'
  | 'audit.view'
  | 'settings.manage'
  | 'users.manage'
  | 'announcements.manage';

const ALL: Permission[] = [
  'employees.view_all', 'employees.create', 'employees.edit', 'employees.deactivate', 'employees.delete', 'employees.export', 'employees.view_sensitive',
  'departments.view', 'departments.manage', 'attendance.view_all', 'attendance.mark', 'attendance.export', 'leave.review_all',
  'payroll.view_all', 'payroll.manage', 'performance.view_all', 'performance.manage_all', 'recruitment.view', 'recruitment.manage',
  'reports.view', 'audit.view', 'settings.manage', 'users.manage', 'announcements.manage',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set(ALL),
  hr: new Set<Permission>([
    'employees.view_all', 'employees.create', 'employees.edit', 'employees.export', 'employees.view_sensitive',
    'departments.view', 'attendance.view_all', 'attendance.mark', 'attendance.export', 'leave.review_all',
    'payroll.view_all', 'payroll.manage', 'performance.view_all', 'performance.manage_all', 'recruitment.view', 'recruitment.manage',
    'reports.view', 'audit.view', 'announcements.manage',
  ]),
  employee: new Set<Permission>([]),
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  hr: 'HR / Administration',
  employee: 'Faculty / Employee',
};

export function can(user: User | null | undefined, perm: Permission): boolean {
  return !!user && user.active && ROLE_PERMISSIONS[user.role].has(perm);
}

/** Department ids the user heads (managers get scoped access to their team). */
export function headedDepartmentIds(user: User | null | undefined, db: Pick<Database, 'departments'>): string[] {
  if (!user?.employeeId) return [];
  return db.departments.filter((d) => d.headId === user.employeeId && d.status === 'active').map((d) => d.id);
}

export function isManagerOf(user: User | null | undefined, emp: Employee, db: Pick<Database, 'departments'>): boolean {
  if (!user?.employeeId || emp.id === user.employeeId) return false;
  return emp.reportingManagerId === user.employeeId || headedDepartmentIds(user, db).includes(emp.departmentId);
}

export function canViewEmployee(user: User | null | undefined, emp: Employee, db: Pick<Database, 'departments'>) {
  return can(user, 'employees.view_all') || user?.employeeId === emp.id || isManagerOf(user, emp, db);
}

/** Leave review: HR/admin for everyone, managers for their team — never your own request. */
export function canReviewLeaveFor(user: User | null | undefined, emp: Employee, db: Pick<Database, 'departments'>) {
  if (!user || user.employeeId === emp.id) return false;
  return can(user, 'leave.review_all') || isManagerOf(user, emp, db);
}

export function canManageReview(user: User | null | undefined, review: PerformanceReview, emp: Employee, db: Pick<Database, 'departments'>) {
  if (!user || user.employeeId === review.employeeId) return false;
  return can(user, 'performance.manage_all') || review.reviewerId === user.employeeId || isManagerOf(user, emp, db);
}

export function isTeamManager(user: User | null | undefined, db: Pick<Database, 'departments' | 'employees'>) {
  if (!user?.employeeId) return false;
  return headedDepartmentIds(user, db).length > 0 || db.employees.some((e) => e.reportingManagerId === user.employeeId);
}

/** Fields an employee may change on their own record. */
export const SELF_EDITABLE_FIELDS = ['phone', 'address', 'emergencyContact'] as const;
