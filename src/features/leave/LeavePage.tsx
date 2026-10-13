import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, CalendarDays, Check, Download, FilterX, Inbox, Pencil, Plus, X, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, canReviewLeaveFor, isTeamManager } from '@/lib/permissions';
import { addDays, formatDate, formatDateTime, formatShortDate, rangesOverlap, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { pluralize } from '@/lib/utils';
import { leaveSchema, type LeaveInput } from '@/data/schemas';
import { applyLeave, cancelLeave, countLeaveDays, fullName, getBalance, overlappingRequests, reviewLeave, SICK_BACKDATE_DAYS, updateLeave, visibleLeaveRequests } from '@/data/services';
import { leaveTypeLabel, LEAVE_TYPES, type LeaveRequest, type LeaveType } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, Toolbar } from '@/components/page';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, SheetContent } from '@/components/ui/dialog';
import { DataTable, type Column } from '@/components/data-table';
import { useConfirm } from '@/components/ui/confirm';

function LeaveFormDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: LeaveRequest | null }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const defaults: LeaveInput = editing
    ? { type: editing.type, startDate: editing.startDate, endDate: editing.endDate, reason: editing.reason }
    : { type: 'casual', startDate: addDays(today(), 1), endDate: addDays(today(), 1), reason: '' };
  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<LeaveInput>({ resolver: zodResolver(leaveSchema), defaultValues: defaults });
  useEffect(() => {
    if (open) reset(defaults);
  }, [open, editing]);
  const [type, start, end] = watch(['type', 'startDate', 'endDate']);
  const days = start && end && end >= start ? countLeaveDays(db, start, end) : 0;
  const year = Number((start || today()).slice(0, 4));
  const bal = user?.employeeId ? getBalance(db, user.employeeId, type as LeaveType, year) : null;
  const reclaim = editing && editing.type === type ? editing.days : 0;
  const available = bal ? bal.available + reclaim : 0;
  const over = days > available;

  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => (editing ? updateLeave(user, editing.id, v) : applyLeave(user, v)), editing ? 'Leave request updated' : (d) => `Leave request ${d.id} submitted for approval`);
    if (r.ok) onOpenChange(false);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={editing ? `Edit request ${editing.id}` : 'Apply for leave'}
        description="Weekends and college holidays are not counted. Your reporting manager and HR will be notified."
        footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'} disabled={over || days === 0}>{editing ? 'Save changes' : 'Submit request'}</Button></>}
      >
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Leave type" htmlFor="lv-type" required>
            <Select id="lv-type" {...register('type')}>
              {LEAVE_TYPES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" htmlFor="lv-start" error={errors.startDate?.message} required hint={type === 'sick' ? `Sick leave may be back-dated up to ${SICK_BACKDATE_DAYS} days` : undefined}>
              <Input id="lv-start" type="date" min={type === 'sick' ? addDays(today(), -SICK_BACKDATE_DAYS) : today()} {...register('startDate', { onChange: (e) => { if (!end || end < e.target.value) setValue('endDate', e.target.value); } })} aria-invalid={!!errors.startDate} />
            </Field>
            <Field label="End date" htmlFor="lv-end" error={errors.endDate?.message} required>
              <Input id="lv-end" type="date" min={start} {...register('endDate')} aria-invalid={!!errors.endDate} />
            </Field>
          </div>
          <div className={`rounded-lg border p-3 text-sm ${over ? 'border-destructive/40 bg-destructive/5' : 'bg-muted/40'}`} aria-live="polite">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Working days requested</span>
              <strong className="tabular">{days}</strong>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">{leaveTypeLabel(type as LeaveType)} available ({year})</span>
              <strong className="tabular">{available}</strong>
            </div>
            {over && <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-destructive"><AlertTriangle className="size-3.5" /> Requested days exceed your available balance.</p>}
            {days === 0 && start && end >= start && <p className="mt-2 text-xs text-muted-foreground">The selected range contains no working days.</p>}
          </div>
          <Field label="Reason" htmlFor="lv-reason" error={errors.reason?.message} required>
            <Textarea id="lv-reason" rows={3} placeholder="Briefly describe the reason for leave" {...register('reason')} aria-invalid={!!errors.reason} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequestSheet({ request, onClose, onEdit }: { request: LeaveRequest | null; onClose: () => void; onEdit: (r: LeaveRequest) => void }) {
  const { user, db } = useAuth();
  const confirm = useConfirm();
  const { pending, run } = useAsyncAction();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  useEffect(() => {
    setComment('');
    setCommentError(null);
  }, [request?.id]);
  if (!request || !user) return null;
  const emp = db.employees.find((e) => e.id === request.employeeId);
  if (!emp) return null;
  const reviewer = db.users.find((u) => u.id === request.reviewedBy);
  const canReview = request.status === 'pending' && canReviewLeaveFor(user, emp, db);
  const own = request.employeeId === user.employeeId;
  const overlaps = overlappingRequests(db, request);
  const bal = getBalance(db, emp.id, request.type, Number(request.startDate.slice(0, 4)));
  const dept = db.departments.find((d) => d.id === emp.departmentId);

  const decide = async (decision: 'approved' | 'rejected') => {
    if (decision === 'rejected' && comment.trim().length < 3) {
      setCommentError('A comment is required when rejecting a request.');
      return;
    }
    const r = await run(decision, () => reviewLeave(user, request.id, decision, comment), `Request ${decision} — ${fullName(emp)} has been notified`);
    if (r.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={`Leave request ${request.id}`}
        description={`${leaveTypeLabel(request.type)} · ${pluralize(request.days, 'working day')}`}
        footer={
          canReview ? (
            <>
              <Button variant="outline" className="text-destructive" onClick={() => decide('rejected')} loading={pending === 'rejected'} disabled={!!pending}><X /> Reject</Button>
              <Button variant="success" onClick={() => decide('approved')} loading={pending === 'approved'} disabled={!!pending}><Check /> Approve</Button>
            </>
          ) : own && request.status === 'pending' ? (
            <>
              <Button
                variant="outline"
                className="text-destructive"
                loading={pending === 'cancel'}
                onClick={async () => {
                  if (!(await confirm({ title: 'Cancel this leave request?', description: 'The reserved days will be released back to your balance.', confirmLabel: 'Cancel request', cancelLabel: 'Keep request', destructive: true }))) return;
                  const r = await run('cancel', () => cancelLeave(user, request.id), 'Leave request cancelled');
                  if (r.ok) onClose();
                }}
              >
                <XCircle /> Cancel request
              </Button>
              <Button variant="outline" onClick={() => onEdit(request)}><Pencil /> Edit</Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-5">
          <Link to={`/employees/${emp.id}?tab=leave`} className="flex items-center gap-3 rounded-lg border p-3 transition hover:bg-muted/50">
            <Avatar name={fullName(emp)} color={emp.avatarColor} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{fullName(emp)}</p>
              <p className="text-xs text-muted-foreground">{db.designations.find((d) => d.id === emp.designationId)?.title} · {dept?.name}</p>
            </div>
            <StatusBadge status={request.status} />
          </Link>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">From</dt><dd className="font-medium">{formatDate(request.startDate)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">To</dt><dd className="font-medium">{formatDate(request.endDate)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Applied</dt><dd>{formatDateTime(request.appliedAt)}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Working days</dt><dd className="tabular font-medium">{request.days}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Reason</dt><dd className="mt-0.5 rounded-md bg-muted/50 p-2.5">{request.reason}</dd></div>
          </dl>
          <div className="rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium">{leaveTypeLabel(request.type)} balance</span><span className="tabular text-muted-foreground">{bal.allocated - bal.used} of {bal.allocated} remaining</span></div>
            <Progress value={(bal.used / Math.max(1, bal.allocated)) * 100} />
            <p className="mt-1.5 text-xs text-muted-foreground">{bal.used} used · {bal.pending} pending (incl. this request{request.status !== 'pending' ? ' — not pending' : ''}). Balance is deducted only once, on approval.</p>
          </div>
          {(canReview || can(user, 'leave.review_all') || isTeamManager(user, db)) && !own && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">{overlaps.length ? <AlertTriangle className="size-4 text-amber-500" /> : <Check className="size-4 text-emerald-500" />} Overlapping leave in {dept?.code}</p>
              {overlaps.length ? (
                <ul className="space-y-1.5">
                  {overlaps.map((o) => {
                    const oe = db.employees.find((e) => e.id === o.employeeId)!;
                    return (
                      <li key={o.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                        <span>{fullName(oe)} <span className="text-xs text-muted-foreground">· {formatShortDate(o.startDate)} – {formatShortDate(o.endDate)}</span></span>
                        <StatusBadge status={o.status} />
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No other colleagues in the department are on leave during these dates.</p>
              )}
            </div>
          )}
          {request.status !== 'pending' && request.status !== 'cancelled' && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="font-medium">Reviewed by {reviewer?.name ?? '—'}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(request.reviewedAt)}</p>
              {request.reviewComment && <p className="mt-2 rounded bg-muted/50 p-2">“{request.reviewComment}”</p>}
            </div>
          )}
          {canReview && (
            <Field label="Reviewer comment" htmlFor="lv-comment" error={commentError ?? undefined} hint="Required when rejecting; shared with the employee">
              <Textarea id="lv-comment" rows={3} value={comment} onChange={(e) => { setComment(e.target.value); setCommentError(null); }} aria-invalid={!!commentError} />
            </Field>
          )}
          {own && request.status === 'pending' && <p className="text-xs text-muted-foreground">You can edit or cancel this request until it is reviewed.</p>}
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function LeavePage() {
  const { user, db, employee } = useAuth();
  const [params, setParams] = useSearchParams();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const reviewer = !!user && (can(user, 'leave.review_all') || isTeamManager(user, db));
  const defaultTab = employee && !can(user, 'leave.review_all') ? 'mine' : 'approvals';
  const tab = params.get('tab') ?? defaultTab;
  const requestId = params.get('request');
  const visible = useMemo(() => visibleLeaveRequests(user, db), [user, db]);
  const openRequest = visible.find((r) => r.id === requestId) ?? null;

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (params.get('apply') === '1') {
      setEditing(null);
      setFormOpen(true);
      setParam('apply', null);
    }
  }, [params]);

  useEffect(() => {
    if (requestId && !openRequest) toast.error('That leave request was not found or you do not have access to it.');
  }, [requestId]);

  if (!user) return null;
  const queue = visible.filter((r) => r.status === 'pending' && r.employeeId !== user.employeeId && canReviewLeaveFor(user, db.employees.find((e) => e.id === r.employeeId)!, db));

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Leave management' }]}
        title="Leave management"
        description={reviewer ? 'Apply for leave, review requests and track balances' : 'Apply for leave and track your requests and balances'}
        actions={employee && <Button onClick={() => { setEditing(null); setFormOpen(true); }}><Plus /> Apply for leave</Button>}
      />
      <Tabs value={tab} onValueChange={(t) => setParam('tab', t)}>
        <TabsList>
          {employee && <TabsTrigger value="mine">My leave</TabsTrigger>}
          {reviewer && <TabsTrigger value="approvals">Approvals {queue.length > 0 && <Badge tone="warning" className="ml-1">{queue.length}</Badge>}</TabsTrigger>}
          {reviewer && <TabsTrigger value="all">{can(user, 'leave.review_all') ? 'All requests' : 'Team requests'}</TabsTrigger>}
        </TabsList>
        {employee && (
          <TabsContent value="mine">
            <MyLeave onOpen={(id) => setParam('request', id)} onApply={() => { setEditing(null); setFormOpen(true); }} />
          </TabsContent>
        )}
        {reviewer && (
          <TabsContent value="approvals">
            <RequestsTable rows={queue} onOpen={(id) => setParam('request', id)} mode="queue" />
          </TabsContent>
        )}
        {reviewer && (
          <TabsContent value="all">
            <RequestsTable rows={visible} onOpen={(id) => setParam('request', id)} mode="all" initialStatus={params.get('status') ?? ''} />
          </TabsContent>
        )}
      </Tabs>
      <RequestSheet request={openRequest} onClose={() => setParam('request', null)} onEdit={(r) => { setParam('request', null); setEditing(r); setFormOpen(true); }} />
      <LeaveFormDialog open={formOpen} onOpenChange={setFormOpen} editing={editing} />
    </div>
  );
}

function MyLeave({ onOpen, onApply }: { onOpen: (id: string) => void; onApply: () => void }) {
  const { user, db, employee } = useAuth();
  const year = Number(today().slice(0, 4));
  if (!employee || !user) return null;
  const mine = db.leaveRequests.filter((r) => r.employeeId === employee.id);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {LEAVE_TYPES.map((l) => {
          const b = getBalance(db, employee.id, l.value, year);
          return (
            <Card key={l.value} className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{l.label}</p>
              <p className="tabular mt-1 text-2xl font-semibold">{b.available}<span className="text-sm font-normal text-muted-foreground"> / {b.allocated}</span></p>
              <Progress className="mt-2" value={((b.used + b.pending) / Math.max(1, b.allocated)) * 100} tone={b.available <= 1 ? 'warning' : 'primary'} />
              <p className="mt-1.5 text-[11px] text-muted-foreground">{b.used} used · {b.pending} pending</p>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader title="My requests" description={`${mine.filter((r) => r.status === 'pending').length} pending`} />
        <DataTable
          rows={mine}
          getRowId={(r) => r.id}
          onRowClick={(r) => onOpen(r.id)}
          initialSort={{ key: 'applied', dir: 'desc' }}
          columns={[
            { key: 'id', header: 'Request', cell: (r) => <span className="tabular text-muted-foreground">{r.id}</span> },
            { key: 'type', header: 'Type', sortValue: (r) => r.type, cell: (r) => <span className="font-medium">{leaveTypeLabel(r.type)}</span> },
            { key: 'dates', header: 'Dates', sortValue: (r) => r.startDate, cell: (r) => <span className="whitespace-nowrap">{formatShortDate(r.startDate)}{r.endDate !== r.startDate && ` – ${formatShortDate(r.endDate)}`}</span> },
            { key: 'days', header: 'Days', align: 'right', cell: (r) => <span className="tabular">{r.days}</span> },
            { key: 'applied', header: 'Applied', hideBelow: 'md', sortValue: (r) => r.appliedAt, cell: (r) => <span className="text-muted-foreground">{formatDate(r.appliedAt.slice(0, 10))}</span> },
            { key: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
          ]}
          empty={<EmptyState icon={<CalendarDays />} title="No leave requests yet" description="When you apply for leave it will appear here." action={<Button size="sm" onClick={onApply}><Plus /> Apply for leave</Button>} />}
        />
      </Card>
    </div>
  );
}

function RequestsTable({ rows, onOpen, mode, initialStatus = '' }: { rows: LeaveRequest[]; onOpen: (id: string) => void; mode: 'queue' | 'all'; initialStatus?: string }) {
  const { user, db } = useAuth();
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const emp = (id: string) => db.employees.find((e) => e.id === id);
  const filtered = rows.filter((r) => {
    const e = emp(r.employeeId);
    if (!e) return false;
    if (q && !`${fullName(e)} ${r.id} ${e.id}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (dept && e.departmentId !== dept) return false;
    if (status && r.status !== status) return false;
    if (type && r.type !== type) return false;
    if ((from || to) && !rangesOverlap(r.startDate, r.endDate, from || '0000-01-01', to || '9999-12-31')) return false;
    return true;
  });
  const hasFilters = q || dept || status || type || from || to;
  const columns: Column<LeaveRequest>[] = [
    { key: 'emp', header: 'Employee', sortValue: (r) => (emp(r.employeeId) ? fullName(emp(r.employeeId)!) : ''), cell: (r) => { const e = emp(r.employeeId)!; return <span className="flex items-center gap-2.5"><Avatar name={fullName(e)} color={e.avatarColor} size="sm" /><span><span className="block font-medium">{fullName(e)}</span><span className="block text-xs text-muted-foreground">{db.departments.find((d) => d.id === e.departmentId)?.code} · {r.id}</span></span></span>; } },
    { key: 'type', header: 'Type', sortValue: (r) => r.type, cell: (r) => leaveTypeLabel(r.type) },
    { key: 'dates', header: 'Dates', sortValue: (r) => r.startDate, cell: (r) => <span className="whitespace-nowrap">{formatShortDate(r.startDate)}{r.endDate !== r.startDate && ` – ${formatShortDate(r.endDate)}`}</span> },
    { key: 'days', header: 'Days', align: 'right', sortValue: (r) => r.days, cell: (r) => <span className="tabular">{r.days}</span> },
    { key: 'overlap', header: 'Overlaps', hideBelow: 'lg', cell: (r) => { const n = r.status === 'pending' ? overlappingRequests(db, r).length : 0; return n ? <Badge tone="warning"><AlertTriangle className="size-3" /> {n}</Badge> : <span className="text-muted-foreground">—</span>; } },
    { key: 'applied', header: 'Applied', hideBelow: 'md', sortValue: (r) => r.appliedAt, cell: (r) => <span className="whitespace-nowrap text-muted-foreground">{formatDate(r.appliedAt.slice(0, 10))}</span> },
    { key: 'status', header: 'Status', sortValue: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
    { key: 'act', header: <span className="sr-only">Open</span>, align: 'right', cell: (r) => <Button size="sm" variant={r.status === 'pending' && mode === 'queue' ? 'default' : 'ghost'} onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>{r.status === 'pending' && mode === 'queue' ? 'Review' : 'View'}</Button> },
  ];
  return (
    <Card>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search employee or request" className="sm:w-60" />
        <Select aria-label="Department" className="sm:w-48" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="">All departments</option>
          {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </Select>
        {mode === 'all' && (
          <Select aria-label="Status" className="sm:w-36" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {['pending', 'approved', 'rejected', 'cancelled'].map((s) => <option key={s} value={s}>{s[0]!.toUpperCase() + s.slice(1)}</option>)}
          </Select>
        )}
        <Select aria-label="Leave type" className="sm:w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {LEAVE_TYPES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </Select>
        <div className="flex items-center gap-1.5">
          <Input type="date" aria-label="From date" className="w-[150px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" aria-label="To date" className="w-[150px]" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        {hasFilters && <Button variant="ghost" size="sm" onClick={() => { setQ(''); setDept(''); setStatus(''); setType(''); setFrom(''); setTo(''); }}><FilterX /> Clear</Button>}
        {mode === 'all' && can(user, 'reports.view') && (
          <Button variant="outline" size="sm" className="sm:ml-auto" disabled={!filtered.length} onClick={() => { exportCsv(`leave-requests-${today()}.csv`, filtered, [{ header: 'Request', value: (r) => r.id }, { header: 'Employee ID', value: (r) => r.employeeId }, { header: 'Employee', value: (r) => (emp(r.employeeId) ? fullName(emp(r.employeeId)!) : '') }, { header: 'Department', value: (r) => db.departments.find((d) => d.id === emp(r.employeeId)?.departmentId)?.name }, { header: 'Type', value: (r) => leaveTypeLabel(r.type) }, { header: 'Start', value: (r) => r.startDate }, { header: 'End', value: (r) => r.endDate }, { header: 'Days', value: (r) => r.days }, { header: 'Status', value: (r) => r.status }, { header: 'Reason', value: (r) => r.reason }, { header: 'Reviewer comment', value: (r) => r.reviewComment }]); toast.success(`Exported ${filtered.length} requests`); }}>
            <Download /> CSV
          </Button>
        )}
      </Toolbar>
      <DataTable
        rows={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => onOpen(r.id)}
        initialSort={mode === 'queue' ? { key: 'dates', dir: 'asc' } : { key: 'applied', dir: 'desc' }}
        empty={mode === 'queue' ? <EmptyState icon={<Inbox />} title="You’re all caught up" description="There are no leave requests awaiting your review." /> : <EmptyState icon={<CalendarDays />} title="No requests match these filters" />}
      />
    </Card>
  );
}
