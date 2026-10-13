# CEMS — College Employee Management System

A fully interactive HR suite for a college: faculty and staff records, departments, attendance, leave workflows, payroll, performance reviews, recruitment & onboarding, reports, notifications and an audit trail — with role-based access for **Super Admin**, **HR / Administration** and **Faculty / Employee**.

Sample institution: *Northfield Institute of Technology* (fictional) — 115 employees across 14 departments, ~4 months of attendance, leave history, 7 months of payroll, two review cycles and an active recruitment pipeline.

> **Demo mode.** Without backend credentials the app runs on a clearly labelled demo data layer persisted in browser `localStorage`, with simulated sign-in. This is **not production security** — see [Connecting a production backend](#connecting-a-production-backend).

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Sign in with one click as any demo persona, or with email + password `demo1234`:

| Persona | Role | What to try |
| --- | --- | --- |
| Dr. Meera Raghavan | Super Admin | Everything, incl. departments, user roles, deactivation/deletion, leave policy |
| Ananya Kapoor | HR / Administration | Onboarding, attendance register, leave approvals, payroll runs, reports, CSV exports |
| Dr. Vikram Sethi | Faculty · Head of CSE | Approve team leave, run team performance reviews, team attendance |
| Priya Nair | Faculty / Employee | Personal dashboard, apply/edit/cancel leave, attendance history, own payslips only |

Use **Settings → Data & backend → Reset demo data** (or the link on the sign-in page) to restore the sample data.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check and production build |
| `npm test` | Unit tests for the data/services layer (Vitest) |
| `npm run test:e2e` | End-to-end user journeys (Playwright; starts its own dev server) |

## Feature map

| Route | Highlights |
| --- | --- |
| `/login` | Demo personas, email/password demo sign-in, reset demo data |
| `/dashboard` | Executive KPIs (all computed from records), department distribution, faculty vs admin, monthly attendance trend, leave overview, approvals queue, audit activity, announcements, birthdays & work anniversaries. Personal dashboard for employees |
| `/employees` | Search (name/ID/email), filters (department, designation, category, type, status), sorting, pagination, multi-select bulk actions, CSV export, validated add/edit slide-over, confirm-before-deactivate/delete |
| `/employees/:id` | Tabs: Overview, Personal, Employment, Attendance (calendar), Leave history, Documents (verification status), Performance. Self-service contact edits |
| `/departments` | Departments with head, faculty/admin counts; designations catalogue. Deactivation blocked while active employees remain |
| `/attendance` | Daily register (Present/Late/Absent, check-in times, bulk marking), monthly summary with charts, per-employee calendar, CSV. One record per employee per day |
| `/leave-management` | Apply/edit/cancel, balances, approvals queue with overlap detection, mandatory rejection comments, filters by department/date/status/type |
| `/payroll` | Demo payroll with period selection, run payroll, adjust components (validated maths), bulk status, department expense chart, downloadable/printable payslips, CSV |
| `/performance` | Review cycles, weighted goals, ratings, manager feedback, self-assessment, training needs, completion charts — recorded values only, no inferred labels |
| `/recruitment` | Job openings, drag-and-drop pipeline (Applied → Joined/Rejected), interview schedule, offers, onboarding checklists, “Complete joining” converts a candidate into an employee |
| `/reports` | Headcount, department-wise, attendance, leave utilisation, payroll expenditure, joining & exit trends, review completion — date range + department filters, CSV |
| `/notifications` | Inbox with unread state, mark read/unread, deep links; audit log with field-level change history (HR/Admin) |
| `/settings` | Theme, institution settings, leave policy & holidays, user roles/access, storage & backend status |

Also: collapsible sidebar, mobile drawer, ⌘K / Ctrl+K global search, light/dark/system theme, toasts, skeletons, empty states, tooltips on complex metrics, keyboard focus states, skip link.

## Data integrity rules (enforced in `src/data/services` and mirrored in SQL)

- Unique employee IDs and emails; age, date and salary validation (Zod schemas shared by forms and services).
- Attendance uses a natural key (`employee + date`) — duplicates are impossible; no future dates, weekends or holidays; approved leave locks the day as *On Leave*.
- Leave: no overlapping requests, balance checks, same-year ranges, a request is reviewed exactly once, and **balances are derived from approved requests** so edits/re-saves can never deduct twice.
- Payroll: one record per employee per period, `net = gross − deductions`, paid records are locked.
- Departments/designations with active employees cannot be deactivated; department heads cannot be moved or deactivated before a replacement is assigned.
- Every important change writes an audit entry with timestamp and acting user; salary/bank changes are masked in the log.

## Architecture

```
src/
  data/            types, seed generator, persisted store, Zod schemas, metrics
    services/      the "backend": validation, permissions, audit, notifications
  lib/             permissions (RBAC), dates, CSV, formatting, theme
  auth/            demo auth context + route guards
  components/      UI kit (Radix-based, shadcn-style), data table, layout, charts
  features/        one folder per module/page
supabase/
  migrations/      PostgreSQL schema: tables, FKs, constraints, indexes, triggers, RLS
  tests/           SQL checks for integrity rules and row-level security
e2e/               Playwright user journeys
```

Stack: React 18 + TypeScript, Vite, Tailwind CSS, Radix UI primitives, Lucide, Recharts, React Hook Form + Zod, sonner, cmdk.

## Connecting a production backend

1. Create a Supabase project and apply `supabase/migrations/0001_cems_schema.sql` (`supabase db push`, or the SQL editor). It defines all tables (`users`, `employees`, `departments`, `designations`, `attendance_records`, `leave_requests`, `leave_balances`, `payroll_records`, `performance_reviews`, `job_openings`, `candidates`, `notifications`, `audit_logs`, …) with foreign keys, check/exclusion constraints, indexes, integrity triggers and **row-level security** policies per role.
2. Copy `.env.example` to `.env.local` and fill in the project URL and **anon** key. Never ship the service-role key to the browser.
3. Replace the function bodies in `src/data/services/*` with Supabase queries (the service signatures are already async and return `Result` objects, so pages don't change). Map users to `auth.users` and assign roles in the `users` table.
4. Use Supabase Storage for employee documents, and connect a verified payroll provider before processing real salaries.

The schema and its policies were verified on PostgreSQL 16 with `supabase/tests/rls_and_integrity_checks.sql` (e.g. employees cannot read others' payroll or approve their own leave, reviewers cannot be reassigned by non-HR users, duplicate attendance and overdrawn leave balances are rejected).
