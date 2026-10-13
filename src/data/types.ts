// Domain model for the College Employee Management System.
// These shapes mirror the PostgreSQL schema in supabase/migrations so the
// demo (browser storage) data layer can be swapped for a real backend.

export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string; // full ISO timestamp

export type Role = 'super_admin' | 'hr' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  employeeId: string | null;
  active: boolean;
  lastLoginAt?: ISODateTime;
}

export type StaffCategory = 'faculty' | 'administrative';

export interface Department {
  id: string;
  code: string;
  name: string;
  headId: string | null; // employee id
  status: 'active' | 'inactive';
  description: string;
  createdAt: ISODateTime;
}

export interface Designation {
  id: string;
  title: string;
  category: StaffCategory;
  grade: number; // 1 = most senior
  status: 'active' | 'inactive';
}

export type EmploymentType = 'Full-time' | 'Part-time' | 'Contract' | 'Visiting';
export type EmploymentStatus = 'Active' | 'Probation' | 'Inactive' | 'Resigned';

export interface EmployeeDocument {
  id: string;
  name: string;
  type: 'Identity' | 'Academic' | 'Employment' | 'Other';
  status: 'Verified' | 'Pending' | 'Missing';
  uploadedAt: ISODate | null;
}

export interface Employee {
  id: string; // e.g. NIT-1042
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarColor: string;
  gender: 'Female' | 'Male' | 'Other';
  dateOfBirth: ISODate;
  address: string;
  emergencyContact: string;
  departmentId: string;
  designationId: string;
  employmentType: EmploymentType;
  joiningDate: ISODate;
  exitDate: ISODate | null;
  reportingManagerId: string | null;
  status: EmploymentStatus;
  qualification: string;
  specialization: string;
  basicSalary: number; // monthly, INR — sensitive
  bankAccount: string; // masked in UI — sensitive
  documents: EmployeeDocument[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'on_leave';

export interface AttendanceRecord {
  id: string; // `${employeeId}:${date}` — the natural key guarantees uniqueness
  employeeId: string;
  date: ISODate;
  status: AttendanceStatus;
  checkIn: string | null; // HH:mm
  source: 'register' | 'leave' | 'seed';
  markedBy: string | null; // user id
  updatedAt: ISODateTime;
}

export type LeaveType = 'casual' | 'sick' | 'earned' | 'academic' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: ISODate;
  endDate: ISODate;
  days: number; // working days, computed server side
  reason: string;
  status: LeaveStatus;
  appliedAt: ISODateTime;
  reviewedBy: string | null; // user id
  reviewedAt: ISODateTime | null;
  reviewComment: string | null;
}

export interface LeaveBalance {
  id: string; // `${employeeId}:${year}:${type}`
  employeeId: string;
  year: number;
  type: LeaveType;
  allocated: number;
  used: number; // derived from approved requests — never incremented blindly
}

export type PayrollStatus = 'Pending' | 'Processed' | 'Paid' | 'On Hold';

export interface PayrollRecord {
  id: string; // `${employeeId}:${period}`
  employeeId: string;
  period: string; // YYYY-MM
  basic: number;
  hra: number;
  da: number;
  otherAllowances: number;
  pf: number;
  tax: number;
  otherDeductions: number;
  net: number;
  status: PayrollStatus;
  paidOn: ISODate | null;
  updatedAt: ISODateTime;
}

export type ReviewStatus = 'Not Started' | 'Self Assessment' | 'Manager Review' | 'Completed';

export interface Goal {
  id: string;
  title: string;
  progress: number; // 0-100
  weight: number;
}

export interface PerformanceReview {
  id: string;
  employeeId: string;
  cycle: string;
  reviewerId: string | null; // employee id of reviewer
  status: ReviewStatus;
  goals: Goal[];
  ratings: { teaching: number | null; research: number | null; service: number | null; professionalism: number | null };
  overallRating: number | null;
  managerFeedback: string;
  selfAssessment: string;
  trainingNeeds: string[];
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

export type JobStatus = 'Open' | 'On Hold' | 'Closed';

export interface JobOpening {
  id: string;
  title: string;
  departmentId: string;
  designationId: string;
  employmentType: EmploymentType;
  positions: number;
  status: JobStatus;
  postedOn: ISODate;
  closingDate: ISODate;
  description: string;
}

export const PIPELINE_STAGES = ['Applied', 'Shortlisted', 'Interview', 'Selected', 'Offered', 'Joined', 'Rejected'] as const;
export type CandidateStage = (typeof PIPELINE_STAGES)[number];

export interface OnboardingItem {
  key: string;
  label: string;
  done: boolean;
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  jobId: string;
  stage: CandidateStage;
  appliedOn: ISODate;
  experienceYears: number;
  qualification: string;
  interviewAt: ISODateTime | null;
  interviewPanel: string;
  offerStatus: 'None' | 'Extended' | 'Accepted' | 'Declined';
  notes: string;
  onboarding: OnboardingItem[];
  documentsSubmitted: { name: string; submitted: boolean }[];
  employeeId: string | null; // set when joined
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  kind: 'leave' | 'employee' | 'attendance' | 'payroll' | 'anniversary' | 'recruitment' | 'performance' | 'system';
  link: string | null;
  read: boolean;
  createdAt: ISODateTime;
}

export interface AuditLog {
  id: string;
  at: ISODateTime;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: string; // e.g. employee.update
  entity: string;
  entityId: string;
  summary: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  category: 'Event' | 'Notice' | 'Holiday' | 'Academic';
  date: ISODate;
  createdBy: string;
  createdAt: ISODateTime;
}

export interface Holiday {
  date: ISODate;
  name: string;
}

export interface Settings {
  institutionName: string;
  institutionShort: string;
  leavePolicy: Record<LeaveType, number>;
  workdayStart: string; // HH:mm — check-ins after grace are "late"
  lateAfter: string; // HH:mm
  holidays: Holiday[];
  currency: 'INR';
}

export interface Database {
  version: number;
  seededAt: ISODateTime;
  users: User[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  attendance: Record<string, AttendanceRecord>; // keyed by natural key
  leaveRequests: LeaveRequest[];
  leaveBalances: Record<string, LeaveBalance>;
  payroll: Record<string, PayrollRecord>;
  reviews: PerformanceReview[];
  jobs: JobOpening[];
  candidates: Candidate[];
  notifications: Notification[];
  auditLogs: AuditLog[];
  announcements: Announcement[];
  settings: Settings;
}

export const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'earned', label: 'Earned Leave' },
  { value: 'academic', label: 'Academic Leave' },
  { value: 'other', label: 'Other Approved Leave' },
];

export const leaveTypeLabel = (t: LeaveType) => LEAVE_TYPES.find((l) => l.value === t)?.label ?? t;

export const ATTENDANCE_STATUSES: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'on_leave', label: 'On Leave' },
];

export const EMPLOYMENT_TYPES: EmploymentType[] = ['Full-time', 'Part-time', 'Contract', 'Visiting'];
export const EMPLOYMENT_STATUSES: EmploymentStatus[] = ['Active', 'Probation', 'Inactive', 'Resigned'];
export const PAYROLL_STATUSES: PayrollStatus[] = ['Pending', 'Processed', 'Paid', 'On Hold'];
export const REVIEW_STATUSES: ReviewStatus[] = ['Not Started', 'Self Assessment', 'Manager Review', 'Completed'];
