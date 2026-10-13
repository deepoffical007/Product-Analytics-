-- Integrity + row-level-security checks for 0001_cems_schema.sql.
-- Run against a scratch database after supabase_auth_stub.sql and the migration:
--   psql -d cems_test -f supabase/tests/supabase_auth_stub.sql -f supabase/migrations/0001_cems_schema.sql
--   psql -d cems_test -f supabase/tests/rls_and_integrity_checks.sql
-- Lines marked "should be an ERROR" must fail; the echoed results document expected access.
\set ON_ERROR_STOP 0
\set QUIET 1
-- fixtures (as superuser, bypassing RLS)
insert into designations (id,title,category,grade) values ('00000000-0000-0000-0000-0000000000d1','Assistant Professor','faculty',4),('00000000-0000-0000-0000-0000000000d2','HR Manager','administrative',3);
insert into departments (id,code,name) values ('00000000-0000-0000-0000-0000000000a1','CSE','Computer Science'),('00000000-0000-0000-0000-0000000000a2','HRD','Human Resources'),('00000000-0000-0000-0000-0000000000a3','LIB','Library');
insert into employees (id,first_name,last_name,email,phone,gender,date_of_birth,department_id,designation_id,joining_date,status,qualification,basic_salary,bank_account) values
 ('NIT-1002','Ananya','Kapoor','hr@x.in','+91 98765 43210','Female','1985-01-01','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000d2','2016-03-14','Active','MBA',94000,'123456789012'),
 ('NIT-1003','Vikram','Sethi','head@x.in','+91 98765 43211','Male','1975-01-01','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','2013-08-01','Active','PhD',150000,'123456789013'),
 ('NIT-1004','Priya','Nair','priya@x.in','+91 98765 43212','Female','1990-01-01','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','2021-07-15','Active','PhD',75000,'123456789014'),
 ('NIT-1005','Rohan','Das','rohan@x.in','+91 98765 43213','Male','1991-01-01','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','2021-07-15','Active','PhD',72000,'123456789015');
update departments set head_id='NIT-1003' where code='CSE';
update employees set reporting_manager_id='NIT-1003' where id in ('NIT-1004','NIT-1005');
insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222'),('33333333-3333-3333-3333-333333333333');
insert into users (id,name,email,role,employee_id) values ('11111111-1111-1111-1111-111111111111','HR','hr@x.in','hr','NIT-1002'),('22222222-2222-2222-2222-222222222222','Head','head@x.in','employee','NIT-1003'),('33333333-3333-3333-3333-333333333333','Priya','priya@x.in','employee','NIT-1004');
insert into payroll_records (employee_id,period,basic,hra,da,other_allowances,pf,tax,other_deductions,net,status,paid_on) values
 ('NIT-1004','2026-09',75000,15000,9000,2500,9000,10150,200,82150,'Paid','2026-09-30'),('NIT-1005','2026-09',72000,14400,8640,2500,8640,9754,200,78946,'Paid','2026-09-30'),('NIT-1004','2026-10',75000,15000,9000,2500,9000,10150,200,82150,'Pending',null);

\echo '--- integrity: each line below should be an ERROR ---'
insert into attendance_records (employee_id,date,status,check_in) values ('NIT-1004','2026-10-12','present','09:00');
insert into attendance_records (employee_id,date,status,check_in) values ('NIT-1004','2026-10-12','late','09:40');
insert into payroll_records (employee_id,period,basic,hra,da,other_allowances,pf,tax,other_deductions,net) values ('NIT-1005','2026-10',1000,0,0,0,0,0,0,999);
update payroll_records set basic=1 where employee_id='NIT-1004' and period='2026-09';
update departments set status='inactive' where code='CSE';
insert into employees (id,first_name,last_name,email,phone,gender,date_of_birth,department_id,designation_id,joining_date,qualification,basic_salary,bank_account) values ('NIT-1099','Dup','Email','PRIYA@x.in','+91 98765 43299','Female','1990-01-01','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000d1','2021-07-15','PhD',75000,'123456789099');
\echo '--- leave workflow ---'
insert into leave_requests (reference,employee_id,leave_type,start_date,end_date,days,reason) values ('LR-1','NIT-1004','casual','2026-11-02','2026-11-03',2,'Family function');
insert into leave_requests (reference,employee_id,leave_type,start_date,end_date,days,reason) values ('LR-2','NIT-1004','sick','2026-11-03','2026-11-03',1,'Overlapping request');
update leave_requests set status='approved', reviewed_by='22222222-2222-2222-2222-222222222222', reviewed_at=now() where reference='LR-1';
select 'balance used after approve = ' || used from leave_balances where employee_id='NIT-1004' and leave_type='casual';
update leave_requests set reason='edited after approval', status='approved' where reference='LR-1';
update leave_requests set status='rejected', reviewed_by='22222222-2222-2222-2222-222222222222', reviewed_at=now(), review_comment='x' where reference='LR-1';
select 'balance used after re-save = ' || used from leave_balances where employee_id='NIT-1004' and leave_type='casual';
insert into leave_requests (reference,employee_id,leave_type,start_date,end_date,days,reason,status,reviewed_by,reviewed_at) values ('LR-3','NIT-1004','other','2026-12-01','2026-12-09',7,'Over balance','approved','11111111-1111-1111-1111-111111111111',now());

\echo '--- RLS as Priya (employee) ---'
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select 'employees visible: ' || string_agg(id, ',' order by id) from employees;
select 'payroll rows visible: ' || count(*) || ' (own, finalised only: ' || string_agg(employee_id||'/'||period, ',') || ')' from payroll_records;
update payroll_records set tax = 0 where employee_id='NIT-1004';
select 'payroll update affected rows: ' || count(*) from payroll_records where tax = 0;
insert into leave_requests (reference,employee_id,leave_type,start_date,end_date,days,reason) values ('LR-4','NIT-1005','casual','2026-11-20','2026-11-20',1,'Applying for someone else');
insert into leave_requests (reference,employee_id,leave_type,start_date,end_date,days,reason) values ('LR-5','NIT-1004','casual','2026-11-20','2026-11-20',1,'My own request');
update leave_requests set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where reference='LR-5';
select 'LR-5 status after self-approve attempt: ' || status from leave_requests where reference='LR-5';
reset role;
\echo '--- RLS as Vikram (dept head) ---'
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select 'employees visible: ' || string_agg(id, ',' order by id) from employees;
select 'payroll rows visible: ' || count(*) from payroll_records;
update leave_requests set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where reference='LR-5';
reset role;
select 'LR-5 after head approval: ' || status || ', casual used = ' || (select used from leave_balances where employee_id='NIT-1004' and leave_type='casual' and year=2026) from leave_requests where reference='LR-5';
\echo '--- RLS as HR ---'
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select 'employees visible: ' || count(*) || ', payroll visible: ' || (select count(*) from payroll_records) from employees;
update audit_logs set summary='tamper';
reset role;
\echo '--- reviews ---'
insert into performance_reviews (id, employee_id, cycle, reviewer_id, goals) values ('00000000-0000-0000-0000-0000000000f1','NIT-1004','Mid-Year 2026','NIT-1003','[{"id":"g0","title":"Publish","weight":100,"progress":0}]');
set role authenticated; set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
insert into performance_reviews (employee_id, cycle, reviewer_id) values ('NIT-1005','Forged by Priya','NIT-1004');
update performance_reviews set overall_rating = 5 where employee_id='NIT-1004';
select submit_self_assessment('00000000-0000-0000-0000-0000000000f1', 'I published one paper and mentored four projects.', '[{"id":"g0","progress":60}]');
reset role;
select 'review after self-assessment: ' || status || ', progress=' || (goals->0->>'progress') || ', rating=' || coalesce(overall_rating::text,'null') from performance_reviews where cycle='Mid-Year 2026';
select 'forged reviews in table: ' || count(*) from performance_reviews where cycle = 'Forged by Priya';
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
insert into performance_reviews (employee_id, cycle, reviewer_id) values ('NIT-1005','Annual 2026','NIT-1003');
update performance_reviews set reviewer_id = 'NIT-1004' where employee_id = 'NIT-1005' and cycle = 'Annual 2026';
reset role;
select 'head-created review reviewer: ' || reviewer_id from performance_reviews where cycle = 'Annual 2026';
