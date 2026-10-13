import { Badge, type Tone } from './ui/badge';
import type { AttendanceStatus, CandidateStage, EmploymentStatus, JobStatus, LeaveStatus, PayrollStatus, ReviewStatus } from '@/data/types';

const MAP: Record<string, [Tone, string]> = {
  // employment
  Active: ['success', 'Active'],
  Probation: ['info', 'Probation'],
  Inactive: ['neutral', 'Inactive'],
  Resigned: ['danger', 'Resigned'],
  // attendance
  present: ['success', 'Present'],
  late: ['warning', 'Late'],
  absent: ['danger', 'Absent'],
  on_leave: ['violet', 'On Leave'],
  unmarked: ['neutral', 'Not marked'],
  // leave
  pending: ['warning', 'Pending'],
  approved: ['success', 'Approved'],
  rejected: ['danger', 'Rejected'],
  cancelled: ['neutral', 'Cancelled'],
  // payroll
  Pending: ['warning', 'Pending'],
  Processed: ['info', 'Processed'],
  Paid: ['success', 'Paid'],
  'On Hold': ['danger', 'On Hold'],
  // reviews
  'Not Started': ['neutral', 'Not started'],
  'Self Assessment': ['info', 'Self assessment'],
  'Manager Review': ['warning', 'Manager review'],
  Completed: ['success', 'Completed'],
  // recruitment
  Open: ['success', 'Open'],
  Closed: ['neutral', 'Closed'],
  Applied: ['neutral', 'Applied'],
  Shortlisted: ['info', 'Shortlisted'],
  Interview: ['primary', 'Interview'],
  Selected: ['violet', 'Selected'],
  Offered: ['warning', 'Offered'],
  Joined: ['success', 'Joined'],
  Rejected: ['danger', 'Rejected'],
  // department
  active: ['success', 'Active'],
  inactive: ['neutral', 'Inactive'],
};

type Known = EmploymentStatus | AttendanceStatus | LeaveStatus | PayrollStatus | ReviewStatus | JobStatus | CandidateStage | 'unmarked' | 'active' | 'inactive';

export function StatusBadge({ status, className }: { status: Known; className?: string }) {
  const [tone, label] = MAP[status] ?? (['neutral', status] as [Tone, string]);
  return (
    <Badge tone={tone} dot className={className}>
      {label}
    </Badge>
  );
}

export const statusTone = (s: string): Tone => MAP[s]?.[0] ?? 'neutral';
