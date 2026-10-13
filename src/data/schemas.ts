import { z } from 'zod';
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, LEAVE_TYPES } from './types';

const phoneRe = /^\+?[0-9][0-9\s-]{7,16}$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export const employeeSchema = z.object({
  id: z.string().trim().regex(/^[A-Z]{2,5}-\d{3,6}$/, 'Use the format NIT-1234'),
  firstName: z.string().trim().min(2, 'First name is required').max(40),
  lastName: z.string().trim().min(1, 'Last name is required').max(40),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().regex(phoneRe, 'Enter a valid phone number'),
  gender: z.enum(['Female', 'Male', 'Other']),
  dateOfBirth: z.string().regex(dateRe, 'Date of birth is required'),
  address: z.string().trim().max(200).default(''),
  emergencyContact: z.string().trim().max(120).default(''),
  departmentId: z.string().min(1, 'Select a department'),
  designationId: z.string().min(1, 'Select a designation'),
  employmentType: z.enum(EMPLOYMENT_TYPES as [string, ...string[]]),
  joiningDate: z.string().regex(dateRe, 'Joining date is required'),
  reportingManagerId: z.string().nullable(),
  status: z.enum(EMPLOYMENT_STATUSES as [string, ...string[]]),
  qualification: z.string().trim().min(2, 'Qualification is required').max(80),
  specialization: z.string().trim().max(80).default(''),
  basicSalary: z.coerce.number({ invalid_type_error: 'Enter an amount' }).int('Use whole rupees').min(10000, 'Minimum ₹10,000').max(500000, 'Maximum ₹5,00,000'),
  bankAccount: z.string().trim().regex(/^\d{9,18}$/, '9–18 digit account number'),
}).superRefine((v, ctx) => {
  const t = new Date();
  const dob = new Date(v.dateOfBirth);
  const age = (t.getTime() - dob.getTime()) / (365.25 * 86400000);
  if (age < 18 || age > 80) ctx.addIssue({ code: 'custom', path: ['dateOfBirth'], message: 'Employee must be between 18 and 80 years old' });
  if (v.joiningDate <= v.dateOfBirth) ctx.addIssue({ code: 'custom', path: ['joiningDate'], message: 'Joining date must be after date of birth' });
  const maxJoin = new Date(t.getTime() + 180 * 86400000).toISOString().slice(0, 10);
  if (v.joiningDate > maxJoin) ctx.addIssue({ code: 'custom', path: ['joiningDate'], message: 'Joining date cannot be more than 6 months ahead' });
});
export type EmployeeInput = z.infer<typeof employeeSchema>;

export const selfProfileSchema = z.object({
  phone: z.string().trim().regex(phoneRe, 'Enter a valid phone number'),
  address: z.string().trim().max(200),
  emergencyContact: z.string().trim().max(120),
});
export type SelfProfileInput = z.infer<typeof selfProfileSchema>;

export const departmentSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z]{2,6}$/, '2–6 letters, e.g. CSE'),
  name: z.string().trim().min(3, 'Department name is required').max(80),
  headId: z.string().nullable(),
  description: z.string().trim().max(240).default(''),
});
export type DepartmentInput = z.infer<typeof departmentSchema>;

export const designationSchema = z.object({
  title: z.string().trim().min(3, 'Title is required').max(60),
  category: z.enum(['faculty', 'administrative']),
  grade: z.coerce.number().int().min(1, '1–9').max(9, '1–9'),
});
export type DesignationInput = z.infer<typeof designationSchema>;

export const leaveSchema = z
  .object({
    type: z.enum(LEAVE_TYPES.map((l) => l.value) as [string, ...string[]]),
    startDate: z.string().regex(dateRe, 'Select a start date'),
    endDate: z.string().regex(dateRe, 'Select an end date'),
    reason: z.string().trim().min(5, 'Please give a short reason (min 5 characters)').max(500),
  })
  .refine((v) => v.endDate >= v.startDate, { path: ['endDate'], message: 'End date must be on or after start date' })
  .refine((v) => v.startDate.slice(0, 4) === v.endDate.slice(0, 4), { path: ['endDate'], message: 'Leave cannot span two calendar years — submit two requests' });
export type LeaveInput = z.infer<typeof leaveSchema>;

const money = z.coerce.number({ invalid_type_error: 'Enter an amount' }).int('Whole rupees').min(0, 'Cannot be negative');
export const payrollSchema = z.object({
  basic: money.min(1, 'Required'),
  hra: money,
  da: money,
  otherAllowances: money,
  pf: money,
  tax: money,
  otherDeductions: money,
});
export type PayrollInput = z.infer<typeof payrollSchema>;

export const jobSchema = z.object({
  title: z.string().trim().min(4, 'Job title is required').max(100),
  departmentId: z.string().min(1, 'Select a department'),
  designationId: z.string().min(1, 'Select a designation'),
  employmentType: z.enum(EMPLOYMENT_TYPES as [string, ...string[]]),
  positions: z.coerce.number().int().min(1, 'At least 1').max(20, 'Max 20'),
  closingDate: z.string().regex(dateRe, 'Select a closing date'),
  description: z.string().trim().min(10, 'Add a short description').max(1000),
});
export type JobInput = z.infer<typeof jobSchema>;

export const candidateSchema = z.object({
  name: z.string().trim().min(3, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  phone: z.string().trim().regex(phoneRe, 'Enter a valid phone number'),
  jobId: z.string().min(1, 'Select a job opening'),
  experienceYears: z.coerce.number().min(0).max(45),
  qualification: z.string().trim().min(2, 'Required').max(80),
});
export type CandidateInput = z.infer<typeof candidateSchema>;

export const announcementSchema = z.object({
  title: z.string().trim().min(4, 'Title is required').max(100),
  body: z.string().trim().min(10, 'Add some details').max(600),
  category: z.enum(['Event', 'Notice', 'Holiday', 'Academic']),
  date: z.string().regex(dateRe, 'Select a date'),
});
export type AnnouncementInput = z.infer<typeof announcementSchema>;

export const reviewCreateSchema = z.object({
  employeeId: z.string().min(1, 'Select an employee'),
  cycle: z.string().trim().min(4, 'Cycle name is required').max(60),
  goals: z.array(z.object({ title: z.string().trim().min(3, 'Goal title is required').max(120), weight: z.coerce.number().int().min(5).max(100) })).min(1, 'Add at least one goal').max(6),
}).refine((v) => v.goals.reduce((a, g) => a + g.weight, 0) === 100, { path: ['goals'], message: 'Goal weights must add up to 100%' });
export type ReviewCreateInput = z.infer<typeof reviewCreateSchema>;

export function firstError(err: z.ZodError) {
  const i = err.issues[0];
  return i ? `${i.path.length ? `${i.path.join('.')}: ` : ''}${i.message}` : 'Invalid input';
}
