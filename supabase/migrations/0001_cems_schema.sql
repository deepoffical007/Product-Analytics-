-- =============================================================================
-- College Employee Management System (CEMS) — PostgreSQL / Supabase schema
-- =============================================================================
-- Mirrors the demo data model in src/data/types.ts. Run in the Supabase SQL
-- editor or with `supabase db push`. Server-side rules (constraints, triggers
-- and row-level security) enforce what the demo enforces in src/data/services.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Enumerations
-- ---------------------------------------------------------------------------
create type app_role          as enum ('super_admin', 'hr', 'employee');
create type staff_category    as enum ('faculty', 'administrative');
create type record_status     as enum ('active', 'inactive');
create type employment_type   as enum ('Full-time', 'Part-time', 'Contract', 'Visiting');
create type employment_status as enum ('Active', 'Probation', 'Inactive', 'Resigned');
create type attendance_status as enum ('present', 'absent', 'late', 'on_leave');
create type attendance_source as enum ('register', 'leave');
create type leave_type        as enum ('casual', 'sick', 'earned', 'academic', 'other');
create type leave_status      as enum ('pending', 'approved', 'rejected', 'cancelled');
create type payroll_status    as enum ('Pending', 'Processed', 'Paid', 'On Hold');
create type review_status     as enum ('Not Started', 'Self Assessment', 'Manager Review', 'Completed');
create type job_status        as enum ('Open', 'On Hold', 'Closed');
create type candidate_stage   as enum ('Applied', 'Shortlisted', 'Interview', 'Selected', 'Offered', 'Joined', 'Rejected');
create type offer_status      as enum ('None', 'Extended', 'Accepted', 'Declined');
create type document_status   as enum ('Verified', 'Pending', 'Missing');

-- ---------------------------------------------------------------------------
-- Organisation
-- ---------------------------------------------------------------------------
create table departments (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z]{2,6}$'),
  name        text not null unique check (length(name) between 3 and 80),
  head_id     text,                         -- FK added after employees exists
  status      record_status not null default 'active',
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table designations (
  id       uuid primary key default gen_random_uuid(),
  title    text not null unique check (length(title) between 3 and 60),
  category staff_category not null,
  grade    smallint not null check (grade between 1 and 9),
  status   record_status not null default 'active'
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table employees (
  id                   text primary key check (id ~ '^[A-Z]{2,5}-[0-9]{3,6}$'),
  first_name           text not null check (length(first_name) between 2 and 40),
  last_name            text not null check (length(last_name) between 1 and 40),
  email                text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                text not null check (phone ~ '^\+?[0-9][0-9 -]{7,16}$'),
  gender               text not null check (gender in ('Female', 'Male', 'Other')),
  date_of_birth        date not null,
  address              text not null default '',
  emergency_contact    text not null default '',
  department_id        uuid not null references departments(id) on update cascade,
  designation_id       uuid not null references designations(id),
  employment_type      employment_type not null default 'Full-time',
  joining_date         date not null,
  exit_date            date,
  reporting_manager_id text references employees(id) on delete set null,
  status               employment_status not null default 'Probation',
  qualification        text not null,
  specialization       text not null default '',
  basic_salary         integer not null check (basic_salary between 10000 and 500000),
  bank_account         text not null check (bank_account ~ '^[0-9]{9,18}$'),
  avatar_color         text not null default '#4f46e5',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint employees_age_check      check (date_of_birth <= joining_date - interval '18 years'),
  constraint employees_exit_after_join check (exit_date is null or exit_date >= joining_date),
  constraint employees_not_self_manager check (reporting_manager_id is distinct from id),
  constraint employees_resigned_has_exit check (status <> 'Resigned' or exit_date is not null)
);
create unique index employees_email_key on employees (lower(email));
create index employees_department_idx on employees (department_id);
create index employees_designation_idx on employees (designation_id);
create index employees_manager_idx on employees (reporting_manager_id);
create index employees_status_idx on employees (status);

alter table departments
  add constraint departments_head_fk foreign key (head_id) references employees(id) on delete set null;
create unique index departments_one_active_head on departments (head_id) where head_id is not null and status = 'active';

create table employee_documents (
  id          uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(id) on delete cascade,
  name        text not null,
  doc_type    text not null check (doc_type in ('Identity', 'Academic', 'Employment', 'Other')),
  status      document_status not null default 'Pending',
  storage_path text,                       -- Supabase Storage object path
  uploaded_at date,
  unique (employee_id, name)
);

-- Application users map Supabase Auth identities to roles and employees.
create table users (
  id           uuid primary key references auth.users(id) on delete cascade,
  name         text not null,
  email        text not null unique,
  role         app_role not null default 'employee',
  employee_id  text unique references employees(id) on delete restrict,
  active       boolean not null default true,
  last_login_at timestamptz
);

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
create table attendance_records (
  id          uuid primary key default gen_random_uuid(),
  employee_id text not null references employees(id) on delete cascade,
  date        date not null check (date <= current_date),
  status      attendance_status not null,
  check_in    time,
  source      attendance_source not null default 'register',
  marked_by   uuid references users(id) on delete set null,
  updated_at  timestamptz not null default now(),
  -- One record per employee per day: duplicates are impossible.
  constraint attendance_unique_day unique (employee_id, date),
  constraint attendance_weekday check (extract(isodow from date) < 6),
  constraint attendance_checkin_status check (status in ('present', 'late') or check_in is null),
  constraint attendance_leave_source check ((status = 'on_leave') = (source = 'leave'))
);
create index attendance_date_idx on attendance_records (date);
create index attendance_employee_date_idx on attendance_records (employee_id, date desc);

create table holidays (
  date date primary key,
  name text not null
);

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------
create table leave_policy (
  leave_type    leave_type primary key,
  days_per_year smallint not null check (days_per_year between 0 and 60)
);

create table leave_requests (
  id             uuid primary key default gen_random_uuid(),
  reference      text not null unique,     -- human friendly, e.g. LR-0191
  employee_id    text not null references employees(id) on delete cascade,
  leave_type     leave_type not null,
  start_date     date not null,
  end_date       date not null,
  days           smallint not null check (days > 0),
  reason         text not null check (length(reason) between 5 and 500),
  status         leave_status not null default 'pending',
  applied_at     timestamptz not null default now(),
  reviewed_by    uuid references users(id) on delete set null,
  reviewed_at    timestamptz,
  review_comment text,
  constraint leave_dates_order check (end_date >= start_date),
  constraint leave_same_year check (extract(year from start_date) = extract(year from end_date)),
  constraint leave_review_fields check ((status in ('approved', 'rejected')) = (reviewed_by is not null and reviewed_at is not null)),
  constraint leave_rejection_comment check (status <> 'rejected' or length(coalesce(review_comment, '')) >= 3),
  -- No overlapping pending/approved requests for the same employee.
  constraint leave_no_overlap exclude using gist (
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('pending', 'approved'))
);
create index leave_employee_idx on leave_requests (employee_id, start_date desc);
create index leave_status_idx on leave_requests (status);
create index leave_dates_idx on leave_requests using gist (daterange(start_date, end_date, '[]'));

create table leave_balances (
  employee_id text not null references employees(id) on delete cascade,
  year        smallint not null,
  leave_type  leave_type not null,
  allocated   smallint not null check (allocated >= 0),
  used        smallint not null default 0 check (used >= 0),
  primary key (employee_id, year, leave_type),
  constraint leave_balance_not_exceeded check (used <= allocated)
);

-- ---------------------------------------------------------------------------
-- Payroll (demo structure — connect a verified payroll engine for production)
-- ---------------------------------------------------------------------------
create table payroll_records (
  id               uuid primary key default gen_random_uuid(),
  employee_id      text not null references employees(id) on delete cascade,
  period           char(7) not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  basic            integer not null check (basic > 0),
  hra              integer not null check (hra >= 0),
  da               integer not null check (da >= 0),
  other_allowances integer not null check (other_allowances >= 0),
  pf               integer not null check (pf >= 0),
  tax              integer not null check (tax >= 0),
  other_deductions integer not null check (other_deductions >= 0),
  net              integer not null,
  status           payroll_status not null default 'Pending',
  paid_on          date,
  updated_at       timestamptz not null default now(),
  constraint payroll_unique_period unique (employee_id, period),
  constraint payroll_net_matches check (net = basic + hra + da + other_allowances - pf - tax - other_deductions),
  constraint payroll_net_non_negative check (net >= 0),
  constraint payroll_paid_date check ((status = 'Paid') = (paid_on is not null))
);
create index payroll_period_idx on payroll_records (period);

-- ---------------------------------------------------------------------------
-- Performance
-- ---------------------------------------------------------------------------
create table performance_reviews (
  id                uuid primary key default gen_random_uuid(),
  employee_id       text not null references employees(id) on delete cascade,
  cycle             text not null,
  reviewer_id       text references employees(id) on delete set null,
  status            review_status not null default 'Not Started',
  goals             jsonb not null default '[]'::jsonb,   -- [{id,title,weight,progress}]
  rating_teaching   numeric(2,1) check (rating_teaching between 1 and 5),
  rating_research   numeric(2,1) check (rating_research between 1 and 5),
  rating_service    numeric(2,1) check (rating_service between 1 and 5),
  rating_professionalism numeric(2,1) check (rating_professionalism between 1 and 5),
  overall_rating    numeric(2,1) check (overall_rating between 1 and 5),
  manager_feedback  text not null default '',
  self_assessment   text not null default '',
  training_needs    text[] not null default '{}',
  updated_at        timestamptz not null default now(),
  completed_at      timestamptz,
  constraint review_unique_cycle unique (employee_id, cycle),
  constraint review_completed check ((status = 'Completed') = (completed_at is not null)),
  constraint review_not_self check (reviewer_id is distinct from employee_id)
);
create index reviews_reviewer_idx on performance_reviews (reviewer_id);

-- ---------------------------------------------------------------------------
-- Recruitment & onboarding
-- ---------------------------------------------------------------------------
create table job_openings (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique,
  title           text not null,
  department_id   uuid not null references departments(id),
  designation_id  uuid not null references designations(id),
  employment_type employment_type not null,
  positions       smallint not null check (positions between 1 and 20),
  status          job_status not null default 'Open',
  posted_on       date not null default current_date,
  closing_date    date not null,
  description     text not null,
  constraint job_closing_after_post check (closing_date >= posted_on)
);

create table candidates (
  id                  uuid primary key default gen_random_uuid(),
  reference           text not null unique,
  name                text not null,
  email               text not null,
  phone               text not null,
  job_id              uuid not null references job_openings(id) on delete cascade,
  stage               candidate_stage not null default 'Applied',
  applied_on          date not null default current_date,
  experience_years    numeric(4,1) not null default 0 check (experience_years between 0 and 45),
  qualification       text not null,
  interview_at        timestamptz,
  interview_panel     text not null default '',
  offer_status        offer_status not null default 'None',
  notes               text not null default '',
  onboarding          jsonb not null default '[]'::jsonb,
  documents_submitted jsonb not null default '[]'::jsonb,
  employee_id         text references employees(id) on delete set null,
  constraint candidate_unique_application unique (job_id, email),
  constraint candidate_joined_has_employee check (stage <> 'Joined' or employee_id is not null)
);
create index candidates_job_stage_idx on candidates (job_id, stage);

-- ---------------------------------------------------------------------------
-- Notifications, announcements & audit
-- ---------------------------------------------------------------------------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  title      text not null,
  message    text not null,
  kind       text not null check (kind in ('leave','employee','attendance','payroll','anniversary','recruitment','performance','system')),
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_user_unread_idx on notifications (user_id, read, created_at desc);

create table announcements (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  category   text not null check (category in ('Event','Notice','Holiday','Academic')),
  date       date not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor_id   uuid references users(id) on delete set null,
  actor_name text not null,
  actor_role app_role not null,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  summary    text not null,
  changes    jsonb
);
create index audit_at_idx on audit_logs (at desc);
create index audit_entity_idx on audit_logs (entity, entity_id);

-- =============================================================================
-- Helper functions (SECURITY DEFINER so RLS policies can call them safely)
-- =============================================================================
create or replace function current_app_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from users where id = auth.uid() and active
$$;

create or replace function current_employee_id() returns text
language sql stable security definer set search_path = public as $$
  select employee_id from users where id = auth.uid() and active
$$;

create or replace function is_admin_or_hr() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(current_app_role() in ('super_admin', 'hr'), false)
$$;

-- True when the signed-in user manages the employee (reporting line or department head).
create or replace function manages_employee(target text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employees e
    left join departments d on d.id = e.department_id and d.status = 'active'
    where e.id = target
      and e.id <> current_employee_id()
      and (e.reporting_manager_id = current_employee_id() or d.head_id = current_employee_id())
  )
$$;

-- =============================================================================
-- Integrity triggers
-- =============================================================================
create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

create trigger employees_touch before update on employees for each row execute function touch_updated_at();
create trigger payroll_touch before update on payroll_records for each row execute function touch_updated_at();
create trigger reviews_touch before update on performance_reviews for each row execute function touch_updated_at();

-- Departments with active employees cannot be deactivated.
create or replace function guard_department_deactivation() returns trigger language plpgsql as $$
begin
  if new.status = 'inactive' and old.status = 'active' and exists (
    select 1 from employees where department_id = new.id and status in ('Active', 'Probation')
  ) then
    raise exception 'Department % still has active employees. Move them before deactivating.', new.name
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger departments_guard before update on departments for each row execute function guard_department_deactivation();

-- Paid payroll is immutable.
create or replace function guard_paid_payroll() returns trigger language plpgsql as $$
begin
  if old.status = 'Paid' then
    raise exception 'Paid payroll records are locked.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger payroll_guard before update on payroll_records for each row execute function guard_paid_payroll();

-- A leave request is reviewed exactly once; balances are *derived* from approved
-- requests so re-saving or editing can never deduct twice.
-- A request leaves 'pending' exactly once; reviewed requests are frozen.
create or replace function guard_leave_transition() returns trigger language plpgsql as $$
begin
  if old.status <> 'pending' and (new.status <> old.status or new.start_date <> old.start_date
     or new.end_date <> old.end_date or new.days <> old.days or new.leave_type <> old.leave_type) then
    raise exception 'Leave request % has already been % and can no longer change.', old.reference, old.status
      using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger leave_requests_guard before update on leave_requests for each row execute function guard_leave_transition();

create or replace function sync_leave_balance() returns trigger language plpgsql security definer set search_path = public as $$
declare
  yr smallint := extract(year from new.start_date);
begin

  insert into leave_balances (employee_id, year, leave_type, allocated, used)
  select new.employee_id, yr, new.leave_type, p.days_per_year, 0 from leave_policy p where p.leave_type = new.leave_type
  on conflict do nothing;

  update leave_balances b
     set used = coalesce((
       select sum(r.days) from leave_requests r
        where r.employee_id = new.employee_id and r.leave_type = new.leave_type
          and r.status = 'approved' and extract(year from r.start_date) = yr), 0)
   where b.employee_id = new.employee_id and b.year = yr and b.leave_type = new.leave_type;
  -- leave_balance_not_exceeded raises if the approval would overdraw the balance.

  if new.status = 'approved' then
    insert into attendance_records (employee_id, date, status, source, marked_by)
    select new.employee_id, d::date, 'on_leave', 'leave', new.reviewed_by
      from generate_series(new.start_date, least(new.end_date, current_date), interval '1 day') d
     where extract(isodow from d) < 6 and not exists (select 1 from holidays h where h.date = d::date)
    on conflict (employee_id, date) do update set status = 'on_leave', source = 'leave', check_in = null, updated_at = now();
  end if;
  return new;
end $$;
create trigger leave_requests_balance after insert or update on leave_requests for each row execute function sync_leave_balance();

-- =============================================================================
-- Row-level security
-- =============================================================================
alter table departments          enable row level security;
alter table designations         enable row level security;
alter table employees            enable row level security;
alter table employee_documents   enable row level security;
alter table users                enable row level security;
alter table attendance_records   enable row level security;
alter table holidays             enable row level security;
alter table leave_policy         enable row level security;
alter table leave_requests       enable row level security;
alter table leave_balances       enable row level security;
alter table payroll_records      enable row level security;
alter table performance_reviews  enable row level security;
alter table job_openings         enable row level security;
alter table candidates           enable row level security;
alter table notifications        enable row level security;
alter table announcements        enable row level security;
alter table audit_logs           enable row level security;

-- Reference data: readable by every signed-in user, managed by Super Admins.
create policy ref_read_departments  on departments  for select to authenticated using (true);
create policy ref_write_departments on departments  for all    to authenticated using (current_app_role() = 'super_admin') with check (current_app_role() = 'super_admin');
create policy ref_read_designations  on designations for select to authenticated using (true);
create policy ref_write_designations on designations for all    to authenticated using (current_app_role() = 'super_admin') with check (current_app_role() = 'super_admin');
create policy ref_read_holidays  on holidays     for select to authenticated using (true);
create policy ref_write_holidays on holidays     for all    to authenticated using (current_app_role() = 'super_admin') with check (current_app_role() = 'super_admin');
create policy ref_read_policy  on leave_policy for select to authenticated using (true);
create policy ref_write_policy on leave_policy for all    to authenticated using (current_app_role() = 'super_admin') with check (current_app_role() = 'super_admin');

-- Employees: HR/admin see all; employees see themselves; managers see their team.
-- Expose salary/bank columns only through the employees table to these roles —
-- for broader directory views create a SECURITY BARRIER view without them.
create policy employees_select on employees for select to authenticated
  using (is_admin_or_hr() or id = current_employee_id() or manages_employee(id));
create policy employees_insert on employees for insert to authenticated with check (is_admin_or_hr());
create policy employees_update on employees for update to authenticated using (is_admin_or_hr()) with check (
  is_admin_or_hr() and (current_app_role() = 'super_admin' or status in ('Active', 'Probation'))
);
create policy employees_delete on employees for delete to authenticated using (current_app_role() = 'super_admin');

-- Self-service contact updates go through this function (column-level guard).
create or replace function update_own_contact(p_phone text, p_address text, p_emergency text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update employees set phone = p_phone, address = p_address, emergency_contact = p_emergency
   where id = current_employee_id();
end $$;

create policy documents_select on employee_documents for select to authenticated
  using (is_admin_or_hr() or employee_id = current_employee_id());
create policy documents_write on employee_documents for all to authenticated using (is_admin_or_hr()) with check (is_admin_or_hr());

create policy users_select on users for select to authenticated using (id = auth.uid() or is_admin_or_hr());
create policy users_admin  on users for all    to authenticated using (current_app_role() = 'super_admin') with check (current_app_role() = 'super_admin');

create policy attendance_select on attendance_records for select to authenticated
  using (is_admin_or_hr() or employee_id = current_employee_id() or manages_employee(employee_id));
create policy attendance_write on attendance_records for all to authenticated
  using (is_admin_or_hr()) with check (is_admin_or_hr() and source = 'register');

create policy leave_select on leave_requests for select to authenticated
  using (is_admin_or_hr() or employee_id = current_employee_id() or manages_employee(employee_id));
create policy leave_apply on leave_requests for insert to authenticated
  with check (employee_id = current_employee_id() and status = 'pending' and reviewed_by is null);
-- Employees may edit or cancel only their own *pending* requests.
create policy leave_own_update on leave_requests for update to authenticated
  using (employee_id = current_employee_id() and status = 'pending')
  with check (employee_id = current_employee_id() and status in ('pending', 'cancelled') and reviewed_by is null);
-- Reviewers: HR/admin or the employee's manager, never on their own request.
-- NB: permissive policies OR their USING and WITH CHECK clauses *independently*,
-- so every WITH CHECK repeats the full authorisation condition. Otherwise an
-- employee could pass leave_own_update's USING and this policy's WITH CHECK
-- and approve their own request.
create policy leave_review on leave_requests for update to authenticated
  using (status = 'pending' and employee_id <> current_employee_id() and (is_admin_or_hr() or manages_employee(employee_id)))
  with check (status in ('approved', 'rejected') and reviewed_by = auth.uid()
              and employee_id <> current_employee_id() and (is_admin_or_hr() or manages_employee(employee_id)));

create policy balances_select on leave_balances for select to authenticated
  using (is_admin_or_hr() or employee_id = current_employee_id() or manages_employee(employee_id));

-- Payroll: employees only ever see their own finalised payslips.
create policy payroll_select on payroll_records for select to authenticated
  using (is_admin_or_hr() or (employee_id = current_employee_id() and status in ('Paid', 'Processed')));
create policy payroll_write on payroll_records for all to authenticated using (is_admin_or_hr()) with check (is_admin_or_hr());

create policy reviews_select on performance_reviews for select to authenticated
  using (is_admin_or_hr() or employee_id = current_employee_id() or reviewer_id = current_employee_id() or manages_employee(employee_id));
-- Creating a review requires real authority over the employee: reviewer_id is
-- client-supplied, so it must never grant insert rights on its own.
create policy reviews_insert on performance_reviews for insert to authenticated
  with check (employee_id <> current_employee_id() and (is_admin_or_hr() or manages_employee(employee_id)));
-- The assigned reviewer may update, but cannot reassign the review to anyone else.
create policy reviews_update on performance_reviews for update to authenticated
  using (employee_id <> current_employee_id() and (is_admin_or_hr() or reviewer_id = current_employee_id() or manages_employee(employee_id)))
  with check (employee_id <> current_employee_id() and (is_admin_or_hr() or manages_employee(employee_id) or reviewer_id = current_employee_id()));
create policy reviews_delete on performance_reviews for delete to authenticated using (is_admin_or_hr());

create or replace function guard_reviewer_change() returns trigger language plpgsql as $$
begin
  if new.reviewer_id is distinct from old.reviewer_id and not is_admin_or_hr() then
    raise exception 'Only HR or a Super Admin can reassign a reviewer.' using errcode = 'insufficient_privilege';
  end if;
  if new.employee_id <> old.employee_id then
    raise exception 'A review cannot be moved to another employee.' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger reviews_reviewer_guard before update on performance_reviews for each row execute function guard_reviewer_change();

-- Employees cannot update their own review rows; the self-assessment goes
-- through this function, which can only touch the self-assessment and goal progress.
create or replace function submit_self_assessment(p_review uuid, p_text text, p_goals jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if length(coalesce(p_text, '')) < 20 then
    raise exception 'Self-assessment should be at least 20 characters.' using errcode = 'check_violation';
  end if;
  update performance_reviews r
     set self_assessment = p_text,
         goals = (
           select coalesce(jsonb_agg(
                    g || jsonb_build_object('progress', least(100, greatest(0, coalesce(
                      (select (x->>'progress')::int from jsonb_array_elements(p_goals) x where x->>'id' = g->>'id'),
                      (g->>'progress')::int))))
                  ), '[]'::jsonb)
             from jsonb_array_elements(r.goals) g),
         status = 'Manager Review'
   where r.id = p_review and r.employee_id = current_employee_id() and r.status in ('Not Started', 'Self Assessment');
  if not found then
    raise exception 'Review not found or no longer open for self-assessment.' using errcode = 'insufficient_privilege';
  end if;
end $$;

create policy jobs_select on job_openings for select to authenticated using (true);
create policy jobs_write  on job_openings for all    to authenticated using (is_admin_or_hr()) with check (is_admin_or_hr());
create policy candidates_all on candidates for all to authenticated using (is_admin_or_hr()) with check (is_admin_or_hr());

create policy notifications_own on notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_mark on notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on notifications for delete to authenticated using (user_id = auth.uid() and read);

create policy announcements_read  on announcements for select to authenticated using (true);
create policy announcements_write on announcements for all    to authenticated using (is_admin_or_hr()) with check (is_admin_or_hr());

-- Audit log is append-only and readable by HR/admin.
create policy audit_read on audit_logs for select to authenticated using (is_admin_or_hr());
create policy audit_insert on audit_logs for insert to authenticated with check (actor_id = auth.uid());
revoke update, delete on audit_logs from authenticated;

-- ---------------------------------------------------------------------------
-- Seed reference data
-- ---------------------------------------------------------------------------
insert into leave_policy (leave_type, days_per_year) values
  ('casual', 12), ('sick', 10), ('earned', 15), ('academic', 7), ('other', 5)
on conflict do nothing;
