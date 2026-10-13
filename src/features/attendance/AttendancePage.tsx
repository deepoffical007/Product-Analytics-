import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { CalendarCheck, CalendarOff, CheckCheck, ChevronLeft, ChevronRight, Download, Lock, RotateCcw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, headedDepartmentIds } from '@/lib/permissions';
import { addDays, eachDay, formatDate, formatShortDate, formatWeekday, isWeekend, monthEnd, monthStart, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { cn, formatPercent } from '@/lib/utils';
import { attendanceRate, employeeAttendanceStats, isCurrent, summarize } from '@/data/metrics';
import { approvedLeaveOn, attendanceKey, clearAttendance, fullName, isEmployedOn, markAttendance, type AttendanceEntry } from '@/data/services';
import type { AttendanceRecord, AttendanceStatus, Employee } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, StatCard, Toolbar } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { Avatar, DemoBanner, EmptyState } from '@/components/ui/misc';
import { StatusBadge } from '@/components/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table';
import { C, ChartTooltip, axisProps } from '@/components/charts/chart-kit';
import { Tooltip } from '@/components/ui/tooltip';
import { useConfirm } from '@/components/ui/confirm';
import { MonthCalendar } from './MonthCalendar';

const MARKABLE: { value: Exclude<AttendanceStatus, 'on_leave'>; label: string; cls: string }[] = [
  { value: 'present', label: 'Present', cls: 'data-[on=true]:bg-emerald-600 data-[on=true]:text-white data-[on=true]:border-emerald-600' },
  { value: 'late', label: 'Late', cls: 'data-[on=true]:bg-amber-500 data-[on=true]:text-white data-[on=true]:border-amber-500' },
  { value: 'absent', label: 'Absent', cls: 'data-[on=true]:bg-red-600 data-[on=true]:text-white data-[on=true]:border-red-600' },
];

export function AttendancePage() {
  const { user } = useAuth();
  if (!user) return null;
  return can(user, 'attendance.view_all') ? <AdminAttendance /> : <MyAttendance />;
}

function lastWorkingDay(holidays: { date: string }[]) {
  let d = today();
  let guard = 0;
  while ((isWeekend(d) || holidays.some((h) => h.date === d)) && guard++ < 10) d = addDays(d, -1);
  return d;
}

function AdminAttendance() {
  const { db } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'register';
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance' }]} title="Attendance" description={`Working hours from ${db.settings.workdayStart}; check-ins after ${db.settings.lateAfter} count as late`} />
      <Tabs value={tab} onValueChange={(t) => setParams(t === 'register' ? {} : { tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="register"><CalendarCheck /> Daily register</TabsTrigger>
          <TabsTrigger value="summary">Monthly summary</TabsTrigger>
          <TabsTrigger value="calendar">Employee calendar</TabsTrigger>
        </TabsList>
        <TabsContent value="register"><Register /></TabsContent>
        <TabsContent value="summary"><MonthlySummary /></TabsContent>
        <TabsContent value="calendar"><EmployeeCalendar /></TabsContent>
      </Tabs>
    </div>
  );
}

function Register() {
  const { user, db } = useAuth();
  const confirm = useConfirm();
  const { run, pending } = useAsyncAction();
  const [date, setDate] = useState(() => lastWorkingDay(db.settings.holidays));
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const canMark = can(user, 'attendance.mark');
  const holiday = db.settings.holidays.find((h) => h.date === date);
  const nonWorking = isWeekend(date) || !!holiday;
  const future = date > today();

  const staff = useMemo(() => db.employees.filter((e) => isEmployedOn(e, date) && (e.status !== 'Resigned' || (e.exitDate && e.exitDate >= date))), [db.employees, date]);
  const statusOf = (e: Employee): AttendanceStatus | 'unmarked' => db.attendance[attendanceKey(e.id, date)]?.status ?? (approvedLeaveOn(db, e.id, date) ? 'on_leave' : 'unmarked');
  const rows = staff.filter((e) => (!dept || e.departmentId === dept) && (!q || `${fullName(e)} ${e.id}`.toLowerCase().includes(q.toLowerCase())) && (!statusFilter || statusOf(e) === statusFilter));
  const counts = useMemo(() => {
    const c = { present: 0, late: 0, absent: 0, on_leave: 0, unmarked: 0 };
    for (const e of staff.filter((x) => !dept || x.departmentId === dept)) c[statusOf(e)]++;
    return c;
  }, [staff, dept, db.attendance, date]);

  const mark = async (entries: AttendanceEntry[], key: string) => {
    const r = await run(key, () => markAttendance(user, entries));
    if (r.ok) {
      const { created, updated, skipped } = r.data;
      if (!created && !updated) toast.info('No changes — attendance already up to date.');
      else toast.success(`Attendance saved for ${formatShortDate(date)}`, { description: `${created} recorded · ${updated} updated${skipped.length ? ` · ${skipped.length} skipped` : ''}` });
    }
  };

  const markUnmarkedPresent = async () => {
    const targets = rows.filter((e) => statusOf(e) === 'unmarked');
    if (!targets.length) return toast.info('Everyone in this view is already marked.');
    if (!(await confirm({ title: `Mark ${targets.length} employee(s) present?`, description: `All unmarked employees in the current view will be recorded as present on ${formatDate(date)} with check-in ${db.settings.workdayStart}.`, confirmLabel: 'Mark present' }))) return;
    await mark(targets.map((e) => ({ employeeId: e.id, date, status: 'present' as const })), 'bulk');
  };

  const bulk = async (status: Exclude<AttendanceStatus, 'on_leave'>) => {
    const ids = [...selected].filter((id) => statusOf(db.employees.find((e) => e.id === id)!) !== 'on_leave');
    await mark(ids.map((employeeId) => ({ employeeId, date, status })), 'bulk');
    setSelected(new Set());
  };

  const shift = (n: number) => {
    let d = addDays(date, n);
    let g = 0;
    while (isWeekend(d) && g++ < 4) d = addDays(d, n);
    if (d > today()) return;
    setDate(d);
    setSelected(new Set());
  };

  const exportRegister = () => {
    exportCsv(`attendance-${date}.csv`, rows, [
      { header: 'Date', value: () => date },
      { header: 'Employee ID', value: (e) => e.id },
      { header: 'Name', value: (e) => fullName(e) },
      { header: 'Department', value: (e) => db.departments.find((d) => d.id === e.departmentId)?.name },
      { header: 'Status', value: (e) => statusOf(e) },
      { header: 'Check-in', value: (e) => db.attendance[attendanceKey(e.id, date)]?.checkIn ?? '' },
    ]);
    toast.success(`Exported ${rows.length} rows`);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(['present', 'late', 'absent', 'on_leave', 'unmarked'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setStatusFilter(statusFilter === s ? '' : s)} className={cn('rounded-lg border bg-card p-3 text-left shadow-card transition hover:border-primary/40', statusFilter === s && 'border-primary ring-2 ring-primary/20')} aria-pressed={statusFilter === s}>
            <StatusBadge status={s} />
            <p className="tabular mt-2 text-2xl font-semibold">{counts[s]}</p>
          </button>
        ))}
      </div>
      <Card>
        <Toolbar>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" aria-label="Previous working day" onClick={() => shift(-1)}><ChevronLeft /></Button>
            <Input type="date" aria-label="Attendance date" className="w-[160px]" value={date} max={today()} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setSelected(new Set()); } }} />
            <Button variant="outline" size="icon" aria-label="Next working day" onClick={() => shift(1)} disabled={date >= today()}><ChevronRight /></Button>
          </div>
          <Select aria-label="Filter by department" className="sm:w-56" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {db.departments.filter((d) => d.status === 'active').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search employee" className="sm:w-56" />
          <div className="flex gap-2 sm:ml-auto">
            {can(user, 'attendance.export') && <Button variant="outline" onClick={exportRegister} disabled={!rows.length || nonWorking}><Download /> CSV</Button>}
            {canMark && <Button onClick={markUnmarkedPresent} loading={pending === 'bulk'} disabled={nonWorking || future || !counts.unmarked}><CheckCheck /> Mark unmarked present</Button>}
          </div>
        </Toolbar>
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2 text-sm">
          <span className="font-medium">{formatWeekday(date)}{date === today() && <span className="ml-2 text-xs font-normal text-primary">Today</span>}</span>
          {selected.size > 0 && canMark && !nonWorking && (
            <span className="flex flex-wrap items-center gap-2 animate-slide-up">
              <span className="text-muted-foreground">{selected.size} selected:</span>
              {MARKABLE.map((m) => <Button key={m.value} size="sm" variant="outline" onClick={() => bulk(m.value)} loading={pending === 'bulk'}>Mark {m.label.toLowerCase()}</Button>)}
            </span>
          )}
        </div>
        {nonWorking ? (
          <EmptyState icon={<CalendarOff />} title={holiday ? `${holiday.name} — college holiday` : 'Weekend'} description="Attendance is not recorded on non-working days." action={<Button variant="outline" onClick={() => setDate(lastWorkingDay(db.settings.holidays))}>Go to last working day</Button>} />
        ) : (
          <DataTable
            caption={`Attendance register for ${date}`}
            rows={rows}
            getRowId={(e) => e.id}
            pageSize={25}
            initialSort={{ key: 'name', dir: 'asc' }}
            selectable={canMark}
            selected={selected}
            onSelectedChange={setSelected}
            dense
            columns={[
              { key: 'name', header: 'Employee', sortValue: (e) => fullName(e), cell: (e) => <Link to={`/employees/${e.id}?tab=attendance`} className="flex items-center gap-2.5"><Avatar name={fullName(e)} color={e.avatarColor} size="sm" /><span><span className="block font-medium hover:text-primary">{fullName(e)}</span><span className="block text-xs text-muted-foreground">{e.id}</span></span></Link> },
              { key: 'dept', header: 'Department', hideBelow: 'lg', sortValue: (e) => db.departments.find((d) => d.id === e.departmentId)?.code ?? '', cell: (e) => <span className="text-muted-foreground">{db.departments.find((d) => d.id === e.departmentId)?.name}</span> },
              { key: 'status', header: 'Status', sortValue: (e) => statusOf(e), cell: (e) => <StatusBadge status={statusOf(e)} /> },
              {
                key: 'mark',
                header: 'Mark attendance',
                cell: (e) => {
                  const s = statusOf(e);
                  if (s === 'on_leave') return <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" /> Approved leave</span>;
                  if (!canMark) return null;
                  return (
                    <div role="radiogroup" aria-label={`Attendance for ${fullName(e)}`} className="inline-flex overflow-hidden rounded-md border">
                      {MARKABLE.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          role="radio"
                          aria-checked={s === m.value}
                          data-on={s === m.value}
                          disabled={pending === e.id || future}
                          onClick={() => s !== m.value && mark([{ employeeId: e.id, date, status: m.value }], e.id)}
                          className={cn('border-r px-2.5 py-1 text-xs font-medium text-muted-foreground transition last:border-r-0 hover:bg-muted disabled:opacity-60', m.cls)}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  );
                },
              },
              {
                key: 'in',
                header: 'Check-in',
                hideBelow: 'md',
                cell: (e) => {
                  const rec = db.attendance[attendanceKey(e.id, date)];
                  if (!rec || rec.status === 'absent' || rec.status === 'on_leave') return <span className="text-muted-foreground">—</span>;
                  return canMark ? (
                    <Input
                      key={`${rec.id}-${rec.checkIn}`}
                      type="time"
                      aria-label={`Check-in time for ${fullName(e)}`}
                      defaultValue={rec.checkIn ?? ''}
                      className="h-8 w-[110px] text-xs"
                      onBlur={(ev) => {
                        const v = ev.target.value;
                        if (!v || v === rec.checkIn) return;
                        const status = v > db.settings.lateAfter ? 'late' : 'present';
                        mark([{ employeeId: e.id, date, status, checkIn: v }], e.id);
                      }}
                    />
                  ) : (
                    <span className="tabular">{rec.checkIn}</span>
                  );
                },
              },
              {
                key: 'clear',
                header: <span className="sr-only">Clear</span>,
                align: 'right',
                cell: (e) => {
                  const rec = db.attendance[attendanceKey(e.id, date)];
                  if (!canMark || !rec || rec.status === 'on_leave') return null;
                  return (
                    <Tooltip content="Clear this entry">
                      <Button variant="ghost" size="icon-sm" aria-label={`Clear attendance for ${fullName(e)}`} onClick={async () => { const r = await clearAttendance(user, e.id, date); r.ok ? toast.success('Entry cleared') : toast.error(r.error); }}>
                        <RotateCcw />
                      </Button>
                    </Tooltip>
                  );
                },
              },
            ]}
            empty={<EmptyState icon={<Users />} title="No employees in this view" description="Adjust the filters or pick a different date." />}
          />
        )}
      </Card>
    </div>
  );
}

function MonthlySummary() {
  const { user, db } = useAuth();
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [dept, setDept] = useState('');
  const start = monthStart(period);
  const end = monthEnd(period) < today() ? monthEnd(period) : today();

  const data = useMemo(() => {
    const empDept = new Map(db.employees.map((e) => [e.id, e.departmentId]));
    const recs = Object.values(db.attendance).filter((r) => r.date >= start && r.date <= end && (!dept || empDept.get(r.employeeId) === dept));
    const byDay = new Map<string, AttendanceRecord[]>();
    const byEmp = new Map<string, AttendanceRecord[]>();
    const byDept = new Map<string, AttendanceRecord[]>();
    for (const r of recs) {
      (byDay.get(r.date) ?? byDay.set(r.date, []).get(r.date)!).push(r);
      (byEmp.get(r.employeeId) ?? byEmp.set(r.employeeId, []).get(r.employeeId)!).push(r);
      const d = empDept.get(r.employeeId)!;
      (byDept.get(d) ?? byDept.set(d, []).get(d)!).push(r);
    }
    const daily = eachDay(start, end).filter((d) => byDay.has(d)).map((d) => ({ date: d, label: formatShortDate(d), rate: Math.round(attendanceRate(byDay.get(d)!) * 10) / 10, ...summarize(byDay.get(d)!) }));
    const depts = db.departments.filter((d) => byDept.has(d.id)).map((d) => ({ code: d.code, name: d.name, rate: Math.round(attendanceRate(byDept.get(d.id)!) * 10) / 10 })).sort((a, b) => b.rate - a.rate);
    const employees = [...byEmp.entries()].map(([id, rs]) => ({ emp: db.employees.find((e) => e.id === id)!, ...summarize(rs), rate: attendanceRate(rs) })).filter((r) => r.emp);
    return { daily, depts, employees, total: summarize(recs), rate: attendanceRate(recs) };
  }, [db, start, end, dept]);

  return (
    <div className="space-y-4">
      <Card>
        <Toolbar className="border-b-0">
          <Input type="month" aria-label="Month" className="w-[170px]" value={period} max={today().slice(0, 7)} onChange={(e) => e.target.value && setPeriod(e.target.value)} />
          <Select aria-label="Department" className="sm:w-56" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {db.departments.filter((d) => d.status === 'active').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          {can(user, 'attendance.export') && (
            <Button variant="outline" className="sm:ml-auto" disabled={!data.employees.length} onClick={() => { exportCsv(`attendance-summary-${period}.csv`, data.employees, [{ header: 'Employee ID', value: (r) => r.emp.id }, { header: 'Name', value: (r) => fullName(r.emp) }, { header: 'Department', value: (r) => db.departments.find((d) => d.id === r.emp.departmentId)?.name }, { header: 'Present', value: (r) => r.present }, { header: 'Late', value: (r) => r.late }, { header: 'Absent', value: (r) => r.absent }, { header: 'On leave', value: (r) => r.on_leave }, { header: 'Attendance %', value: (r) => r.rate.toFixed(1) }]); toast.success('Summary exported'); }}>
              <Download /> Export summary
            </Button>
          )}
        </Toolbar>
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Attendance rate" value={formatPercent(data.rate)} tone="success" hint="(Present + late) ÷ (present + late + absent). Approved leave is excluded." />
        <StatCard label="Present" value={data.total.present} tone="success" />
        <StatCard label="Late" value={data.total.late} tone="warning" />
        <StatCard label="Absent" value={data.total.absent} tone="danger" />
        <StatCard label="Leave days" value={data.total.on_leave} tone="violet" />
      </div>
      {data.daily.length === 0 ? (
        <Card><EmptyState icon={<CalendarOff />} title="No attendance records for this period" /></Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Daily attendance rate" />
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <LineChart data={data.daily} margin={{ left: -12, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" {...axisProps} minTickGap={16} />
                      <YAxis {...axisProps} domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
                      <RTooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                      <Line type="monotone" dataKey="rate" name="Attendance" stroke={C.c1} strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="By department" />
              <CardContent>
                <div className="h-[240px]">
                  <ResponsiveContainer>
                    <BarChart data={data.depts} margin={{ left: -12, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="code" {...axisProps} interval={0} fontSize={10} />
                      <YAxis {...axisProps} domain={[70, 100]} tickFormatter={(v) => `${v}%`} />
                      <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip formatter={(v) => `${v}%`} />} />
                      <Bar dataKey="rate" name="Attendance" fill={C.c3} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader title="By employee" description="Sorted by lowest attendance first" />
            <DataTable
              rows={data.employees}
              getRowId={(r) => r.emp.id}
              initialSort={{ key: 'rate', dir: 'asc' }}
              columns={[
                { key: 'name', header: 'Employee', sortValue: (r) => fullName(r.emp), cell: (r) => <Link to={`/employees/${r.emp.id}?tab=attendance`} className="flex items-center gap-2.5 hover:text-primary"><Avatar name={fullName(r.emp)} color={r.emp.avatarColor} size="xs" />{fullName(r.emp)}</Link> },
                { key: 'dept', header: 'Department', hideBelow: 'md', cell: (r) => <span className="text-muted-foreground">{db.departments.find((d) => d.id === r.emp.departmentId)?.code}</span> },
                { key: 'present', header: 'Present', align: 'right', sortValue: (r) => r.present, cell: (r) => <span className="tabular">{r.present}</span> },
                { key: 'late', header: 'Late', align: 'right', sortValue: (r) => r.late, cell: (r) => <span className="tabular">{r.late}</span> },
                { key: 'absent', header: 'Absent', align: 'right', sortValue: (r) => r.absent, cell: (r) => <span className="tabular">{r.absent}</span> },
                { key: 'leave', header: 'Leave', align: 'right', hideBelow: 'sm', sortValue: (r) => r.on_leave, cell: (r) => <span className="tabular">{r.on_leave}</span> },
                { key: 'rate', header: 'Rate', align: 'right', sortValue: (r) => r.rate, cell: (r) => <span className={cn('tabular font-medium', r.rate < 85 && 'text-destructive')}>{formatPercent(r.rate)}</span> },
              ]}
            />
          </Card>
        </>
      )}
    </div>
  );
}

function EmployeeCalendar() {
  const { db } = useAuth();
  const current = db.employees.filter(isCurrent).sort((a, b) => fullName(a).localeCompare(fullName(b)));
  const [empId, setEmpId] = useState(current[0]?.id ?? '');
  const [period, setPeriod] = useState(today().slice(0, 7));
  const stats = useMemo(() => employeeAttendanceStats(db, empId), [db, empId]);
  const map = useMemo(() => new Map(stats.records.map((r) => [r.date, r] as const)), [stats]);
  const month = summarize(stats.records.filter((r) => r.date.startsWith(period)));
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardContent className="space-y-4 pt-5">
          <Select aria-label="Employee" value={empId} onChange={(e) => setEmpId(e.target.value)} className="sm:max-w-sm">
            {current.map((e) => <option key={e.id} value={e.id}>{fullName(e)} · {e.id}</option>)}
          </Select>
          <MonthCalendar period={period} onPeriodChange={setPeriod} records={map} holidays={db.settings.holidays} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Summary" description={period} />
        <CardContent className="space-y-2 text-sm">
          {(['present', 'late', 'absent', 'on_leave'] as const).map((s) => <div key={s} className="flex justify-between"><StatusBadge status={s} /><span className="tabular font-medium">{month[s]}</span></div>)}
          <p className="border-t pt-2 text-xs text-muted-foreground">Overall rate: <strong className="text-foreground">{formatPercent(stats.rate)}</strong></p>
          <Link to={`/employees/${empId}?tab=attendance`} className="block text-sm font-medium text-primary hover:underline">Open profile →</Link>
        </CardContent>
      </Card>
    </div>
  );
}

function MyAttendance() {
  const { user, db, employee } = useAuth();
  const [period, setPeriod] = useState(today().slice(0, 7));
  const stats = useMemo(() => (employee ? employeeAttendanceStats(db, employee.id) : null), [db, employee]);
  const map = useMemo(() => new Map((stats?.records ?? []).map((r) => [r.date, r] as const)), [stats]);
  const heads = user ? headedDepartmentIds(user, db) : [];
  const team = db.employees.filter((e) => isCurrent(e) && e.id !== employee?.id && (heads.includes(e.departmentId) || e.reportingManagerId === employee?.id));
  if (!employee || !stats) return <EmptyState title="No employee record linked" />;
  const month = summarize(stats.records.filter((r) => r.date.startsWith(period)));
  const t = today();
  return (
    <div className="space-y-4">
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Attendance' }]} title="My attendance" description="Your attendance is recorded by HR in the daily register" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Overall attendance" value={formatPercent(stats.rate)} tone="success" hint="(Present + late) ÷ (present + late + absent) across all recorded days." />
        <StatCard label="Present this month" value={month.present} tone="success" />
        <StatCard label="Late this month" value={month.late} tone="warning" />
        <StatCard label="Leave days this month" value={month.on_leave} tone="violet" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2"><CardContent className="pt-5"><MonthCalendar period={period} onPeriodChange={setPeriod} records={map} holidays={db.settings.holidays} /></CardContent></Card>
        <Card>
          <CardHeader title="Recent records" />
          <ul className="divide-y border-t">
            {[...stats.records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-5 py-2.5 text-sm"><span>{formatDate(r.date)}</span><span className="flex items-center gap-3"><span className="tabular text-xs text-muted-foreground">{r.checkIn ?? ''}</span><StatusBadge status={r.status} /></span></li>
            ))}
          </ul>
        </Card>
      </div>
      {team.length > 0 && (
        <Card>
          <CardHeader title="My team today" description={`${formatWeekday(t)} · read-only`} />
          <DataTable
            rows={team}
            getRowId={(e) => e.id}
            dense
            columns={[
              { key: 'n', header: 'Employee', sortValue: (e) => fullName(e), cell: (e) => <Link to={`/employees/${e.id}?tab=attendance`} className="flex items-center gap-2 hover:text-primary"><Avatar name={fullName(e)} color={e.avatarColor} size="xs" />{fullName(e)}</Link> },
              { key: 's', header: 'Status', cell: (e) => <StatusBadge status={db.attendance[attendanceKey(e.id, t)]?.status ?? (approvedLeaveOn(db, e.id, t) ? 'on_leave' : 'unmarked')} /> },
              { key: 'r', header: '30-day rate', align: 'right', cell: (e) => <span className="tabular">{formatPercent(employeeAttendanceStats(db, e.id, addDays(t, -30)).rate)}</span> },
            ]}
          />
        </Card>
      )}
      <DemoBanner className="text-xs"><CalendarCheck className="size-4 shrink-0" /> Spotted an error in your attendance? Contact HR — corrections are made in the register and recorded in the audit log.</DemoBanner>
    </div>
  );
}

