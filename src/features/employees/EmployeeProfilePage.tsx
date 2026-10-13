import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BadgeCheck, Briefcase, Building2, CalendarDays, Clock, FileText, Lock, Mail, MapPin, Pencil, Phone, Target, UserCheck, UserMinus, Users, Wallet } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { AccessDenied } from '@/auth/guards';
import { can, canViewEmployee, isManagerOf } from '@/lib/permissions';
import { formatDate, formatDateTime, today, yearsBetween } from '@/lib/dates';
import { formatCurrency, formatPercent, maskAccount, pluralize } from '@/lib/utils';
import { employeeAttendanceStats } from '@/data/metrics';
import { selfProfileSchema, type SelfProfileInput } from '@/data/schemas';
import { fullName, getBalance, setEmployeesStatus, updateDocumentStatus, updateOwnProfile } from '@/data/services';
import { leaveTypeLabel, LEAVE_TYPES, type AttendanceRecord, type Employee, type EmployeeDocument } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, EmptyState, Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { useConfirm } from '@/components/ui/confirm';
import { DataTable } from '@/components/data-table';
import { MonthCalendar } from '@/features/attendance/MonthCalendar';
import { EmployeeFormSheet } from './EmployeeForm';

function Detail({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      {icon && <span className="mt-0.5 text-muted-foreground [&_svg]:size-4">{icon}</span>}
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{value || '—'}</dd>
      </div>
    </div>
  );
}

function SelfEditDialog({ open, onOpenChange, employee }: { open: boolean; onOpenChange: (o: boolean) => void; employee: Employee }) {
  const { user } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, formState: { errors } } = useForm<SelfProfileInput>({ resolver: zodResolver(selfProfileSchema), values: { phone: employee.phone, address: employee.address, emergencyContact: employee.emergencyContact } });
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => updateOwnProfile(user, v), 'Your contact details were updated');
    if (r.ok) onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Update my contact details" description="You can update these fields yourself. Contact HR to change employment or payroll details." footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>Save</Button></>}>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Phone" htmlFor="self-phone" error={errors.phone?.message} required><Input id="self-phone" {...register('phone')} aria-invalid={!!errors.phone} /></Field>
          <Field label="Address" htmlFor="self-address" error={errors.address?.message}><Input id="self-address" {...register('address')} /></Field>
          <Field label="Emergency contact" htmlFor="self-ec" error={errors.emergencyContact?.message}><Input id="self-ec" {...register('emergencyContact')} /></Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EmployeeProfilePage() {
  const { id = '' } = useParams();
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { run, pending } = useAsyncAction();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const [editOpen, setEditOpen] = useState(false);
  const [selfOpen, setSelfOpen] = useState(false);
  const [calPeriod, setCalPeriod] = useState(today().slice(0, 7));
  const emp = db.employees.find((e) => e.id === id);

  const attendance = useMemo(() => (emp ? employeeAttendanceStats(db, emp.id) : null), [db, emp]);
  const attMap = useMemo(() => new Map((attendance?.records ?? []).map((r) => [r.date, r] as const)), [attendance]);
  const monthRecs = useMemo(() => (attendance?.records ?? []).filter((r) => r.date.startsWith(calPeriod)), [attendance, calPeriod]);

  if (!user) return null;
  if (!emp) return <EmptyState className="mt-16" icon={<Users />} title="Employee not found" description={`No employee with ID ${id}.`} action={<Button onClick={() => navigate(-1)}>Go back</Button>} />;
  if (!canViewEmployee(user, emp, db)) return <AccessDenied message="You can only view your own profile or the profiles of employees who report to you." />;

  const self = user.employeeId === emp.id;
  const sensitive = can(user, 'employees.view_sensitive') || self;
  const manager = isManagerOf(user, emp, db);
  const dept = db.departments.find((d) => d.id === emp.departmentId);
  const des = db.designations.find((d) => d.id === emp.designationId);
  const mgr = db.employees.find((e) => e.id === emp.reportingManagerId);
  const reports = db.employees.filter((e) => e.reportingManagerId === emp.id && (e.status === 'Active' || e.status === 'Probation'));
  const year = Number(today().slice(0, 4));
  const leaves = db.leaveRequests.filter((r) => r.employeeId === emp.id).sort((a, b) => b.startDate.localeCompare(a.startDate));
  const reviews = db.reviews.filter((r) => r.employeeId === emp.id && (can(user, 'performance.view_all') || self || manager));
  const tenure = yearsBetween(emp.joiningDate, today());
  const isHead = db.departments.some((d) => d.headId === emp.id);
  const setTab = (t: string) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });

  const toggleActive = async () => {
    const active = emp.status === 'Active' || emp.status === 'Probation';
    if (active && !(await confirm({ title: `Deactivate ${fullName(emp)}?`, description: 'The employee will be excluded from attendance registers, payroll runs and active headcount until reactivated.', confirmLabel: 'Deactivate', destructive: true }))) return;
    await run('status', () => setEmployeesStatus(user, [emp.id], active ? 'Inactive' : 'Active'), active ? 'Employee deactivated' : 'Employee reactivated');
  };

  const docStatus = async (d: EmployeeDocument, status: EmployeeDocument['status']) => {
    await run(`doc-${d.id}`, () => updateDocumentStatus(user, emp.id, d.id, status), `“${d.name}” marked ${status.toLowerCase()}`);
  };

  const attTone = (r: AttendanceRecord) => r.status;

  return (
    <div>
      <PageHeader
        breadcrumbs={can(user, 'employees.view_all') ? [{ label: 'Home', to: '/dashboard' }, { label: 'Employees', to: '/employees' }, { label: fullName(emp) }] : [{ label: 'Home', to: '/dashboard' }, { label: self ? 'My profile' : fullName(emp) }]}
        title={self ? 'My profile' : 'Employee profile'}
        actions={
          <>
            {self && !can(user, 'employees.edit') && <Button variant="outline" onClick={() => setSelfOpen(true)}><Pencil /> Update contact details</Button>}
            {can(user, 'employees.edit') && <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil /> Edit</Button>}
            {can(user, 'employees.deactivate') && !self && (
              <Button variant={emp.status === 'Active' || emp.status === 'Probation' ? 'outline' : 'default'} className={emp.status === 'Active' || emp.status === 'Probation' ? 'text-destructive' : ''} onClick={toggleActive} loading={pending === 'status'}>
                {emp.status === 'Active' || emp.status === 'Probation' ? <><UserMinus /> Deactivate</> : <><UserCheck /> Reactivate</>}
              </Button>
            )}
          </>
        }
      />

      <Card className="mb-6 overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-[hsl(var(--sidebar))] to-indigo-700/80" />
        <div className="flex flex-col gap-4 px-5 pb-5 sm:flex-row sm:items-end">
          <Avatar name={fullName(emp)} color={emp.avatarColor} size="xl" className="-mt-10 ring-4" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{fullName(emp)}</h2>
              <StatusBadge status={emp.status} />
              {isHead && <Badge tone="primary"><BadgeCheck className="size-3" /> Head of department</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">{des?.title} · {dept?.name} · <span className="tabular">{emp.id}</span></p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <a href={`mailto:${emp.email}`} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"><Mail className="size-4" /> {emp.email}</a>
            <span className="flex items-center gap-1.5 text-muted-foreground"><Phone className="size-4" /> {emp.phone}</span>
          </div>
        </div>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList aria-label="Profile sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="personal">Personal details</TabsTrigger>
          <TabsTrigger value="employment">Employment details</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leave">Leave history</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Summary" />
              <CardContent>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Detail icon={<Building2 />} label="Department" value={dept?.name} />
                  <Detail icon={<Briefcase />} label="Designation" value={`${des?.title} (${des?.category === 'faculty' ? 'Faculty' : 'Administrative'})`} />
                  <Detail icon={<CalendarDays />} label="Joined" value={`${formatDate(emp.joiningDate)} · ${pluralize(Math.max(0, tenure), 'year')}`} />
                  <Detail icon={<Users />} label="Reporting manager" value={mgr ? <Link className="text-primary hover:underline" to={`/employees/${mgr.id}`}>{fullName(mgr)}</Link> : 'None'} />
                  <Detail icon={<FileText />} label="Qualification" value={`${emp.qualification}${emp.specialization ? ` · ${emp.specialization}` : ''}`} />
                  <Detail icon={<Clock />} label="Employment type" value={emp.employmentType} />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="At a glance" />
              <CardContent className="space-y-4">
                <div>
                  <div className="mb-1 flex justify-between text-sm"><span className="text-muted-foreground">Attendance rate</span><span className="tabular font-medium">{formatPercent(attendance?.rate ?? 0)}</span></div>
                  <Progress value={attendance?.rate ?? 0} tone="success" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {LEAVE_TYPES.slice(0, 4).map((l) => {
                    const b = getBalance(db, emp.id, l.value, year);
                    return <div key={l.value} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{l.label}</p><p className="tabular font-semibold">{b.available}<span className="text-xs font-normal text-muted-foreground"> / {b.allocated}</span></p></div>;
                  })}
                </div>
                {reports.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Direct reports ({reports.length})</p>
                    <div className="flex -space-x-2">
                      {reports.slice(0, 8).map((r) => <Link key={r.id} to={`/employees/${r.id}`} title={fullName(r)}><Avatar name={fullName(r)} color={r.avatarColor} size="sm" /></Link>)}
                      {reports.length > 8 && <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs ring-2 ring-card">+{reports.length - 8}</span>}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personal">
          <Card>
            <CardHeader title="Personal details" description={self ? 'You can update your contact details. Other changes go through HR.' : undefined} action={self && <Button size="sm" variant="outline" onClick={() => setSelfOpen(true)}><Pencil /> Update</Button>} />
            <CardContent>
              <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Detail label="Full name" value={fullName(emp)} />
                <Detail label="Gender" value={emp.gender} />
                <Detail label="Date of birth" value={formatDate(emp.dateOfBirth)} />
                <Detail icon={<Mail />} label="Email" value={emp.email} />
                <Detail icon={<Phone />} label="Phone" value={emp.phone} />
                <Detail icon={<MapPin />} label="Address" value={emp.address} />
                <Detail label="Emergency contact" value={emp.emergencyContact} />
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="employment">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Employment details" />
              <CardContent>
                <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Detail label="Employee ID" value={emp.id} />
                  <Detail label="Status" value={<StatusBadge status={emp.status} />} />
                  <Detail label="Department" value={dept?.name} />
                  <Detail label="Designation" value={des?.title} />
                  <Detail label="Employment type" value={emp.employmentType} />
                  <Detail label="Joining date" value={formatDate(emp.joiningDate)} />
                  {emp.exitDate && <Detail label="Exit date" value={formatDate(emp.exitDate)} />}
                  <Detail label="Reporting manager" value={mgr ? fullName(mgr) : 'None'} />
                  <Detail label="Record last updated" value={formatDateTime(emp.updatedAt)} />
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Compensation" description="Confidential" />
              <CardContent>
                {sensitive ? (
                  <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Detail icon={<Wallet />} label="Basic salary (monthly)" value={formatCurrency(emp.basicSalary)} />
                    <Detail label="Bank account" value={maskAccount(emp.bankAccount)} />
                    <div className="sm:col-span-2"><Link to="/payroll" className="text-sm font-medium text-primary hover:underline">{self ? 'View my payslips →' : 'Open payroll →'}</Link></div>
                  </dl>
                ) : (
                  <EmptyState icon={<Lock />} title="Restricted" description="Compensation details are visible only to HR, Super Admins and the employee." className="py-6" />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="pt-5">
                <MonthCalendar period={calPeriod} onPeriodChange={setCalPeriod} records={attMap} holidays={db.settings.holidays} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Month summary" description={calPeriod} />
              <CardContent className="space-y-2 text-sm">
                {(['present', 'late', 'absent', 'on_leave'] as const).map((s) => (
                  <div key={s} className="flex items-center justify-between"><StatusBadge status={s} /><span className="tabular font-medium">{monthRecs.filter((r) => attTone(r) === s).length}</span></div>
                ))}
                <div className="border-t pt-2 text-xs text-muted-foreground">Overall attendance rate: <strong className="text-foreground">{formatPercent(attendance?.rate ?? 0)}</strong> across {attendance?.records.length ?? 0} records</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leave">
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {LEAVE_TYPES.map((l) => {
              const b = getBalance(db, emp.id, l.value, year);
              return (
                <Card key={l.value} className="p-3">
                  <p className="text-xs text-muted-foreground">{l.label}</p>
                  <p className="tabular text-lg font-semibold">{b.available}<span className="text-xs font-normal text-muted-foreground"> left of {b.allocated}</span></p>
                  <p className="text-[11px] text-muted-foreground">{b.used} used · {b.pending} pending</p>
                </Card>
              );
            })}
          </div>
          <Card>
            <DataTable
              rows={leaves}
              getRowId={(r) => r.id}
              onRowClick={(r) => navigate(`/leave-management?request=${r.id}`)}
              columns={[
                { key: 'id', header: 'Request', cell: (r) => <span className="tabular text-muted-foreground">{r.id}</span> },
                { key: 'type', header: 'Type', sortValue: (r) => r.type, cell: (r) => leaveTypeLabel(r.type) },
                { key: 'dates', header: 'Dates', sortValue: (r) => r.startDate, cell: (r) => <span className="whitespace-nowrap">{formatDate(r.startDate)}{r.endDate !== r.startDate && ` – ${formatDate(r.endDate)}`}</span> },
                { key: 'days', header: 'Days', align: 'right', sortValue: (r) => r.days, cell: (r) => <span className="tabular">{r.days}</span> },
                { key: 'reason', header: 'Reason', cell: (r) => <span className="line-clamp-1 text-muted-foreground">{r.reason}</span> },
                { key: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
              ]}
              empty={<EmptyState icon={<CalendarDays />} title="No leave history" />}
            />
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader title="Employment documents" description={`${emp.documents.filter((d) => d.status === 'Verified').length} of ${emp.documents.length} verified`} />
            <ul className="divide-y border-t">
              {emp.documents.map((d) => (
                <li key={d.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                  <span className="flex size-9 items-center justify-center rounded-md bg-muted text-muted-foreground"><FileText className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.type} · {d.uploadedAt ? `Received ${formatDate(d.uploadedAt)}` : 'Not yet received'}</p>
                  </div>
                  <Badge tone={d.status === 'Verified' ? 'success' : d.status === 'Pending' ? 'warning' : 'danger'} dot>{d.status}</Badge>
                  {can(user, 'employees.edit') && (
                    <Select aria-label={`Update status of ${d.name}`} className="h-8 w-36 text-xs" value={d.status} disabled={pending === `doc-${d.id}`} onChange={(e) => docStatus(d, e.target.value as EmployeeDocument['status'])}>
                      <option>Verified</option>
                      <option>Pending</option>
                      <option>Missing</option>
                    </Select>
                  )}
                </li>
              ))}
            </ul>
            <p className="px-5 py-3 text-xs text-muted-foreground">File uploads require a storage backend (e.g. Supabase Storage). In demo mode, HR tracks the verification status of each document.</p>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          {reviews.length ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {reviews.map((r) => (
                <Card key={r.id}>
                  <CardHeader title={r.cycle} description={`Reviewer: ${db.employees.find((e) => e.id === r.reviewerId) ? fullName(db.employees.find((e) => e.id === r.reviewerId)!) : '—'}`} action={<StatusBadge status={r.status} />} />
                  <CardContent className="space-y-3">
                    {r.goals.map((g) => (
                      <div key={g.id}>
                        <div className="mb-1 flex justify-between gap-3 text-sm"><span>{g.title}</span><span className="tabular text-muted-foreground">{g.progress}%</span></div>
                        <Progress value={g.progress} />
                      </div>
                    ))}
                    {r.overallRating !== null && <p className="text-sm">Overall rating recorded: <strong className="tabular">{r.overallRating} / 5</strong></p>}
                    {r.managerFeedback && <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">“{r.managerFeedback}”</p>}
                    <Link to={`/performance?review=${r.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><Target className="size-4" /> Open review</Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card><EmptyState icon={<Target />} title="No performance records available" description="Reviews appear here once a review cycle is opened, subject to your access." /></Card>
          )}
        </TabsContent>
      </Tabs>

      <EmployeeFormSheet open={editOpen} onOpenChange={setEditOpen} employee={emp} />
      {self && <SelfEditDialog open={selfOpen} onOpenChange={setSelfOpen} employee={emp} />}
    </div>
  );
}
