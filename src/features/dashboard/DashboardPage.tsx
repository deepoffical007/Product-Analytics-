import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { Building2, CalendarCheck, CalendarClock, CalendarDays, CheckCheck, Download, FileBarChart, Gift, GraduationCap, Megaphone, Plus, Trash2, UserCheck, UserPlus, Users, Wallet, Briefcase, ArrowRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, isTeamManager } from '@/lib/permissions';
import { formatDate, formatShortDate, formatWeekday, today, timeAgo, addDays, isWorkingDay } from '@/lib/dates';
import { formatCurrency, formatPercent, pluralize } from '@/lib/utils';
import { departmentDistribution, employeeAttendanceStats, headline, leaveOverview, monthlyAttendance, upcomingCelebrations } from '@/data/metrics';
import { deleteAnnouncement, fullName, getBalance, visibleLeaveRequests, visiblePayroll } from '@/data/services';
import { leaveTypeLabel, LEAVE_TYPES, type Database, type User } from '@/data/types';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { PageHeader, StatCard } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Avatar, EmptyState, Progress, Skeleton } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status';
import { useConfirm } from '@/components/ui/confirm';
import { C, ChartTooltip, Legend, axisProps } from '@/components/charts/chart-kit';
import { AnnouncementDialog } from './AnnouncementDialog';
import { downloadPayslip } from '@/features/payroll/payslip';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;
  return can(user, 'reports.view') ? <ExecutiveDashboard /> : <PersonalDashboard />;
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="mb-2 h-4 w-40" />
      <Skeleton className="mb-6 h-8 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}

function Announcements({ db, user }: { db: Database; user: User }) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();
  const t = today();
  const items = [...db.announcements].filter((a) => a.date >= addDays(t, -2)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  const holidays = db.settings.holidays.filter((h) => h.date >= t).slice(0, 2);
  const manage = can(user, 'announcements.manage');
  const tone = { Event: 'primary', Notice: 'neutral', Holiday: 'success', Academic: 'violet' } as const;
  return (
    <Card>
      <CardHeader title="Upcoming events & announcements" description="Institution-wide notices" action={manage && <Button size="sm" variant="outline" onClick={() => setOpen(true)}><Megaphone /> New</Button>} />
      <CardContent className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="group flex gap-3">
            <div className="flex w-12 shrink-0 flex-col items-center rounded-md border bg-muted/40 py-1">
              <span className="text-[10px] font-medium uppercase text-muted-foreground">{formatShortDate(a.date).split(' ')[1]}</span>
              <span className="tabular text-base font-semibold leading-tight">{formatShortDate(a.date).split(' ')[0]}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium">{a.title}</p>
                <Badge tone={tone[a.category]}>{a.category}</Badge>
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
            </div>
            {manage && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove announcement ${a.title}`}
                onClick={async () => {
                  if (!(await confirm({ title: 'Remove announcement?', description: `“${a.title}” will be removed from all dashboards.`, confirmLabel: 'Remove', destructive: true }))) return;
                  const r = await deleteAnnouncement(user, a.id);
                  r.ok ? toast.success('Announcement removed') : toast.error(r.error);
                }}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
        {!items.length && <EmptyState icon={<Megaphone />} title="No upcoming announcements" description={manage ? 'Post a notice for all staff.' : undefined} className="py-6" />}
        {holidays.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" /> Next holidays:
            {holidays.map((h) => <span key={h.date} className="font-medium text-foreground">{h.name} ({formatShortDate(h.date)})</span>)}
          </div>
        )}
      </CardContent>
      <AnnouncementDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function Celebrations({ db }: { db: Database }) {
  const items = upcomingCelebrations(db, 30).slice(0, 9);
  return (
    <Card>
      <CardHeader title="Birthdays & work anniversaries" description="Next 30 days" />
      <CardContent className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c) => (
          <Link key={c.employee.id + c.kind} to={`/employees/${c.employee.id}`} className="flex items-center gap-3 rounded-md p-1 -m-1 transition hover:bg-muted/50">
            <Avatar name={fullName(c.employee)} color={c.employee.avatarColor} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName(c.employee)}</p>
              <p className="text-xs text-muted-foreground">{c.kind === 'birthday' ? 'Birthday' : `${c.years}-year work anniversary`}</p>
            </div>
            <Badge tone={c.inDays === 0 ? 'success' : c.kind === 'birthday' ? 'violet' : 'primary'}>
              {c.kind === 'birthday' ? <Gift className="size-3" /> : <GraduationCap className="size-3" />}
              {c.inDays === 0 ? 'Today' : c.inDays === 1 ? 'Tomorrow' : formatShortDate(c.date)}
            </Badge>
          </Link>
        ))}
        {!items.length && <EmptyState icon={<Gift />} title="Nothing coming up" className="py-6" />}
      </CardContent>
    </Card>
  );
}

function ExecutiveDashboard() {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const ready = useSimulatedLoad('dashboard');
  const h = useMemo(() => headline(db), [db]);
  const dist = useMemo(() => departmentDistribution(db), [db]);
  const trend = useMemo(() => monthlyAttendance(db, 6), [db]);
  const leave = useMemo(() => leaveOverview(db), [db]);
  const celebrations = useMemo(() => upcomingCelebrations(db, 30), [db]);
  const pending = useMemo(() => db.leaveRequests.filter((r) => r.status === 'pending').sort((a, b) => a.startDate.localeCompare(b.startDate)), [db.leaveRequests]);
  if (!user) return null;
  if (!ready) return <DashboardSkeleton />;

  const t = today();
  const working = isWorkingDay(t, db.settings.holidays);
  const presentPct = h.current ? (h.presentToday / h.current) * 100 : 0;
  const split = [
    { name: 'Faculty', value: h.activeFaculty, fill: C.c1 },
    { name: 'Administrative', value: h.adminStaff, fill: C.c2 },
  ];
  const statusData = [
    { name: 'Pending', value: leave.byStatus.pending, fill: C.warning },
    { name: 'Approved', value: leave.byStatus.approved, fill: C.success },
    { name: 'Rejected', value: leave.byStatus.rejected, fill: C.danger },
    { name: 'Cancelled', value: leave.byStatus.cancelled, fill: C.muted },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        title={`${greeting()}, ${user.name.replace(/^Dr\. /, '').split(' ')[0]}`}
        description={`${formatWeekday(t)} · ${db.settings.institutionName}`}
        actions={
          <>
            {can(user, 'employees.create') && <Button onClick={() => navigate('/employees?new=1')}><UserPlus /> Add employee</Button>}
            <Button variant="outline" onClick={() => navigate('/attendance')}><CalendarCheck /> Record attendance</Button>
            <Button variant="outline" onClick={() => navigate('/leave-management?tab=approvals')}><CheckCheck /> Approve leave</Button>
            <Button variant="outline" onClick={() => navigate('/reports')}><FileBarChart /> Reports</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total employees" value={h.totalEmployees} icon={<Users />} to="/employees" hint="All employee records except those who have resigned (includes inactive accounts)." trend={`${h.current} currently active`} />
        <StatCard label="Active faculty" value={h.activeFaculty} icon={<GraduationCap />} tone="info" to="/employees?category=faculty" hint="Active or probationary employees holding a faculty designation." trend={`${formatPercent(h.current ? (h.activeFaculty / h.current) * 100 : 0, 0)} of active staff`} />
        <StatCard label="Administrative staff" value={h.adminStaff} icon={<Briefcase />} tone="violet" to="/employees?category=administrative" hint="Active or probationary employees in administrative designations." />
        <StatCard
          label="Present today"
          value={working ? h.presentToday : '—'}
          icon={<UserCheck />}
          tone="success"
          to="/attendance"
          hint="Present + late check-ins recorded in today’s register, out of active employees."
          trend={working ? <><Progress value={presentPct} tone="success" className="mb-1" />{formatPercent(presentPct, 0)} · {h.markedToday}/{h.current} marked</> : 'Not a working day'}
        />
        <StatCard label="On leave today" value={h.onLeaveToday} icon={<CalendarClock />} tone="violet" to="/leave-management?tab=all&status=approved" hint="Employees with an approved leave request covering today." />
        <StatCard label="Pending leave requests" value={h.pendingLeave} icon={<CalendarDays />} tone="warning" to="/leave-management?tab=approvals" hint="Requests awaiting review by HR or the reporting manager." />
        <StatCard label="Departments" value={h.departments} icon={<Building2 />} to="/departments" hint="Active academic and administrative departments." />
        <StatCard label="Birthdays & anniversaries" value={celebrations.length} icon={<Gift />} tone="danger" hint="Upcoming birthdays and work anniversaries in the next 30 days." trend={celebrations[0] ? `Next: ${fullName(celebrations[0].employee)}` : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Employees by department" description="Active staff split by faculty and administrative roles" action={<Legend items={[{ label: 'Faculty', color: C.c1 }, { label: 'Administrative', color: C.c2 }]} />} />
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer>
                <BarChart data={dist} margin={{ left: -18, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="code" {...axisProps} interval={0} fontSize={10} />
                  <YAxis {...axisProps} allowDecimals={false} />
                  <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} labelFormatter={(code) => dist.find((d) => d.code === code)?.name ?? code} />
                  <Bar dataKey="faculty" name="Faculty" stackId="a" fill={C.c1} radius={[0, 0, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="administrative" name="Administrative" stackId="a" fill={C.c2} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Faculty vs administrative" description="Share of active workforce" />
          <CardContent>
            <div className="relative h-[220px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={split} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={0}>
                    {split.map((s) => <Cell key={s.name} fill={s.fill} />)}
                  </Pie>
                  <RTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="tabular text-2xl font-semibold">{h.current}</span>
                <span className="text-xs text-muted-foreground">active staff</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {split.map((s) => (
                <div key={s.name} className="rounded-md border p-2.5">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: s.fill }} />{s.name}</p>
                  <p className="tabular text-lg font-semibold">{s.value} <span className="text-xs font-normal text-muted-foreground">{formatPercent(h.current ? (s.value / h.current) * 100 : 0, 0)}</span></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Monthly attendance trend" description="Attendance rate = (present + late) ÷ (present + late + absent); approved leave excluded" action={<Link to="/reports?report=attendance" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Details <ArrowRight /></Link>} />
          <CardContent>
            <div className="h-[260px]">
              <ResponsiveContainer>
                <AreaChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="att" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.c1} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={C.c1} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
                  <RTooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                  <Area type="monotone" dataKey="rate" name="Attendance rate" stroke={C.c1} strokeWidth={2} fill="url(#att)" dot={{ r: 3, fill: C.c1 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Leave requests overview" description={`Calendar year ${t.slice(0, 4)} · ${leave.total} requests`} />
          <CardContent>
            <div className="h-[150px]">
              <ResponsiveContainer>
                <BarChart data={statusData} layout="vertical" margin={{ left: 0, right: 24 }}>
                  <XAxis type="number" hide allowDecimals={false} />
                  <YAxis type="category" dataKey="name" {...axisProps} width={72} />
                  <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
                  <Bar dataKey="value" name="Requests" radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: 'right', fill: 'hsl(var(--foreground))', fontSize: 11 }}>
                    {statusData.map((s) => <Cell key={s.name} fill={s.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">Approved days by type</p>
            <ul className="space-y-1.5">
              {leave.byType.map((b) => {
                const max = Math.max(1, ...leave.byType.map((x) => x.approvedDays));
                return (
                  <li key={b.type} className="grid grid-cols-[80px_1fr_32px] items-center gap-2 text-xs">
                    <span className="text-muted-foreground">{b.label}</span>
                    <Progress value={(b.approvedDays / max) * 100} />
                    <span className="tabular text-right font-medium">{b.approvedDays}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Awaiting approval" description={pluralize(pending.length, 'pending request')} action={<Link to="/leave-management?tab=approvals" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Review all <ArrowRight /></Link>} />
          <CardContent className="space-y-1">
            {pending.slice(0, 5).map((r) => {
              const e = db.employees.find((x) => x.id === r.employeeId);
              if (!e) return null;
              return (
                <Link key={r.id} to={`/leave-management?request=${r.id}`} className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition hover:bg-muted/50">
                  <Avatar name={fullName(e)} color={e.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{fullName(e)}</p>
                    <p className="truncate text-xs text-muted-foreground">{leaveTypeLabel(r.type)} · {formatShortDate(r.startDate)}{r.endDate !== r.startDate && ` – ${formatShortDate(r.endDate)}`} · {pluralize(r.days, 'day')}</p>
                  </div>
                  <StatusBadge status="pending" />
                </Link>
              );
            })}
            {!pending.length && <EmptyState icon={<CheckCheck />} title="No pending requests" description="All leave requests have been reviewed." className="py-6" />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Recent activity" description="Latest audited changes" action={<Link to="/notifications?tab=activity" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Audit log <ArrowRight /></Link>} />
          <CardContent>
            <ol className="relative space-y-3.5 border-l pl-4">
              {db.auditLogs.slice(0, 6).map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" aria-hidden />
                  <p className="text-sm leading-snug">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{a.actorName} · {timeAgo(a.at)}</p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Announcements db={db} user={user} />
        </div>
      </div>
      <Celebrations db={db} />
    </div>
  );
}

function PersonalDashboard() {
  const { user, employee, db } = useAuth();
  const navigate = useNavigate();
  const ready = useSimulatedLoad('dashboard-personal');
  const t = today();
  const year = Number(t.slice(0, 4));
  const monthStats = useMemo(() => (employee ? employeeAttendanceStats(db, employee.id, `${t.slice(0, 7)}-01`, t) : null), [db, employee, t]);
  const myLeaves = useMemo(() => (user ? visibleLeaveRequests(user, db).filter((r) => r.employeeId === user.employeeId).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)) : []), [db, user]);
  const teamPending = useMemo(() => (user ? visibleLeaveRequests(user, db).filter((r) => r.employeeId !== user.employeeId && r.status === 'pending') : []), [db, user]);
  const payslip = useMemo(() => (user ? visiblePayroll(user, db).sort((a, b) => b.period.localeCompare(a.period))[0] : undefined), [db, user]);
  if (!user) return null;
  if (!employee) return <EmptyState title="No employee record linked" description="Your account is not linked to an employee profile. Contact HR." />;
  if (!ready) return <DashboardSkeleton />;

  const balances = LEAVE_TYPES.map((l) => ({ ...l, ...getBalance(db, employee.id, l.value, year) }));
  const totalAvail = balances.reduce((a, b) => a + b.available, 0);
  const unread = db.notifications.filter((n) => n.userId === user.id && !n.read);
  const last10 = Object.values(db.attendance).filter((r) => r.employeeId === employee.id && r.date <= t).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).reverse();
  const manager = isTeamManager(user, db);
  const dept = db.departments.find((d) => d.id === employee.departmentId);
  const des = db.designations.find((d) => d.id === employee.designationId);
  const tones = { present: 'bg-emerald-500', late: 'bg-amber-500', absent: 'bg-red-500', on_leave: 'bg-violet-500' };

  return (
    <div className="space-y-4">
      <PageHeader
        breadcrumbs={[{ label: 'Home' }, { label: 'Dashboard' }]}
        title={`${greeting()}, ${employee.firstName}`}
        description={`${des?.title} · ${dept?.name} · ${formatWeekday(t)}`}
        actions={
          <>
            <Button onClick={() => navigate('/leave-management?apply=1')}><Plus /> Apply for leave</Button>
            <Button variant="outline" onClick={() => navigate(`/employees/${employee.id}`)}>View my profile</Button>
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Attendance this month" value={formatPercent(monthStats?.rate ?? 0, 0)} icon={<UserCheck />} tone="success" to="/attendance" hint="(Present + late) ÷ (present + late + absent) for working days this month." trend={`${monthStats?.present ?? 0} present · ${monthStats?.late ?? 0} late · ${monthStats?.absent ?? 0} absent`} />
        <StatCard label="Leave available" value={totalAvail} icon={<CalendarDays />} tone="violet" to="/leave-management" hint="Remaining days across all leave types after approved and pending requests." trend={`for ${year}`} />
        <StatCard label="Pending requests" value={myLeaves.filter((r) => r.status === 'pending').length} icon={<Clock />} tone="warning" to="/leave-management" />
        <StatCard label="Unread notifications" value={unread.length} icon={<Megaphone />} to="/notifications" />
      </div>

      {manager && (
        <Card>
          <CardHeader title="Team approvals" description={`${pluralize(teamPending.length, 'leave request')} from your team awaiting your decision`} action={<Link to="/leave-management?tab=approvals" className={buttonVariants({ size: 'sm' })}>Review</Link>} />
          {teamPending.length > 0 && (
            <CardContent className="flex flex-wrap gap-2">
              {teamPending.slice(0, 6).map((r) => {
                const e = db.employees.find((x) => x.id === r.employeeId)!;
                return (
                  <Link key={r.id} to={`/leave-management?request=${r.id}`} className="flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-xs transition hover:bg-muted">
                    <Avatar name={fullName(e)} color={e.avatarColor} size="xs" /> {fullName(e)} · {formatShortDate(r.startDate)}
                  </Link>
                );
              })}
            </CardContent>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Leave balance" description={`Entitlements for ${year} as per institution policy`} action={<Link to="/leave-management" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>Manage <ArrowRight /></Link>} />
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => (
              <div key={b.value} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{b.label}</p>
                <p className="tabular mt-1 text-xl font-semibold">{b.available}<span className="text-sm font-normal text-muted-foreground"> / {b.allocated}</span></p>
                <Progress value={b.allocated ? ((b.used + b.pending) / b.allocated) * 100 : 0} className="mt-2" tone={b.available <= 1 ? 'warning' : 'primary'} />
                <p className="mt-1.5 text-[11px] text-muted-foreground">{b.used} used · {b.pending} pending</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Latest payslip" description="Demo payroll data" />
          <CardContent>
            {payslip ? (
              <>
                <div className="rounded-lg bg-sidebar p-4 text-sidebar-foreground">
                  <p className="text-xs text-sidebar-muted">Net pay · {payslip.period}</p>
                  <p className="tabular mt-1 text-2xl font-semibold">{formatCurrency(payslip.net)}</p>
                  <p className="mt-2 text-xs text-sidebar-muted">{payslip.paidOn ? `Paid on ${formatDate(payslip.paidOn)}` : payslip.status}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => { downloadPayslip(db, payslip); toast.success('Payslip downloaded'); }}><Download /> Download</Button>
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => navigate('/payroll')}><Wallet /> All payslips</Button>
                </div>
              </>
            ) : (
              <EmptyState icon={<Wallet />} title="No payslips yet" className="py-6" />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Recent attendance" description="Last 10 working days" action={<Link to="/attendance" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>History <ArrowRight /></Link>} />
          <CardContent>
            <div className="flex gap-1.5">
              {last10.map((r) => (
                <div key={r.date} className="flex flex-1 flex-col items-center gap-1" title={`${formatDate(r.date)}: ${r.status.replace('_', ' ')}`}>
                  <span className={`h-10 w-full rounded ${tones[r.status]}`} />
                  <span className="text-[10px] text-muted-foreground">{r.date.slice(8)}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Legend items={[{ label: 'Present', color: '#10b981' }, { label: 'Late', color: '#f59e0b' }, { label: 'Absent', color: '#ef4444' }, { label: 'Leave', color: '#8b5cf6' }]} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="My leave requests" action={<Link to="/leave-management" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>All <ArrowRight /></Link>} />
          <CardContent className="space-y-2">
            {myLeaves.slice(0, 4).map((r) => (
              <Link key={r.id} to={`/leave-management?request=${r.id}`} className="-mx-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 transition hover:bg-muted/50">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{leaveTypeLabel(r.type)}</p>
                  <p className="text-xs text-muted-foreground">{formatShortDate(r.startDate)}{r.endDate !== r.startDate && ` – ${formatShortDate(r.endDate)}`} · {pluralize(r.days, 'day')}</p>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
            {!myLeaves.length && <EmptyState icon={<CalendarDays />} title="No leave requests" action={<Button size="sm" onClick={() => navigate('/leave-management?apply=1')}>Apply now</Button>} className="py-6" />}
          </CardContent>
        </Card>
        <Announcements db={db} user={user} />
      </div>
    </div>
  );
}
