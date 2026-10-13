import { useMemo, useState, useDeferredValue, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Legend as RLegend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { BarChart3, CalendarCheck, CalendarDays, Download, Target, TrendingUp, Users, Wallet, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { addDays, addMonths, formatPeriod, monthEnd, monthStart, rangesOverlap, today, yearsBetween } from '@/lib/dates';
import { exportCsv, type CsvColumn } from '@/lib/csv';
import { cn, formatCurrency, formatCurrencyCompact, formatPercent, sum } from '@/lib/utils';
import { attendanceRate, categoryOf, summarize } from '@/data/metrics';
import { deductionsOf, grossOf } from '@/data/payroll-calc';
import { fullName, workingDaysBetweenSafe } from './helpers';
import { LEAVE_TYPES, REVIEW_STATUSES, type Database, type Employee } from '@/data/types';
import { useSimulatedLoad } from '@/hooks/useSimulatedLoad';
import { PageHeader, StatCard } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { C, ChartTooltip, SERIES, axisProps } from '@/components/charts/chart-kit';

const REPORTS = [
  { id: 'headcount', label: 'Employee headcount', icon: Users, description: 'Headcount by department and staff category as of the end date' },
  { id: 'department', label: 'Department-wise employees', icon: Building2, description: 'Composition, employment types and tenure per department' },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, description: 'Attendance rate and status totals within the date range' },
  { id: 'leave', label: 'Leave utilisation', icon: CalendarDays, description: 'Approved leave days by type and department within the date range' },
  { id: 'payroll', label: 'Payroll expenditure', icon: Wallet, description: 'Gross, deductions and net payroll per pay period' },
  { id: 'joining', label: 'Joining & exit trends', icon: TrendingUp, description: 'Monthly joiners, exits and month-end headcount' },
  { id: 'performance', label: 'Review completion', icon: Target, description: 'Performance review completion by department and cycle' },
] as const;
type ReportId = (typeof REPORTS)[number]['id'];

interface Filters {
  from: string;
  to: string;
  dept: string;
}

const employedOn = (e: Employee, d: string) => e.status !== 'Inactive' && e.joiningDate <= d && (!e.exitDate || e.exitDate >= d);

function Section<T>({ title, description, chart, rows, columns, filename, summary }: { title: string; description: string; chart?: ReactNode; rows: T[]; columns: CsvColumn<T>[]; filename: string; summary?: ReactNode }) {
  return (
    <div className="space-y-4">
      {summary}
      {chart && (
        <Card>
          <CardHeader title={title} description={description} />
          <CardContent><div className="h-[300px]">{chart}</div></CardContent>
        </Card>
      )}
      <Card>
        <CardHeader
          title="Report data"
          description={`${rows.length} row(s)`}
          action={
            <Button size="sm" variant="outline" disabled={!rows.length} onClick={() => { exportCsv(filename, rows, columns); toast.success(`Downloaded ${filename}`); }}>
              <Download /> Download CSV
            </Button>
          }
        />
        {rows.length ? (
          <div className="scrollbar-thin relative overflow-x-auto border-t">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">{columns.map((c) => <th key={c.header} className="whitespace-nowrap px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.header}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30">
                    {columns.map((c) => {
                      const v = c.value(r);
                      return <td key={c.header} className={cn('whitespace-nowrap px-4 py-2', typeof v === 'number' && 'tabular text-right')}>{v ?? '—'}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 200 && <p className="px-4 py-2 text-xs text-muted-foreground">Showing first 200 rows — download the CSV for all {rows.length}.</p>}
          </div>
        ) : (
          <EmptyState icon={<BarChart3 />} title="No data for these filters" description="Widen the date range or choose another department." />
        )}
      </Card>
    </div>
  );
}

function deptsIn(db: Database, f: Filters) {
  return db.departments.filter((d) => (!f.dept || d.id === f.dept) && (d.status === 'active' || db.employees.some((e) => e.departmentId === d.id)));
}

function Headcount({ db, f }: { db: Database; f: Filters }) {
  const rows = deptsIn(db, f).map((d) => {
    const emps = db.employees.filter((e) => e.departmentId === d.id && employedOn(e, f.to));
    const faculty = emps.filter((e) => categoryOf(db, e) === 'faculty').length;
    return { code: d.code, department: d.name, faculty, administrative: emps.length - faculty, total: emps.length };
  }).filter((r) => r.total > 0);
  const total = sum(rows.map((r) => r.total));
  const fac = sum(rows.map((r) => r.faculty));
  return (
    <Section
      title="Headcount by department"
      description={`As of ${f.to}`}
      summary={<div className="grid grid-cols-3 gap-3"><StatCard label="Total headcount" value={total} /><StatCard label="Faculty" value={fac} tone="info" /><StatCard label="Administrative" value={total - fac} tone="violet" /></div>}
      chart={
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="code" {...axisProps} interval={0} fontSize={10} />
            <YAxis {...axisProps} allowDecimals={false} />
            <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
            <RLegend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="faculty" name="Faculty" stackId="a" fill={C.c1} maxBarSize={36} />
            <Bar dataKey="administrative" name="Administrative" stackId="a" fill={C.c2} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      }
      rows={rows}
      filename={`headcount-${f.to}.csv`}
      columns={[{ header: 'Department', value: (r) => r.department }, { header: 'Faculty', value: (r) => r.faculty }, { header: 'Administrative', value: (r) => r.administrative }, { header: 'Total', value: (r) => r.total }]}
    />
  );
}

function DepartmentReport({ db, f }: { db: Database; f: Filters }) {
  const rows = deptsIn(db, f).map((d) => {
    const emps = db.employees.filter((e) => e.departmentId === d.id && employedOn(e, f.to));
    const head = db.employees.find((e) => e.id === d.headId);
    const tenure = emps.length ? sum(emps.map((e) => Math.max(0, yearsBetween(e.joiningDate, f.to)))) / emps.length : 0;
    return {
      department: d.name,
      head: head ? fullName(head) : 'Not assigned',
      total: emps.length,
      faculty: emps.filter((e) => categoryOf(db, e) === 'faculty').length,
      fullTime: emps.filter((e) => e.employmentType === 'Full-time').length,
      contract: emps.filter((e) => e.employmentType !== 'Full-time').length,
      probation: emps.filter((e) => e.status === 'Probation').length,
      tenure: Math.round(tenure * 10) / 10,
      status: d.status,
    };
  });
  return (
    <Section
      title="Average tenure by department"
      description="Years of service among current staff"
      chart={
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 40, right: 16 }}>
            <CartesianGrid horizontal={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis type="number" {...axisProps} />
            <YAxis type="category" dataKey="department" {...axisProps} width={170} fontSize={11} />
            <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip formatter={(v) => `${v} yrs`} />} />
            <Bar dataKey="tenure" name="Avg tenure" fill={C.c3} radius={[0, 4, 4, 0]} maxBarSize={16} />
          </BarChart>
        </ResponsiveContainer>
      }
      rows={rows}
      filename={`department-report-${f.to}.csv`}
      columns={[{ header: 'Department', value: (r) => r.department }, { header: 'Head', value: (r) => r.head }, { header: 'Total', value: (r) => r.total }, { header: 'Faculty', value: (r) => r.faculty }, { header: 'Full-time', value: (r) => r.fullTime }, { header: 'Contract/Part-time/Visiting', value: (r) => r.contract }, { header: 'On probation', value: (r) => r.probation }, { header: 'Avg tenure (yrs)', value: (r) => r.tenure }, { header: 'Status', value: (r) => r.status }]}
    />
  );
}

function AttendanceReport({ db, f }: { db: Database; f: Filters }) {
  const data = useMemo(() => {
    const empDept = new Map(db.employees.map((e) => [e.id, e.departmentId]));
    const recs = Object.values(db.attendance).filter((r) => r.date >= f.from && r.date <= f.to && r.date <= today() && (!f.dept || empDept.get(r.employeeId) === f.dept));
    const byMonth = new Map<string, typeof recs>();
    const byDept = new Map<string, typeof recs>();
    for (const r of recs) {
      const m = r.date.slice(0, 7);
      (byMonth.get(m) ?? byMonth.set(m, []).get(m)!).push(r);
      const d = empDept.get(r.employeeId)!;
      (byDept.get(d) ?? byDept.set(d, []).get(d)!).push(r);
    }
    const trend = [...byMonth.keys()].sort().map((m) => ({ label: formatPeriod(m), rate: Math.round(attendanceRate(byMonth.get(m)!) * 10) / 10 }));
    const rows = db.departments.filter((d) => byDept.has(d.id)).map((d) => { const rs = byDept.get(d.id)!; const s = summarize(rs); return { department: d.name, ...s, rate: Math.round(attendanceRate(rs) * 10) / 10 }; });
    return { trend, rows, total: summarize(recs), rate: attendanceRate(recs) };
  }, [db, f]);
  return (
    <Section
      title="Monthly attendance rate"
      description="(Present + late) ÷ (present + late + absent)"
      summary={<div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><StatCard label="Attendance rate" value={formatPercent(data.rate)} tone="success" /><StatCard label="Present" value={data.total.present} /><StatCard label="Late" value={data.total.late} tone="warning" /><StatCard label="Absent" value={data.total.absent} tone="danger" /><StatCard label="On leave" value={data.total.on_leave} tone="violet" /></div>}
      chart={
        <ResponsiveContainer>
          <AreaChart data={data.trend} margin={{ left: -12, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} domain={[80, 100]} tickFormatter={(v) => `${v}%`} />
            <RTooltip content={<ChartTooltip formatter={(v) => `${v}%`} />} />
            <Area dataKey="rate" name="Attendance rate" stroke={C.c1} fill={C.c1} fillOpacity={0.15} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      }
      rows={data.rows}
      filename={`attendance-report-${f.from}_${f.to}.csv`}
      columns={[{ header: 'Department', value: (r) => r.department }, { header: 'Present', value: (r) => r.present }, { header: 'Late', value: (r) => r.late }, { header: 'Absent', value: (r) => r.absent }, { header: 'On leave', value: (r) => r.on_leave }, { header: 'Attendance %', value: (r) => r.rate }]}
    />
  );
}

function LeaveReport({ db, f }: { db: Database; f: Filters }) {
  const empMap = new Map(db.employees.map((e) => [e.id, e]));
  const reqs = db.leaveRequests.filter((r) => rangesOverlap(r.startDate, r.endDate, f.from, f.to) && (!f.dept || empMap.get(r.employeeId)?.departmentId === f.dept));
  const approved = reqs.filter((r) => r.status === 'approved');
  // Count only the working days of each request that fall inside the range.
  const daysIn = (r: (typeof reqs)[number]) => workingDaysBetweenSafe(r.startDate > f.from ? r.startDate : f.from, r.endDate < f.to ? r.endDate : f.to, db.settings.holidays);
  const rows = deptsIn(db, f).map((d) => {
    const rs = approved.filter((r) => empMap.get(r.employeeId)?.departmentId === d.id);
    const row: Record<string, string | number> = { department: d.code, name: d.name };
    for (const t of LEAVE_TYPES) row[t.value] = sum(rs.filter((r) => r.type === t.value).map(daysIn));
    row.total = sum(rs.map(daysIn));
    row.requests = reqs.filter((r) => empMap.get(r.employeeId)?.departmentId === d.id).length;
    return row;
  }).filter((r) => (r.requests as number) > 0);
  const year = Number(f.to.slice(0, 4));
  const util = LEAVE_TYPES.map((t) => {
    const bals = Object.values(db.leaveBalances).filter((b) => b.year === year && b.type === t.value && (!f.dept || empMap.get(b.employeeId)?.departmentId === f.dept));
    const alloc = sum(bals.map((b) => b.allocated));
    return { label: t.label, pct: alloc ? (sum(bals.map((b) => b.used)) / alloc) * 100 : 0 };
  });
  return (
    <Section
      title="Approved leave days by department"
      description="Stacked by leave type; working days within the selected range"
      summary={
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {util.map((u) => <StatCard key={u.label} label={`${u.label.replace(' Leave', '').replace(' Approved', '')} utilisation`} value={formatPercent(u.pct, 0)} hint={`Approved days ÷ allocated days for ${year}, across employees in scope.`} />)}
        </div>
      }
      chart={
        <ResponsiveContainer>
          <BarChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="department" {...axisProps} interval={0} fontSize={10} />
            <YAxis {...axisProps} allowDecimals={false} />
            <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
            <RLegend wrapperStyle={{ fontSize: 12 }} />
            {LEAVE_TYPES.map((t, i) => <Bar key={t.value} dataKey={t.value} name={t.label.replace(' Leave', '')} stackId="a" fill={SERIES[i]} maxBarSize={36} />)}
          </BarChart>
        </ResponsiveContainer>
      }
      rows={rows}
      filename={`leave-utilisation-${f.from}_${f.to}.csv`}
      columns={[{ header: 'Department', value: (r) => r.name as string }, ...LEAVE_TYPES.map((t) => ({ header: t.label, value: (r: Record<string, string | number>) => r[t.value] as number })), { header: 'Total days', value: (r) => r.total as number }, { header: 'Requests (all statuses)', value: (r) => r.requests as number }]}
    />
  );
}

function PayrollReport({ db, f }: { db: Database; f: Filters }) {
  const empMap = new Map(db.employees.map((e) => [e.id, e]));
  const recs = Object.values(db.payroll).filter((p) => p.period >= f.from.slice(0, 7) && p.period <= f.to.slice(0, 7) && (!f.dept || empMap.get(p.employeeId)?.departmentId === f.dept));
  const periods = [...new Set(recs.map((p) => p.period))].sort();
  const rows = periods.map((p) => {
    const rs = recs.filter((r) => r.period === p);
    return { period: p, label: formatPeriod(p), employees: rs.length, gross: sum(rs.map(grossOf)), deductions: sum(rs.map(deductionsOf)), net: sum(rs.map((r) => r.net)), paid: rs.filter((r) => r.status === 'Paid').length };
  });
  return (
    <Section
      title="Payroll expenditure per period"
      description="Demo payroll data · INR"
      summary={<div className="grid grid-cols-3 gap-3"><StatCard label="Total gross" value={formatCurrencyCompact(sum(rows.map((r) => r.gross)))} /><StatCard label="Total deductions" value={formatCurrencyCompact(sum(rows.map((r) => r.deductions)))} tone="warning" /><StatCard label="Total net" value={formatCurrencyCompact(sum(rows.map((r) => r.net)))} tone="success" /></div>}
      chart={
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={64} />
            <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
            <RLegend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="net" name="Net" stackId="a" fill={C.c1} maxBarSize={40} />
            <Bar dataKey="deductions" name="Deductions" stackId="a" fill={C.c4} radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line dataKey="gross" name="Gross" stroke={C.c5} strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      }
      rows={rows}
      filename={`payroll-expenditure-${f.from}_${f.to}.csv`}
      columns={[{ header: 'Pay period', value: (r) => r.period }, { header: 'Employees', value: (r) => r.employees }, { header: 'Gross (INR)', value: (r) => r.gross }, { header: 'Deductions (INR)', value: (r) => r.deductions }, { header: 'Net (INR)', value: (r) => r.net }, { header: 'Records paid', value: (r) => r.paid }]}
    />
  );
}

function JoiningReport({ db, f }: { db: Database; f: Filters }) {
  const emps = db.employees.filter((e) => !f.dept || e.departmentId === f.dept);
  const rows: { period: string; label: string; joined: number; exited: number; headcount: number }[] = [];
  for (let p = f.from.slice(0, 7), g = 0; p <= f.to.slice(0, 7) && g < 60; p = addMonths(p, 1), g++) {
    const s = monthStart(p);
    const e = monthEnd(p);
    rows.push({ period: p, label: formatPeriod(p), joined: emps.filter((x) => x.joiningDate >= s && x.joiningDate <= e).length, exited: emps.filter((x) => x.exitDate && x.exitDate >= s && x.exitDate <= e).length, headcount: emps.filter((x) => x.joiningDate <= e && (!x.exitDate || x.exitDate > e) && x.status !== 'Inactive').length });
  }
  return (
    <Section
      title="Joiners, exits and headcount"
      description="Month-end headcount excludes inactive records"
      summary={<div className="grid grid-cols-3 gap-3"><StatCard label="Joined" value={sum(rows.map((r) => r.joined))} tone="success" /><StatCard label="Exited" value={sum(rows.map((r) => r.exited))} tone="danger" /><StatCard label="Net change" value={sum(rows.map((r) => r.joined - r.exited))} /></div>}
      chart={
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>
            <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis yAxisId="l" {...axisProps} allowDecimals={false} />
            <YAxis yAxisId="r" orientation="right" {...axisProps} allowDecimals={false} />
            <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
            <RLegend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="joined" name="Joined" fill={C.success} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Bar yAxisId="l" dataKey="exited" name="Exited" fill={C.danger} radius={[4, 4, 0, 0]} maxBarSize={22} />
            <Line yAxisId="r" dataKey="headcount" name="Headcount" stroke={C.c1} strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      }
      rows={rows}
      filename={`joining-exit-${f.from}_${f.to}.csv`}
      columns={[{ header: 'Month', value: (r) => r.period }, { header: 'Joined', value: (r) => r.joined }, { header: 'Exited', value: (r) => r.exited }, { header: 'Month-end headcount', value: (r) => r.headcount }]}
    />
  );
}

function PerformanceReport({ db, f }: { db: Database; f: Filters }) {
  const cycles = [...new Set(db.reviews.map((r) => r.cycle))].sort().reverse();
  const [cycle, setCycle] = useState(cycles[0] ?? '');
  const empMap = new Map(db.employees.map((e) => [e.id, e]));
  const reviews = db.reviews.filter((r) => r.cycle === cycle && (!f.dept || empMap.get(r.employeeId)?.departmentId === f.dept));
  const rows = deptsIn(db, f).map((d) => {
    const rs = reviews.filter((r) => empMap.get(r.employeeId)?.departmentId === d.id);
    const row: Record<string, string | number> = { code: d.code, department: d.name, total: rs.length };
    for (const s of REVIEW_STATUSES) row[s] = rs.filter((r) => r.status === s).length;
    row.completion = rs.length ? Math.round(((row.Completed as number) / rs.length) * 1000) / 10 : 0;
    return row;
  }).filter((r) => (r.total as number) > 0);
  const done = reviews.filter((r) => r.status === 'Completed').length;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <Field label="Review cycle" htmlFor="rep-cycle" className="max-w-xs">
          <Select id="rep-cycle" value={cycle} onChange={(e) => setCycle(e.target.value)}>{cycles.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
      </Card>
      <Section
        title="Completion by department"
        description={cycle}
        summary={<div className="grid grid-cols-3 gap-3"><StatCard label="Reviews" value={reviews.length} /><StatCard label="Completed" value={done} tone="success" /><StatCard label="Completion rate" value={formatPercent(reviews.length ? (done / reviews.length) * 100 : 0, 0)} tone="info" /></div>}
        chart={
          <ResponsiveContainer>
            <BarChart data={rows} margin={{ left: -16, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
              <XAxis dataKey="code" {...axisProps} interval={0} fontSize={10} />
              <YAxis {...axisProps} allowDecimals={false} />
              <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
              <RLegend wrapperStyle={{ fontSize: 12 }} />
              {REVIEW_STATUSES.map((s, i) => <Bar key={s} dataKey={s} stackId="a" fill={[C.muted, C.c2, C.warning, C.success][i]} maxBarSize={36} />)}
            </BarChart>
          </ResponsiveContainer>
        }
        rows={rows}
        filename={`review-completion-${cycle.replace(/\W+/g, '-')}.csv`}
        columns={[{ header: 'Department', value: (r) => r.department as string }, { header: 'Reviews', value: (r) => r.total as number }, ...REVIEW_STATUSES.map((s) => ({ header: s, value: (r: Record<string, string | number>) => r[s] as number })), { header: 'Completion %', value: (r) => r.completion as number }]}
      />
    </div>
  );
}

export function ReportsPage() {
  const { db } = useAuth();
  const [params, setParams] = useSearchParams();
  const report = (REPORTS.find((r) => r.id === params.get('report'))?.id ?? 'headcount') as ReportId;
  const [filters, setFilters] = useState<Filters>({ from: monthStart(addMonths(today().slice(0, 7), -5)), to: today(), dept: '' });
  const deferred = useDeferredValue(filters);
  const ready = useSimulatedLoad('reports', 500);
  const stale = deferred !== filters;
  const meta = REPORTS.find((r) => r.id === report)!;
  const invalid = filters.from > filters.to;
  const presets = [
    { label: 'Last 30 days', from: addDays(today(), -30) },
    { label: 'Last 6 months', from: monthStart(addMonths(today().slice(0, 7), -5)) },
    { label: 'This year', from: `${today().slice(0, 4)}-01-01` },
    { label: 'Last 12 months', from: monthStart(addMonths(today().slice(0, 7), -11)) },
  ];
  const body = {
    headcount: <Headcount db={db} f={deferred} />,
    department: <DepartmentReport db={db} f={deferred} />,
    attendance: <AttendanceReport db={db} f={deferred} />,
    leave: <LeaveReport db={db} f={deferred} />,
    payroll: <PayrollReport db={db} f={deferred} />,
    joining: <JoiningReport db={db} f={deferred} />,
    performance: <PerformanceReport db={db} f={deferred} />,
  }[report];

  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Reports' }]} title="Reports & analytics" description="Every figure is computed live from employee, attendance, leave, payroll and review records" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav aria-label="Reports" className="lg:sticky lg:top-20 lg:self-start">
          <ul className="scrollbar-thin flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
            {REPORTS.map((r) => (
              <li key={r.id} className="shrink-0">
                <button type="button" onClick={() => setParams({ report: r.id }, { replace: true })} aria-current={report === r.id ? 'page' : undefined} className={cn('flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground', report === r.id && 'bg-card text-foreground shadow-card ring-1 ring-border')}>
                  <r.icon className="size-4 shrink-0" /> {r.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{meta.label}</h2>
                <p className="text-sm text-muted-foreground">{meta.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-end">
                <Field label="From" htmlFor="rep-from"><Input id="rep-from" type="date" value={filters.from} max={filters.to} onChange={(e) => e.target.value && setFilters((f) => ({ ...f, from: e.target.value }))} aria-invalid={invalid} /></Field>
                <Field label="To" htmlFor="rep-to"><Input id="rep-to" type="date" value={filters.to} min={filters.from} onChange={(e) => e.target.value && setFilters((f) => ({ ...f, to: e.target.value }))} aria-invalid={invalid} /></Field>
                <Field label="Department" htmlFor="rep-dept" className="col-span-2 sm:w-56">
                  <Select id="rep-dept" value={filters.dept} onChange={(e) => setFilters((f) => ({ ...f, dept: e.target.value }))}>
                    <option value="">All departments</option>
                    {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </Select>
                </Field>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {presets.map((p) => <Button key={p.label} size="sm" variant={filters.from === p.from && filters.to === today() ? 'secondary' : 'ghost'} onClick={() => setFilters((f) => ({ ...f, from: p.from, to: today() }))}>{p.label}</Button>)}
            </div>
            {invalid && <p role="alert" className="mt-2 text-sm text-destructive">The start date must be on or before the end date.</p>}
          </Card>
          {!ready ? (
            <div className="space-y-4" aria-busy="true"><div className="grid grid-cols-3 gap-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[88px]" />)}</div><Skeleton className="h-[360px]" /><Skeleton className="h-64" /></div>
          ) : invalid ? (
            <Card><EmptyState icon={<CalendarDays />} title="Invalid date range" description="Adjust the dates to generate this report." /></Card>
          ) : (
            <div className={cn('transition-opacity', stale && 'opacity-60')}>{body}</div>
          )}
        </div>
      </div>
    </div>
  );
}
