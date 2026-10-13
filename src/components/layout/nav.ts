import { BarChart3, Bell, Briefcase, Building2, CalendarCheck, CalendarDays, LayoutDashboard, Settings, Target, Users, Wallet, UserRound, type LucideIcon } from 'lucide-react';
import { can, isTeamManager } from '@/lib/permissions';
import type { Database, User } from '@/data/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  section: 'Overview' | 'People' | 'Operations' | 'Growth' | 'System';
  visible: (u: User, db: Database) => boolean;
  badge?: (u: User, db: Database) => number;
}

const always = () => true;

export const ACCESS = {
  employees: (u: User) => can(u, 'employees.view_all'),
  departments: (u: User) => can(u, 'departments.view'),
  recruitment: (u: User) => can(u, 'recruitment.view'),
  reports: (u: User) => can(u, 'reports.view'),
};

export const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview', visible: always },
  { to: '/notifications', label: 'Notifications', icon: Bell, section: 'Overview', visible: always, badge: (u, db) => db.notifications.filter((n) => n.userId === u.id && !n.read).length },
  { to: '/employees', label: 'Employees', icon: Users, section: 'People', visible: ACCESS.employees },
  { to: '/departments', label: 'Departments', icon: Building2, section: 'People', visible: ACCESS.departments },
  { to: '/attendance', label: 'Attendance', icon: CalendarCheck, section: 'Operations', visible: always },
  {
    to: '/leave-management',
    label: 'Leave',
    icon: CalendarDays,
    section: 'Operations',
    visible: always,
    badge: (u, db) => (can(u, 'leave.review_all') || isTeamManager(u, db) ? db.leaveRequests.filter((r) => r.status === 'pending' && r.employeeId !== u.employeeId && (can(u, 'leave.review_all') || db.employees.find((e) => e.id === r.employeeId)?.reportingManagerId === u.employeeId)).length : 0),
  },
  { to: '/payroll', label: 'Payroll', icon: Wallet, section: 'Operations', visible: always },
  { to: '/performance', label: 'Performance', icon: Target, section: 'Growth', visible: always },
  { to: '/recruitment', label: 'Recruitment', icon: Briefcase, section: 'Growth', visible: ACCESS.recruitment },
  { to: '/reports', label: 'Reports', icon: BarChart3, section: 'Growth', visible: ACCESS.reports },
  { to: '/settings', label: 'Settings', icon: Settings, section: 'System', visible: always },
];

export const PROFILE_ITEM = { label: 'My Profile', icon: UserRound };
