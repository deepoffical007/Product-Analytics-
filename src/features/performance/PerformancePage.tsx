import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { BookOpen, ClipboardCheck, Download, Info, Plus, Star, Target, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, canManageReview, isManagerOf, isTeamManager } from '@/lib/permissions';
import { formatDate, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { formatPercent } from '@/lib/utils';
import { isCurrent } from '@/data/metrics';
import { reviewCreateSchema, type ReviewCreateInput } from '@/data/schemas';
import { createReview, fullName, submitSelfAssessment, updateReviewAsManager, visibleReviews } from '@/data/services';
import { REVIEW_STATUSES, type PerformanceReview, type ReviewStatus } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, StatCard, Toolbar } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Avatar, DemoBanner, EmptyState, Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status';
import { Dialog, DialogContent, SheetContent } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { C, ChartTooltip, axisProps } from '@/components/charts/chart-kit';

const RATING_KEYS = [
  { key: 'teaching', label: 'Teaching & learning', facultyOnly: true },
  { key: 'research', label: 'Research & publications', facultyOnly: true },
  { key: 'service', label: 'Institutional service', facultyOnly: false },
  { key: 'professionalism', label: 'Professional conduct', facultyOnly: false },
] as const;

const weighted = (r: PerformanceReview) => Math.round(r.goals.reduce((a, g) => a + (g.progress * g.weight) / 100, 0));

function NewReviewDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const eligible = useMemo(() => db.employees.filter((e) => isCurrent(e) && e.id !== user?.employeeId && (can(user, 'performance.manage_all') || isManagerOf(user, e, db))).sort((a, b) => fullName(a).localeCompare(fullName(b))), [db, user]);
  const { register, control, handleSubmit, reset, formState: { errors } } = useForm<ReviewCreateInput>({
    resolver: zodResolver(reviewCreateSchema),
    defaultValues: { employeeId: '', cycle: `Mid-Year Review ${today().slice(0, 4)}`, goals: [{ title: '', weight: 50 }, { title: '', weight: 50 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'goals' });
  useEffect(() => {
    if (open) reset({ employeeId: '', cycle: `Mid-Year Review ${today().slice(0, 4)}`, goals: [{ title: '', weight: 50 }, { title: '', weight: 50 }] });
  }, [open, reset]);
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => createReview(user, v), 'Review opened — the employee has been notified');
    if (r.ok) onOpenChange(false);
  });
  const goalsError = (errors.goals as { message?: string; root?: { message?: string } } | undefined)?.root?.message ?? (errors.goals as { message?: string } | undefined)?.message;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Open a performance review" description="Set goals and weights for the review cycle." footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>Create review</Button></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Employee" htmlFor="rv-emp" error={errors.employeeId?.message} required>
              <Select id="rv-emp" {...register('employeeId')} aria-invalid={!!errors.employeeId}>
                <option value="">Select employee</option>
                {eligible.map((e) => <option key={e.id} value={e.id}>{fullName(e)} · {db.departments.find((d) => d.id === e.departmentId)?.code}</option>)}
              </Select>
            </Field>
            <Field label="Review cycle" htmlFor="rv-cycle" error={errors.cycle?.message} required>
              <Input id="rv-cycle" {...register('cycle')} />
            </Field>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Goals & objectives</p>
              <Button type="button" size="sm" variant="ghost" disabled={fields.length >= 6} onClick={() => append({ title: '', weight: 10 })}><Plus /> Add goal</Button>
            </div>
            <div className="space-y-2">
              {fields.map((f, i) => (
                <div key={f.id} className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input aria-label={`Goal ${i + 1}`} placeholder={`Goal ${i + 1}`} {...register(`goals.${i}.title`)} aria-invalid={!!errors.goals?.[i]?.title} />
                    {errors.goals?.[i]?.title && <p className="mt-1 text-xs text-destructive">{errors.goals[i]!.title!.message}</p>}
                  </div>
                  <div className="w-24">
                    <Input aria-label={`Weight for goal ${i + 1} (%)`} type="number" min={5} max={100} {...register(`goals.${i}.weight`)} />
                  </div>
                  <span className="pt-2 text-sm text-muted-foreground">%</span>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Remove goal ${i + 1}`} disabled={fields.length <= 1} onClick={() => remove(i)}><Trash2 /></Button>
                </div>
              ))}
            </div>
            {goalsError && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{goalsError}</p>}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ReviewSheet({ review, onClose }: { review: PerformanceReview; onClose: () => void }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const emp = db.employees.find((e) => e.id === review.employeeId)!;
  const reviewer = db.employees.find((e) => e.id === review.reviewerId);
  const faculty = db.designations.find((d) => d.id === emp.designationId)?.category === 'faculty';
  const managerMode = canManageReview(user, review, emp, db) && review.status !== 'Completed';
  const selfMode = user?.employeeId === review.employeeId && (review.status === 'Not Started' || review.status === 'Self Assessment');

  const [progress, setProgress] = useState<Record<string, number>>({});
  const [ratings, setRatings] = useState(review.ratings);
  const [feedback, setFeedback] = useState(review.managerFeedback);
  const [training, setTraining] = useState(review.trainingNeeds.join(', '));
  const [status, setStatus] = useState<ReviewStatus>(review.status);
  const [selfText, setSelfText] = useState(review.selfAssessment);
  useEffect(() => {
    setProgress(Object.fromEntries(review.goals.map((g) => [g.id, g.progress])));
    setRatings(review.ratings);
    setFeedback(review.managerFeedback);
    setTraining(review.trainingNeeds.join(', '));
    setStatus(review.status);
    setSelfText(review.selfAssessment);
  }, [review]);

  const goalsPayload = review.goals.map((g) => ({ id: g.id, progress: progress[g.id] ?? g.progress }));
  const saveManager = async (target: ReviewStatus) => {
    const r = await run(target === 'Completed' ? 'complete' : 'save', () => updateReviewAsManager(user, review.id, { goals: goalsPayload, ratings, managerFeedback: feedback, trainingNeeds: training.split(',').map((t) => t.trim()).filter(Boolean), status: target }), target === 'Completed' ? 'Review completed and shared with the employee' : 'Review saved');
    if (r.ok && target === 'Completed') onClose();
  };
  const submitSelf = async () => {
    const r = await run('self', () => submitSelfAssessment(user, review.id, selfText, goalsPayload), 'Self-assessment submitted to your reviewer');
    if (r.ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={review.cycle}
        description={`${fullName(emp)} · reviewer ${reviewer ? fullName(reviewer) : '—'}`}
        footer={
          managerMode ? (
            <>
              <Button variant="outline" onClick={() => saveManager(status === 'Completed' ? 'Manager Review' : status)} loading={pending === 'save'}>Save draft</Button>
              <Button onClick={() => saveManager('Completed')} loading={pending === 'complete'}><ClipboardCheck /> Complete review</Button>
            </>
          ) : selfMode ? (
            <Button onClick={submitSelf} loading={pending === 'self'}>Submit self-assessment</Button>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={fullName(emp)} color={emp.avatarColor} />
            <div className="flex-1">
              <Link to={`/employees/${emp.id}?tab=performance`} className="font-medium hover:text-primary">{fullName(emp)}</Link>
              <p className="text-xs text-muted-foreground">{db.designations.find((d) => d.id === emp.designationId)?.title} · {db.departments.find((d) => d.id === emp.departmentId)?.name}</p>
            </div>
            <StatusBadge status={review.status} />
          </div>

          <section>
            <p className="mb-3 text-sm font-semibold">Goals & progress <span className="font-normal text-muted-foreground">· weighted {weighted({ ...review, goals: review.goals.map((g) => ({ ...g, progress: progress[g.id] ?? g.progress })) })}%</span></p>
            <ul className="space-y-4">
              {review.goals.map((g) => {
                const p = progress[g.id] ?? g.progress;
                return (
                  <li key={g.id}>
                    <div className="mb-1.5 flex justify-between gap-3 text-sm"><span>{g.title} <span className="text-xs text-muted-foreground">({g.weight}%)</span></span><span className="tabular text-muted-foreground">{p}%</span></div>
                    {managerMode || selfMode ? (
                      <input type="range" min={0} max={100} step={5} value={p} aria-label={`Progress for ${g.title}`} onChange={(e) => setProgress((s) => ({ ...s, [g.id]: Number(e.target.value) }))} className="w-full accent-[hsl(var(--primary))]" />
                    ) : (
                      <Progress value={p} />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold">Self-assessment</p>
            {selfMode ? (
              <Field label="Your reflection on this cycle" htmlFor="rv-self" hint="Minimum 20 characters. Submitting sends the review to your manager.">
                <Textarea id="rv-self" rows={4} value={selfText} onChange={(e) => setSelfText(e.target.value)} />
              </Field>
            ) : (
              <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{review.selfAssessment || 'Not submitted yet.'}</p>
            )}
          </section>

          <section>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">Ratings <span className="text-xs font-normal text-muted-foreground">(1 – 5, recorded by the reviewer)</span></p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {RATING_KEYS.filter((k) => faculty || !k.facultyOnly).map((k) => (
                <Field key={k.key} label={k.label} htmlFor={`rt-${k.key}`}>
                  {managerMode ? (
                    <Select id={`rt-${k.key}`} value={ratings[k.key] ?? ''} onChange={(e) => setRatings((r) => ({ ...r, [k.key]: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">Not rated</option>
                      {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                    </Select>
                  ) : (
                    <p id={`rt-${k.key}`} className="tabular flex items-center gap-1 text-sm font-medium">{ratings[k.key] !== null ? <><Star className="size-3.5 fill-amber-400 text-amber-400" /> {ratings[k.key]}</> : <span className="text-muted-foreground">Not rated</span>}</p>
                  )}
                </Field>
              ))}
            </div>
            {review.overallRating !== null && <p className="mt-3 text-sm">Overall (mean of recorded ratings): <strong className="tabular">{review.overallRating}</strong></p>}
          </section>

          <section className="space-y-3">
            {managerMode ? (
              <>
                <Field label="Manager feedback" htmlFor="rv-fb" hint="Required to complete. Focus on observable outcomes and next steps.">
                  <Textarea id="rv-fb" rows={4} value={feedback} onChange={(e) => setFeedback(e.target.value)} />
                </Field>
                <Field label="Training & development needs" htmlFor="rv-tr" hint="Comma-separated, e.g. Research grant writing, ERP training">
                  <Input id="rv-tr" value={training} onChange={(e) => setTraining(e.target.value)} />
                </Field>
                <Field label="Review stage" htmlFor="rv-st">
                  <Select id="rv-st" value={status} onChange={(e) => setStatus(e.target.value as ReviewStatus)}>
                    {REVIEW_STATUSES.filter((s) => s !== 'Completed').map((s) => <option key={s}>{s}</option>)}
                  </Select>
                </Field>
              </>
            ) : (
              <>
                <div><p className="mb-1 text-sm font-semibold">Manager feedback</p><p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">{review.managerFeedback || 'Not yet provided.'}</p></div>
                <div>
                  <p className="mb-1 text-sm font-semibold">Training & development</p>
                  <div className="flex flex-wrap gap-1.5">{review.trainingNeeds.length ? review.trainingNeeds.map((t) => <Badge key={t} tone="info"><BookOpen className="size-3" /> {t}</Badge>) : <span className="text-sm text-muted-foreground">None recorded.</span>}</div>
                </div>
              </>
            )}
          </section>
          {review.completedAt && <p className="text-xs text-muted-foreground">Completed {formatDate(review.completedAt.slice(0, 10))}</p>}
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function PerformancePage() {
  const { user, db } = useAuth();
  const [params, setParams] = useSearchParams();
  const all = useMemo(() => visibleReviews(user, db), [user, db]);
  const cycles = useMemo(() => [...new Set(all.map((r) => r.cycle))].sort().reverse(), [all]);
  const [cycle, setCycle] = useState('');
  const [status, setStatus] = useState('');
  const [dept, setDept] = useState('');
  const [q, setQ] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    if (!cycle && cycles.length) setCycle(cycles.find((c) => c.startsWith('Mid-Year')) ?? cycles[0]!);
  }, [cycles, cycle]);
  if (!user) return null;
  const openReview = all.find((r) => r.id === params.get('review'));
  const canCreate = can(user, 'performance.manage_all') || isTeamManager(user, db);
  const emp = (id: string) => db.employees.find((e) => e.id === id);
  const inCycle = all.filter((r) => !cycle || r.cycle === cycle);
  const rows = inCycle.filter((r) => {
    const e = emp(r.employeeId);
    if (!e) return false;
    if (status && r.status !== status) return false;
    if (dept && e.departmentId !== dept) return false;
    if (q && !fullName(e).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const completed = inCycle.filter((r) => r.status === 'Completed');
  const rated = completed.filter((r) => r.overallRating !== null);
  const avg = rated.length ? rated.reduce((a, r) => a + r.overallRating!, 0) / rated.length : 0;
  const byStatus = REVIEW_STATUSES.map((s) => ({ name: s, value: inCycle.filter((r) => r.status === s).length }));
  const buckets = ['1–1.9', '2–2.9', '3–3.9', '4–4.5', '4.6–5'].map((label, i) => ({ label, value: rated.filter((r) => { const v = r.overallRating!; return i === 0 ? v < 2 : i === 1 ? v >= 2 && v < 3 : i === 2 ? v >= 3 && v < 4 : i === 3 ? v >= 4 && v <= 4.5 : v > 4.5; }).length }));
  const statusColors = [C.muted, C.c2, C.warning, C.success];
  const setReview = (id: string | null) => {
    const n = new URLSearchParams(params);
    id ? n.set('review', id) : n.delete('review');
    setParams(n, { replace: true });
  };
  const own = all.filter((r) => r.employeeId === user.employeeId);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Performance' }]}
        title="Performance"
        description={can(user, 'performance.view_all') ? 'Review cycles, goals, ratings and development needs' : 'Your reviews and, where applicable, your team’s reviews'}
        actions={
          <>
            {can(user, 'reports.view') && <Button variant="outline" disabled={!rows.length} onClick={() => { exportCsv(`performance-${cycle || 'all'}.csv`, rows, [{ header: 'Review', value: (r) => r.id }, { header: 'Employee ID', value: (r) => r.employeeId }, { header: 'Employee', value: (r) => (emp(r.employeeId) ? fullName(emp(r.employeeId)!) : '') }, { header: 'Cycle', value: (r) => r.cycle }, { header: 'Status', value: (r) => r.status }, { header: 'Goal progress %', value: weighted }, { header: 'Overall rating', value: (r) => r.overallRating }, { header: 'Training needs', value: (r) => r.trainingNeeds.join('; ') }]); toast.success('Performance data exported'); }}><Download /> Export</Button>}
            {canCreate && <Button onClick={() => setNewOpen(true)}><Plus /> New review</Button>}
          </>
        }
      />
      <DemoBanner className="mb-5 border-sky-300/60 bg-sky-50 text-sky-900 dark:border-sky-400/20 dark:bg-sky-500/10 dark:text-sky-200">
        <Info className="mt-0.5 size-4 shrink-0" />
        <span>Ratings and feedback are entered by reviewers. The system shows recorded values and goal progress only — it does not infer or label employee performance.</span>
      </DemoBanner>
      {own.length > 0 && !can(user, 'performance.view_all') && (
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {own.map((r) => (
            <Card key={r.id} className="cursor-pointer p-4 transition hover:border-primary/40" onClick={() => setReview(r.id)}>
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs text-muted-foreground">My review</p><p className="font-semibold">{r.cycle}</p></div><StatusBadge status={r.status} /></div>
              <div className="mt-3"><div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Weighted goal progress</span><span className="tabular">{weighted(r)}%</span></div><Progress value={weighted(r)} /></div>
              {(r.status === 'Not Started' || r.status === 'Self Assessment') && <p className="mt-3 text-xs font-medium text-primary">Self-assessment due — open to submit →</p>}
            </Card>
          ))}
        </div>
      )}
      {(can(user, 'performance.view_all') || isTeamManager(user, db)) && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Reviews in cycle" value={inCycle.length} icon={<Target />} />
            <StatCard label="Completion" value={formatPercent(inCycle.length ? (completed.length / inCycle.length) * 100 : 0, 0)} icon={<ClipboardCheck />} tone="success" hint="Completed reviews ÷ all reviews in the selected cycle." />
            <StatCard label="Awaiting manager" value={inCycle.filter((r) => r.status === 'Manager Review').length} icon={<Users />} tone="warning" />
            <StatCard label="Mean recorded rating" value={rated.length ? avg.toFixed(2) : '—'} icon={<Star />} tone="violet" hint="Average of overall ratings entered by reviewers on completed reviews (1–5). Shown for calibration only." />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Review status" description={cycle} />
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer>
                    <BarChart data={byStatus} margin={{ left: -16, right: 8, top: 8 }}>
                      <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
                      <Bar dataKey="value" name="Reviews" radius={[4, 4, 0, 0]} maxBarSize={44}>{byStatus.map((s, i) => <Cell key={s.name} fill={statusColors[i]} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Distribution of recorded ratings" description="Completed reviews only" />
              <CardContent>
                <div className="h-[200px]">
                  {rated.length ? (
                    <ResponsiveContainer>
                      <BarChart data={buckets} margin={{ left: -16, right: 8, top: 8 }}>
                        <CartesianGrid vertical={false} stroke={C.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="label" {...axisProps} />
                        <YAxis {...axisProps} allowDecimals={false} />
                        <RTooltip cursor={{ fill: 'hsl(var(--muted))' }} content={<ChartTooltip />} />
                        <Bar dataKey="value" name="Reviews" fill={C.c6} radius={[4, 4, 0, 0]} maxBarSize={44} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState icon={<Star />} title="No completed reviews in this cycle" className="py-8" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      <Card className="mt-4">
        <Toolbar>
          <Select aria-label="Review cycle" className="sm:w-60" value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="">All cycles</option>
            {cycles.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <SearchInput value={q} onChange={setQ} placeholder="Search employee" className="sm:w-52" />
          <Select aria-label="Status" className="sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {REVIEW_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          {can(user, 'performance.view_all') && (
            <Select aria-label="Department" className="sm:w-52" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All departments</option>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
          )}
        </Toolbar>
        <DataTable
          rows={rows}
          getRowId={(r) => r.id}
          onRowClick={(r) => setReview(r.id)}
          initialSort={{ key: 'emp', dir: 'asc' }}
          columns={[
            { key: 'emp', header: 'Employee', sortValue: (r) => (emp(r.employeeId) ? fullName(emp(r.employeeId)!) : ''), cell: (r) => { const e = emp(r.employeeId)!; return <span className="flex items-center gap-2.5"><Avatar name={fullName(e)} color={e.avatarColor} size="sm" /><span><span className="block font-medium">{fullName(e)}</span><span className="block text-xs text-muted-foreground">{db.departments.find((d) => d.id === e.departmentId)?.code}</span></span></span>; } },
            { key: 'cycle', header: 'Cycle', hideBelow: 'lg', cell: (r) => <span className="text-muted-foreground">{r.cycle}</span> },
            { key: 'rev', header: 'Reviewer', hideBelow: 'xl', cell: (r) => <span className="text-muted-foreground">{emp(r.reviewerId ?? '') ? fullName(emp(r.reviewerId!)!) : '—'}</span> },
            { key: 'goals', header: 'Goal progress', sortValue: weighted, cell: (r) => <div className="flex w-36 items-center gap-2"><Progress value={weighted(r)} /><span className="tabular w-9 text-right text-xs text-muted-foreground">{weighted(r)}%</span></div> },
            { key: 'rating', header: 'Rating', align: 'right', hideBelow: 'sm', sortValue: (r) => r.overallRating ?? -1, cell: (r) => (r.overallRating !== null ? <span className="tabular font-medium">{r.overallRating}</span> : <span className="text-muted-foreground">—</span>) },
            { key: 'training', header: 'Training needs', hideBelow: 'xl', cell: (r) => <span className="line-clamp-1 text-xs text-muted-foreground">{r.trainingNeeds.join(', ') || '—'}</span> },
            { key: 'status', header: 'Status', sortValue: (r) => REVIEW_STATUSES.indexOf(r.status), cell: (r) => <StatusBadge status={r.status} /> },
          ]}
          empty={<EmptyState icon={<Target />} title="No reviews found" description={canCreate ? 'Open a review to start tracking goals.' : 'Reviews you have access to will appear here.'} action={canCreate ? <Button size="sm" onClick={() => setNewOpen(true)}><Plus /> New review</Button> : undefined} />}
        />
      </Card>
      {openReview && <ReviewSheet key={openReview.id} review={openReview} onClose={() => setReview(null)} />}
      <NewReviewDialog open={newOpen} onOpenChange={setNewOpen} />
    </div>
  );
}
