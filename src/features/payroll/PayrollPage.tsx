import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, BadgeIndianRupee, Calculator, CheckCircle2, Download, FileText, Lock, PauseCircle, Pencil, Play, Printer, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { addMonths, currentPeriod, formatDate, formatPeriod, formatPeriodLong, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { formatCurrency, formatCurrencyCompact, sum } from '@/lib/utils';
import { deductionsOf, grossOf } from '@/data/payroll-calc';
import { payrollSchema, type PayrollInput } from '@/data/schemas';
import { fullName, generatePayroll, setPayrollStatus, updatePayroll, visiblePayroll } from '@/data/services';
import { PAYROLL_STATUSES, type PayrollRecord, type PayrollStatus } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, StatCard, Toolbar } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Avatar, DemoBanner, EmptyState } from '@/components/ui/misc';
import { StatusBadge } from '@/components/status';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { useConfirm } from '@/components/ui/confirm';
import { C, ChartTooltip, axisProps } from '@/components/charts/chart-kit';
import { downloadPayslip, printPayslip } from './payslip';

function DemoNotice() {
  return (
    <DemoBanner className="mb-5">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span><strong>Demo payroll.</strong> Salaries and deductions are fictional and use a simplified structure (HRA 20%, DA 12%, PF 12%, slab TDS). Connect a secure, verified payroll system before processing real salaries.</span>
    </DemoBanner>
  );
}

export function PayrollPage() {
  const { user } = useAuth();
  if (!user) return null;
  return can(user, 'payroll.view_all') ? <PayrollAdmin /> : <MyPayslips />;
}

function EditPayrollDialog({ record, onClose }: { record: PayrollRecord | null; onClose: () => void }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<PayrollInput>({ resolver: zodResolver(payrollSchema) });
  useEffect(() => {
    if (record) reset({ basic: record.basic, hra: record.hra, da: record.da, otherAllowances: record.otherAllowances, pf: record.pf, tax: record.tax, otherDeductions: record.otherDeductions });
  }, [record, reset]);
  const v = watch();
  const n = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  const gross = n(v.basic) + n(v.hra) + n(v.da) + n(v.otherAllowances);
  const ded = n(v.pf) + n(v.tax) + n(v.otherDeductions);
  const net = gross - ded;
  if (!record) return null;
  const emp = db.employees.find((e) => e.id === record.employeeId);
  const submit = handleSubmit(async (vals) => {
    const r = await run('save', () => updatePayroll(user, record.id, vals), 'Payroll record updated');
    if (r.ok) onClose();
  });
  const money = (k: keyof PayrollInput, label: string) => (
    <Field label={label} htmlFor={`pay-${k}`} error={errors[k]?.message}>
      <Input id={`pay-${k}`} type="number" min={0} step={100} inputMode="numeric" {...register(k)} aria-invalid={!!errors[k]} />
    </Field>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={`Adjust payroll · ${emp ? fullName(emp) : record.employeeId}`}
        description={`${formatPeriodLong(record.period)} · net pay recalculates automatically`}
        footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} loading={pending === 'save'} disabled={net < 0}>Save</Button></>}
      >
        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
            {money('basic', 'Basic salary')}
            {money('hra', 'House rent allowance')}
            {money('da', 'Dearness allowance')}
            {money('otherAllowances', 'Other allowances')}
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Deductions</p>
            {money('pf', 'Provident fund')}
            {money('tax', 'Income tax (TDS)')}
            {money('otherDeductions', 'Professional tax & other')}
            <div className="rounded-lg border bg-muted/40 p-3 text-sm" aria-live="polite">
              <div className="flex justify-between"><span className="text-muted-foreground">Gross</span><span className="tabular">{formatCurrency(gross)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Deductions</span><span className="tabular">− {formatCurrency(ded)}</span></div>
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Net pay</span><span className={`tabular ${net < 0 ? 'text-destructive' : ''}`}>{formatCurrency(net)}</span></div>
              {net < 0 && <p className="mt-1 text-xs text-destructive">Deductions cannot exceed gross salary.</p>}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PayrollAdmin() {
  const { user, db } = useAuth();
  const confirm = useConfirm();
  const { pending, run } = useAsyncAction();
  const [period, setPeriod] = useState(currentPeriod());
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<PayrollRecord | null>(null);
  const manage = can(user, 'payroll.manage');
  const all = useMemo(() => visiblePayroll(user, db), [user, db]);
  const emp = (id: string) => db.employees.find((e) => e.id === id);

  const periodRows = all.filter((p) => p.period === period);
  const rows = periodRows.filter((p) => {
    const e = emp(p.employeeId);
    if (!e) return false;
    if (dept && e.departmentId !== dept) return false;
    if (status && p.status !== status) return false;
    if (q && !`${fullName(e)} ${e.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const totals = { gross: sum(periodRows.map(grossOf)), ded: sum(periodRows.map(deductionsOf)), net: sum(periodRows.map((p) => p.net)), paid: periodRows.filter((p) => p.status === 'Paid').length };
  const deptExpense = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of periodRows) {
      const d = emp(p.employeeId)?.departmentId;
      if (d) m.set(d, (m.get(d) ?? 0) + grossOf(p));
    }
    return [...m.entries()].map(([id, v]) => ({ code: db.departments.find((d) => d.id === id)?.code ?? id, name: db.departments.find((d) => d.id === id)?.name, value: v })).sort((a, b) => b.value - a.value);
  }, [periodRows.length, period, db.payroll]);
  const trend = useMemo(() => Array.from({ length: 6 }, (_, i) => addMonths(currentPeriod(), i - 5)).map((p) => ({ label: formatPeriod(p), net: sum(all.filter((x) => x.period === p).map((x) => x.net)) })), [all]);

  const changeStatus = async (s: PayrollStatus, ids = [...selected]) => {
    if (s === 'Paid' && !(await confirm({ title: `Mark ${ids.length} record(s) as paid?`, description: 'Paid records are locked and cannot be edited afterwards. Employees will be notified that their payslip is available.', confirmLabel: 'Mark as paid' }))) return;
    const r = await run('status', () => setPayrollStatus(user, ids, s), (n) => `${n} record(s) marked ${s}`);
    if (r.ok) setSelected(new Set());
  };

  const generate = async () => {
    if (!(await confirm({ title: `Run payroll for ${formatPeriodLong(period)}?`, description: 'Creates a pending record for every eligible employee who does not already have one for this period, using their current basic salary.', confirmLabel: 'Generate payroll' }))) return;
    await run('gen', () => generatePayroll(user, period), (n) => `Generated ${n} payroll record(s)`);
  };

  const periods = Array.from({ length: 13 }, (_, i) => addMonths(currentPeriod(), -i));

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Payroll' }]}
        title="Payroll"
        description="Monthly payroll records, department expenses and payslips"
        actions={
          <>
            <Button variant="outline" disabled={!rows.length} onClick={() => { exportCsv(`payroll-${period}.csv`, rows, [{ header: 'Employee ID', value: (p) => p.employeeId }, { header: 'Employee', value: (p) => (emp(p.employeeId) ? fullName(emp(p.employeeId)!) : '') }, { header: 'Department', value: (p) => db.departments.find((d) => d.id === emp(p.employeeId)?.departmentId)?.name }, { header: 'Pay Period', value: (p) => p.period }, { header: 'Basic', value: (p) => p.basic }, { header: 'Allowances', value: (p) => p.hra + p.da + p.otherAllowances }, { header: 'Deductions', value: (p) => deductionsOf(p) }, { header: 'Net Salary', value: (p) => p.net }, { header: 'Status', value: (p) => p.status }, { header: 'Paid On', value: (p) => p.paidOn }]); toast.success(`Exported ${rows.length} payroll rows`); }}>
              <Download /> Export CSV
            </Button>
            {manage && <Button onClick={generate} loading={pending === 'gen'}><Play /> Run payroll</Button>}
          </>
        }
      />
      <DemoNotice />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gross payroll" value={formatCurrencyCompact(totals.gross)} icon={<BadgeIndianRupee />} hint="Basic + HRA + DA + other allowances for the selected period." trend={formatPeriodLong(period)} />
        <StatCard label="Total deductions" value={formatCurrencyCompact(totals.ded)} icon={<Calculator />} tone="warning" hint="Provident fund + TDS + professional tax." />
        <StatCard label="Net payout" value={formatCurrencyCompact(totals.net)} icon={<Wallet />} tone="success" hint="Gross minus deductions — the amount credited to employees." />
        <StatCard label="Records paid" value={`${totals.paid} / ${periodRows.length}`} icon={<CheckCircle2 />} tone="info" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Department-wise payroll expense" description={`Gross pay · ${formatPeriodLong(period)}`} />
          <CardContent>
            <div className="h-[230px]">
              {deptExpense.length ? (
                <ResponsiveContainer>
                  <BarChart data={deptExpense} margin={{ left: 0, right: 8, top: 8 }}>
                    <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="code" {...axisProps} interval={0} fontSize={10} />
                    <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={64} />
                    <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} labelFormatter={(c) => deptExpense.find((d) => d.code === c)?.name ?? c} />
                    <Bar dataKey="value" name="Gross pay" fill={C.c1} radius={[4, 4, 0, 0]} maxBarSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={<Wallet />} title="No payroll for this period" />
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader title="Monthly net payout" description="Last 6 months" />
          <CardContent>
            <div className="h-[230px]">
              <ResponsiveContainer>
                <BarChart data={trend} margin={{ left: 0, right: 8, top: 8 }}>
                  <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" {...axisProps} />
                  <YAxis {...axisProps} tickFormatter={(v) => formatCurrencyCompact(v)} width={64} />
                  <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
                  <Bar dataKey="net" name="Net payout" fill={C.c3} radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <Toolbar>
          <Select aria-label="Pay period" className="sm:w-40" value={period} onChange={(e) => { setPeriod(e.target.value); setSelected(new Set()); }}>
            {periods.map((p) => <option key={p} value={p}>{formatPeriod(p)}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search employee" className="sm:w-56" />
          <Select aria-label="Department" className="sm:w-52" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
          <Select aria-label="Payment status" className="sm:w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {PAYROLL_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Toolbar>
        {selected.size > 0 && manage && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/40 px-4 py-2 text-sm animate-slide-up">
            <span className="font-medium">{selected.size} selected</span>
            <Button size="sm" variant="outline" onClick={() => changeStatus('Processed')} loading={pending === 'status'}>Mark processed</Button>
            <Button size="sm" variant="success" onClick={() => changeStatus('Paid')} loading={pending === 'status'}><CheckCircle2 /> Mark paid</Button>
            <Button size="sm" variant="outline" onClick={() => changeStatus('On Hold')} loading={pending === 'status'}><PauseCircle /> Hold</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
          </div>
        )}
        <DataTable
          rows={rows}
          getRowId={(p) => p.id}
          selectable={manage}
          selected={selected}
          onSelectedChange={setSelected}
          initialSort={{ key: 'emp', dir: 'asc' }}
          columns={[
            { key: 'emp', header: 'Employee', sortValue: (p) => (emp(p.employeeId) ? fullName(emp(p.employeeId)!) : ''), cell: (p) => { const e = emp(p.employeeId)!; return <span className="flex items-center gap-2.5 whitespace-nowrap"><Avatar name={fullName(e)} color={e.avatarColor} size="sm" /><span><span className="block font-medium">{fullName(e)}</span><span className="block text-xs text-muted-foreground">{e.id}</span></span></span>; } },
            { key: 'dept', header: 'Department', hideBelow: 'xl', sortValue: (p) => db.departments.find((d) => d.id === emp(p.employeeId)?.departmentId)?.code ?? '', cell: (p) => <span className="text-muted-foreground">{db.departments.find((d) => d.id === emp(p.employeeId)?.departmentId)?.code}</span> },
            { key: 'period', header: 'Period', hideBelow: 'xl', cell: (p) => <span className="whitespace-nowrap">{formatPeriod(p.period)}</span> },
            { key: 'basic', header: 'Basic', align: 'right', hideBelow: 'md', sortValue: (p) => p.basic, cell: (p) => <span className="tabular">{formatCurrency(p.basic)}</span> },
            { key: 'allow', header: 'Allowances', align: 'right', hideBelow: 'lg', sortValue: (p) => p.hra + p.da + p.otherAllowances, cell: (p) => <span className="tabular">{formatCurrency(p.hra + p.da + p.otherAllowances)}</span> },
            { key: 'ded', header: 'Deductions', align: 'right', hideBelow: 'lg', sortValue: deductionsOf, cell: (p) => <span className="tabular text-muted-foreground">− {formatCurrency(deductionsOf(p))}</span> },
            { key: 'net', header: 'Net salary', align: 'right', sortValue: (p) => p.net, cell: (p) => <span className="tabular font-semibold">{formatCurrency(p.net)}</span> },
            { key: 'status', header: 'Status', sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
            {
              key: 'act',
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              cell: (p) => (
                <div className="flex justify-end gap-0.5">
                  <Button variant="ghost" size="icon-sm" aria-label="Download payslip" title="Download payslip" onClick={() => { downloadPayslip(db, p); toast.success('Demo payslip downloaded'); }}><FileText /></Button>
                  {manage && (p.status === 'Paid' ? <span className="flex size-8 items-center justify-center text-muted-foreground" title="Paid records are locked"><Lock className="size-4" /></span> : <Button variant="ghost" size="icon-sm" aria-label={`Edit payroll for ${p.employeeId}`} title="Adjust" onClick={() => setEditing(p)}><Pencil /></Button>)}
                </div>
              ),
            },
          ]}
          empty={<EmptyState icon={<Wallet />} title={periodRows.length ? 'No records match these filters' : `No payroll generated for ${formatPeriodLong(period)}`} action={manage && !periodRows.length ? <Button size="sm" onClick={generate}><Play /> Run payroll</Button> : undefined} />}
        />
      </Card>
      <EditPayrollDialog record={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function MyPayslips() {
  const { user, db } = useAuth();
  const mine = useMemo(() => visiblePayroll(user, db).sort((a, b) => b.period.localeCompare(a.period)), [user, db]);
  const latest = mine[0];
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Payroll' }]} title="My payslips" description="Only your own finalised payroll records are visible to you" />
      <DemoNotice />
      {latest ? (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="bg-sidebar p-5 text-sidebar-foreground lg:col-span-1">
              <p className="text-xs text-sidebar-muted">Latest net pay · {formatPeriodLong(latest.period)}</p>
              <p className="tabular mt-2 text-3xl font-semibold">{formatCurrency(latest.net)}</p>
              <p className="mt-1 text-xs text-sidebar-muted">{latest.paidOn ? `Credited on ${formatDate(latest.paidOn)}` : latest.status}</p>
              <div className="mt-4 flex gap-2">
                <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90" onClick={() => { downloadPayslip(db, latest); toast.success('Payslip downloaded'); }}><Download /> Download</Button>
                <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground" onClick={() => !printPayslip(db, latest) && toast.error('Allow pop-ups to print the payslip')}><Printer /> Print</Button>
              </div>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader title="Breakdown" description={formatPeriodLong(latest.period)} />
              <CardContent className="grid grid-cols-1 gap-6 sm:grid-cols-2 text-sm">
                <dl className="space-y-1.5">
                  {([['Basic', latest.basic], ['HRA', latest.hra], ['DA', latest.da], ['Other allowances', latest.otherAllowances]] as const).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular">{formatCurrency(v)}</dd></div>)}
                  <div className="flex justify-between border-t pt-1.5 font-medium"><dt>Gross</dt><dd className="tabular">{formatCurrency(grossOf(latest))}</dd></div>
                </dl>
                <dl className="space-y-1.5">
                  {([['Provident fund', latest.pf], ['Income tax (TDS)', latest.tax], ['Professional tax', latest.otherDeductions]] as const).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular">− {formatCurrency(v)}</dd></div>)}
                  <div className="flex justify-between border-t pt-1.5 font-medium"><dt>Deductions</dt><dd className="tabular">− {formatCurrency(deductionsOf(latest))}</dd></div>
                </dl>
              </CardContent>
            </Card>
          </div>
          <Card className="mt-4">
            <CardHeader title="Payslip history" />
            <DataTable
              rows={mine}
              getRowId={(p) => p.id}
              initialSort={{ key: 'period', dir: 'desc' }}
              columns={[
                { key: 'period', header: 'Pay period', sortValue: (p) => p.period, cell: (p) => <span className="font-medium">{formatPeriodLong(p.period)}</span> },
                { key: 'gross', header: 'Gross', align: 'right', hideBelow: 'sm', cell: (p) => <span className="tabular">{formatCurrency(grossOf(p))}</span> },
                { key: 'net', header: 'Net', align: 'right', cell: (p) => <span className="tabular font-semibold">{formatCurrency(p.net)}</span> },
                { key: 'status', header: 'Status', cell: (p) => <StatusBadge status={p.status} /> },
                { key: 'dl', header: <span className="sr-only">Download</span>, align: 'right', cell: (p) => <Button size="sm" variant="ghost" onClick={() => { downloadPayslip(db, p); toast.success('Payslip downloaded'); }}><Download /> Payslip</Button> },
              ]}
            />
          </Card>
        </>
      ) : (
        <Card><EmptyState icon={<Wallet />} title="No payslips available yet" description={`Payslips appear once payroll for a period is processed. Current period: ${formatPeriodLong(today().slice(0, 7))}.`} /></Card>
      )}
    </div>
  );
}
