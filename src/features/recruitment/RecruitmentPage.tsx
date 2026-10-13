import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Briefcase, CalendarClock, CheckCircle2, ClipboardList, Download, GripVertical, MoreHorizontal, Pencil, UserCheck, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { addDays, formatDate, formatDateTime, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { cn, pluralize } from '@/lib/utils';
import { candidateSchema, jobSchema, type CandidateInput, type JobInput } from '@/data/schemas';
import { addCandidate, createJob, markCandidateJoined, setJobStatus, stageGuard, updateCandidate, updateJob } from '@/data/services';
import { EMPLOYMENT_TYPES, PIPELINE_STAGES, type Candidate, type CandidateStage, type JobOpening, type JobStatus } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, StatCard, Toolbar } from '@/components/page';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox, Field, Input, Select, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState, Progress } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge, statusTone } from '@/components/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, SheetContent } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { DataTable } from '@/components/data-table';
import { EmployeeFormSheet } from '@/features/employees/EmployeeForm';

function JobDialog({ open, onOpenChange, job }: { open: boolean; onOpenChange: (o: boolean) => void; job: JobOpening | null }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, formState: { errors } } = useForm<JobInput>({
    resolver: zodResolver(jobSchema),
    values: job ? { title: job.title, departmentId: job.departmentId, designationId: job.designationId, employmentType: job.employmentType, positions: job.positions, closingDate: job.closingDate, description: job.description } : { title: '', departmentId: '', designationId: '', employmentType: 'Full-time', positions: 1, closingDate: addDays(today(), 30), description: '' },
  });
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => (job ? updateJob(user, job.id, v) : createJob(user, v)), job ? 'Job opening updated' : 'Job opening posted');
    if (r.ok) onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title={job ? 'Edit job opening' : 'Post a job opening'} footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>{job ? 'Save' : 'Post opening'}</Button></>}>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Job title" htmlFor="job-title" error={errors.title?.message} required className="sm:col-span-2"><Input id="job-title" {...register('title')} aria-invalid={!!errors.title} /></Field>
          <Field label="Department" htmlFor="job-dept" error={errors.departmentId?.message} required>
            <Select id="job-dept" {...register('departmentId')} aria-invalid={!!errors.departmentId}><option value="">Select</option>{db.departments.filter((d) => d.status === 'active').map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
          </Field>
          <Field label="Designation" htmlFor="job-des" error={errors.designationId?.message} required>
            <Select id="job-des" {...register('designationId')} aria-invalid={!!errors.designationId}><option value="">Select</option>{db.designations.filter((d) => d.status === 'active').map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</Select>
          </Field>
          <Field label="Employment type" htmlFor="job-type"><Select id="job-type" {...register('employmentType')}>{EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Positions" htmlFor="job-pos" error={errors.positions?.message}><Input id="job-pos" type="number" min={1} {...register('positions')} /></Field>
            <Field label="Closing date" htmlFor="job-close" error={errors.closingDate?.message} required><Input id="job-close" type="date" min={today()} {...register('closingDate')} /></Field>
          </div>
          <Field label="Description & requirements" htmlFor="job-desc" error={errors.description?.message} required className="sm:col-span-2"><Textarea id="job-desc" rows={4} {...register('description')} aria-invalid={!!errors.description} /></Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CandidateDialog({ open, onOpenChange, defaultJob }: { open: boolean; onOpenChange: (o: boolean) => void; defaultJob?: string }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CandidateInput>({ resolver: zodResolver(candidateSchema), values: { name: '', email: '', phone: '', jobId: defaultJob ?? '', experienceYears: 0, qualification: '' } });
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => addCandidate(user, v), `${v.name} added to the pipeline`);
    if (r.ok) {
      reset();
      onOpenChange(false);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Add candidate" footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>Add candidate</Button></>}>
        <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Full name" htmlFor="cd-name" error={errors.name?.message} required className="sm:col-span-2"><Input id="cd-name" {...register('name')} aria-invalid={!!errors.name} /></Field>
          <Field label="Email" htmlFor="cd-email" error={errors.email?.message} required><Input id="cd-email" type="email" {...register('email')} aria-invalid={!!errors.email} /></Field>
          <Field label="Phone" htmlFor="cd-phone" error={errors.phone?.message} required><Input id="cd-phone" type="tel" {...register('phone')} aria-invalid={!!errors.phone} /></Field>
          <Field label="Job opening" htmlFor="cd-job" error={errors.jobId?.message} required className="sm:col-span-2">
            <Select id="cd-job" {...register('jobId')} aria-invalid={!!errors.jobId}><option value="">Select an open position</option>{db.jobs.filter((j) => j.status === 'Open').map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}</Select>
          </Field>
          <Field label="Qualification" htmlFor="cd-q" error={errors.qualification?.message} required><Input id="cd-q" {...register('qualification')} /></Field>
          <Field label="Experience (years)" htmlFor="cd-exp" error={errors.experienceYears?.message}><Input id="cd-exp" type="number" min={0} {...register('experienceYears')} /></Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CandidateSheet({ candidate, onClose, onJoin }: { candidate: Candidate; onClose: () => void; onJoin: (c: Candidate) => void }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const job = db.jobs.find((j) => j.id === candidate.jobId);
  const [interviewAt, setInterviewAt] = useState(candidate.interviewAt?.slice(0, 16) ?? '');
  const [panel, setPanel] = useState(candidate.interviewPanel);
  const [notes, setNotes] = useState(candidate.notes);
  const patch = (p: Parameters<typeof updateCandidate>[2], msg: string, key = 'patch') => run(key, () => updateCandidate(user, candidate.id, p), msg);
  const onboardingDone = candidate.onboarding.filter((o) => o.done).length;
  const idx = PIPELINE_STAGES.indexOf(candidate.stage);
  const next = PIPELINE_STAGES[idx + 1];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        title={candidate.name}
        description={`${candidate.id} · ${job?.title ?? ''}`}
        footer={
          candidate.stage === 'Joined' ? (
            <Badge tone="success"><CheckCircle2 className="size-3" /> Joined as {candidate.employeeId ?? 'employee'}</Badge>
          ) : candidate.offerStatus === 'Accepted' ? (
            <Button onClick={() => onJoin(candidate)}><UserPlus /> Complete joining</Button>
          ) : next && next !== 'Joined' && candidate.stage !== 'Rejected' ? (
            <>
              <Button variant="outline" className="text-destructive" onClick={() => patch({ stage: 'Rejected' }, `${candidate.name} marked rejected`, 'reject')} loading={pending === 'reject'}>Reject</Button>
              <Button onClick={() => patch({ stage: next }, `Moved to ${next}`, 'next')} loading={pending === 'next'}>Move to {next} <ArrowRight /></Button>
            </>
          ) : undefined
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <Avatar name={candidate.name} color="#6366f1" size="lg" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="truncate">{candidate.email}</p>
              <p className="text-muted-foreground">{candidate.phone}</p>
              <p className="text-muted-foreground">{candidate.qualification} · {pluralize(candidate.experienceYears, 'year')} experience · applied {formatDate(candidate.appliedOn)}</p>
            </div>
          </div>
          <Field label="Pipeline stage" htmlFor="cd-stage">
            <Select id="cd-stage" value={candidate.stage} disabled={candidate.stage === 'Joined'} onChange={(e) => patch({ stage: e.target.value as CandidateStage }, `Moved to ${e.target.value}`)}>
              {PIPELINE_STAGES.map((s) => <option key={s} value={s} disabled={s === 'Joined'}>{s}</option>)}
            </Select>
          </Field>
          <section className="space-y-3 rounded-lg border p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><CalendarClock className="size-4" /> Interview</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Date & time" htmlFor="cd-iv"><Input id="cd-iv" type="datetime-local" value={interviewAt} min={`${today()}T08:00`} onChange={(e) => setInterviewAt(e.target.value)} /></Field>
              <Field label="Panel" htmlFor="cd-panel"><Input id="cd-panel" value={panel} onChange={(e) => setPanel(e.target.value)} placeholder="HoD, Dean, External expert" /></Field>
            </div>
            <Button size="sm" variant="outline" disabled={!interviewAt || candidate.stage === 'Joined'} loading={pending === 'iv'} onClick={() => patch({ interviewAt: `${interviewAt}:00`, interviewPanel: panel, ...(['Applied', 'Shortlisted'].includes(candidate.stage) ? { stage: 'Interview' as const } : {}) }, 'Interview scheduled', 'iv')}>
              {candidate.interviewAt ? 'Reschedule' : 'Schedule interview'}
            </Button>
          </section>
          <Field label="Offer status" htmlFor="cd-offer" hint="Available once a candidate is selected">
            <Select id="cd-offer" value={candidate.offerStatus} disabled={!['Selected', 'Offered'].includes(candidate.stage)} onChange={(e) => patch({ offerStatus: e.target.value as Candidate['offerStatus'] }, `Offer ${e.target.value.toLowerCase()}`)}>
              {['None', 'Extended', 'Accepted', 'Declined'].map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <section>
            <p className="mb-2 text-sm font-semibold">Document submission</p>
            <ul className="space-y-1.5">
              {candidate.documentsSubmitted.map((d, i) => (
                <li key={d.name}><label className="flex items-center gap-2 text-sm"><Checkbox checked={d.submitted} onChange={() => patch({ documentsSubmitted: candidate.documentsSubmitted.map((x, j) => (j === i ? { ...x, submitted: !x.submitted } : x)) }, `${d.name} marked ${d.submitted ? 'missing' : 'received'}`)} /> {d.name}</label></li>
              ))}
            </ul>
          </section>
          {(candidate.stage === 'Offered' || candidate.stage === 'Selected' || candidate.stage === 'Joined') && (
            <section>
              <div className="mb-2 flex items-center justify-between text-sm"><p className="font-semibold">Onboarding checklist</p><span className="tabular text-muted-foreground">{onboardingDone}/{candidate.onboarding.length}</span></div>
              <Progress value={(onboardingDone / candidate.onboarding.length) * 100} tone="success" className="mb-3" />
              <ul className="space-y-1.5">
                {candidate.onboarding.map((o) => (
                  <li key={o.key}><label className="flex items-center gap-2 text-sm"><Checkbox checked={o.done} disabled={candidate.stage === 'Joined'} onChange={() => patch({ onboarding: candidate.onboarding.map((x) => (x.key === o.key ? { ...x, done: !x.done } : x)) }, `${o.label}: ${o.done ? 'reopened' : 'done'}`)} /> <span className={cn(o.done && 'text-muted-foreground line-through')}>{o.label}</span></label></li>
                ))}
              </ul>
            </section>
          )}
          <Field label="Notes" htmlFor="cd-notes">
            <Textarea id="cd-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== candidate.notes && patch({ notes }, 'Notes saved')} />
          </Field>
        </div>
      </SheetContent>
    </Dialog>
  );
}

export function RecruitmentPage() {
  const { user, db } = useAuth();
  const { run } = useAsyncAction();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'pipeline';
  const [jobFilter, setJobFilter] = useState('');
  const [q, setQ] = useState('');
  const [jobDialog, setJobDialog] = useState<{ open: boolean; job: JobOpening | null }>({ open: false, job: null });
  const [candOpen, setCandOpen] = useState(false);
  const [joining, setJoining] = useState<Candidate | null>(null);
  const [dragOver, setDragOver] = useState<CandidateStage | null>(null);
  const manage = can(user, 'recruitment.manage');
  const open = db.candidates.find((c) => c.id === params.get('candidate'));
  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    v ? n.set(k, v) : n.delete(k);
    setParams(n, { replace: true });
  };
  const candidates = db.candidates.filter((c) => (!jobFilter || c.jobId === jobFilter) && (!q || `${c.name} ${c.email}`.toLowerCase().includes(q.toLowerCase())));
  const interviews = db.candidates.filter((c) => c.stage === 'Interview' && c.interviewAt && c.interviewAt.slice(0, 10) >= today()).sort((a, b) => a.interviewAt!.localeCompare(b.interviewAt!));
  const onboarding = db.candidates.filter((c) => ['Offered', 'Joined'].includes(c.stage) || c.offerStatus === 'Accepted');
  const jobById = useMemo(() => new Map(db.jobs.map((j) => [j.id, j])), [db.jobs]);

  const drop = async (stage: CandidateStage, id: string) => {
    setDragOver(null);
    const c = db.candidates.find((x) => x.id === id);
    if (!c || c.stage === stage) return;
    const err = stageGuard(c, stage);
    if (err) return toast.error(err);
    await run('drag', () => updateCandidate(user, id, { stage }), `${c.name} moved to ${stage}`);
  };

  const prefill = joining
    ? (() => {
        const job = jobById.get(joining.jobId);
        const [first, ...rest] = joining.name.replace(/^Dr\.\s*/, '').split(' ');
        return { firstName: first ?? '', lastName: rest.join(' ') || '-', email: '', phone: joining.phone, departmentId: job?.departmentId ?? '', designationId: job?.designationId ?? '', employmentType: job?.employmentType ?? 'Full-time', qualification: joining.qualification, joiningDate: today(), status: 'Probation' as const };
      })()
    : undefined;

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Recruitment' }]}
        title="Recruitment & onboarding"
        description="Job openings, candidate pipeline, interviews and joining workflow"
        actions={manage && (
          <>
            <Button variant="outline" onClick={() => exportCsv(`candidates-${today()}.csv`, candidates, [{ header: 'ID', value: (c) => c.id }, { header: 'Name', value: (c) => c.name }, { header: 'Email', value: (c) => c.email }, { header: 'Job', value: (c) => jobById.get(c.jobId)?.title }, { header: 'Stage', value: (c) => c.stage }, { header: 'Applied', value: (c) => c.appliedOn }, { header: 'Interview', value: (c) => c.interviewAt }, { header: 'Offer', value: (c) => c.offerStatus }])}><Download /> Export</Button>
            <Button variant="outline" onClick={() => setJobDialog({ open: true, job: null })}><Briefcase /> Post job</Button>
            <Button onClick={() => setCandOpen(true)}><UserPlus /> Add candidate</Button>
          </>
        )}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Open positions" value={db.jobs.filter((j) => j.status === 'Open').reduce((a, j) => a + j.positions, 0)} icon={<Briefcase />} hint="Sum of positions across job openings with status Open." />
        <StatCard label="Active candidates" value={db.candidates.filter((c) => !['Joined', 'Rejected'].includes(c.stage)).length} icon={<Users />} tone="info" />
        <StatCard label="Upcoming interviews" value={interviews.length} icon={<CalendarClock />} tone="warning" />
        <StatCard label="Offers outstanding" value={db.candidates.filter((c) => c.offerStatus === 'Extended').length} icon={<UserCheck />} tone="success" />
      </div>
      <Tabs value={tab} onValueChange={(t) => setParam('tab', t === 'pipeline' ? null : t)}>
        <TabsList>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="jobs">Job openings</TabsTrigger>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline">
          <Card className="mb-3">
            <Toolbar className="border-b-0">
              <Select aria-label="Job opening" className="sm:w-72" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)}>
                <option value="">All job openings</option>
                {db.jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
              </Select>
              <SearchInput value={q} onChange={setQ} placeholder="Search candidates" className="sm:w-60" />
              <p className="text-xs text-muted-foreground sm:ml-auto">Drag cards between stages, or open a card to update it.</p>
            </Toolbar>
          </Card>
          <div className="scrollbar-thin -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
            {PIPELINE_STAGES.map((stage) => {
              const list = candidates.filter((c) => c.stage === stage);
              return (
                <section
                  key={stage}
                  aria-label={`${stage} (${list.length})`}
                  onDragOver={(e) => { if (manage) { e.preventDefault(); setDragOver(stage); } }}
                  onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
                  onDrop={(e) => drop(stage, e.dataTransfer.getData('text/plain'))}
                  className={cn('flex w-64 shrink-0 flex-col rounded-lg border bg-muted/40 transition', dragOver === stage && 'border-primary bg-accent/60')}
                >
                  <header className="flex items-center justify-between px-3 py-2.5">
                    <StatusBadge status={stage} />
                    <span className="tabular text-xs font-medium text-muted-foreground">{list.length}</span>
                  </header>
                  <div className="flex min-h-24 flex-col gap-2 px-2 pb-2">
                    {list.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        draggable={manage && c.stage !== 'Joined'}
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', c.id)}
                        onClick={() => setParam('candidate', c.id)}
                        className="group rounded-md border bg-card p-3 text-left shadow-card transition hover:border-primary/40 hover:shadow-md"
                      >
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{c.name}</span>
                            <span className="block truncate text-xs text-muted-foreground">{jobById.get(c.jobId)?.title}</span>
                          </span>
                          {manage && c.stage !== 'Joined' && <GripVertical className="size-4 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" aria-hidden />}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span>{c.qualification} · {c.experienceYears}y</span>
                          {c.interviewAt && c.stage === 'Interview' && <Badge tone="primary" className="text-[10px]"><CalendarClock className="size-3" /> {formatDateTime(c.interviewAt)}</Badge>}
                          {c.offerStatus !== 'None' && <Badge tone={c.offerStatus === 'Accepted' ? 'success' : c.offerStatus === 'Declined' ? 'danger' : 'warning'} className="text-[10px]">Offer {c.offerStatus.toLowerCase()}</Badge>}
                        </div>
                      </button>
                    ))}
                    {!list.length && <p className="py-6 text-center text-xs text-muted-foreground">No candidates</p>}
                  </div>
                </section>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="jobs">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {db.jobs.map((j) => {
              const cands = db.candidates.filter((c) => c.jobId === j.id);
              return (
                <Card key={j.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold leading-snug">{j.title}</p>
                      <p className="text-xs text-muted-foreground">{db.departments.find((d) => d.id === j.departmentId)?.name} · {j.employmentType}</p>
                    </div>
                    {manage ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${j.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem icon={<Pencil />} onSelect={() => setJobDialog({ open: true, job: j })}>Edit</DropdownMenuItem>
                          {(['Open', 'On Hold', 'Closed'] as JobStatus[]).filter((s) => s !== j.status).map((s) => <DropdownMenuItem key={s} onSelect={() => run('job', () => setJobStatus(user, j.id, s), `Job set to ${s}`)}>Mark {s.toLowerCase()}</DropdownMenuItem>)}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </div>
                  <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{j.description}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                    <StatusBadge status={j.status} />
                    <Badge>{pluralize(j.positions, 'position')}</Badge>
                    <span className="text-muted-foreground">Closes {formatDate(j.closingDate)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3">
                    <div className="flex -space-x-1.5">{cands.slice(0, 5).map((c) => <Avatar key={c.id} name={c.name} color="#6366f1" size="xs" />)}</div>
                    <Button variant="ghost" size="sm" onClick={() => { setJobFilter(j.id); setParam('tab', null); }}>{pluralize(cands.length, 'candidate')} <ArrowRight /></Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="interviews">
          <Card>
            <CardHeader title="Upcoming interviews" description="Scheduled candidates in the Interview stage" />
            <DataTable
              rows={interviews}
              getRowId={(c) => c.id}
              onRowClick={(c) => setParam('candidate', c.id)}
              initialSort={{ key: 'when', dir: 'asc' }}
              columns={[
                { key: 'when', header: 'When', sortValue: (c) => c.interviewAt ?? '', cell: (c) => <span className="whitespace-nowrap font-medium">{formatDateTime(c.interviewAt)}</span> },
                { key: 'name', header: 'Candidate', sortValue: (c) => c.name, cell: (c) => c.name },
                { key: 'job', header: 'Position', hideBelow: 'md', cell: (c) => <span className="text-muted-foreground">{jobById.get(c.jobId)?.title}</span> },
                { key: 'panel', header: 'Panel', hideBelow: 'lg', cell: (c) => <span className="text-muted-foreground">{c.interviewPanel}</span> },
              ]}
              empty={<EmptyState icon={<CalendarClock />} title="No interviews scheduled" description="Open a shortlisted candidate to schedule an interview." />}
            />
          </Card>
        </TabsContent>
        <TabsContent value="onboarding">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {onboarding.map((c) => {
              const done = c.onboarding.filter((o) => o.done).length;
              return (
                <Card key={c.id} className="cursor-pointer p-4 transition hover:border-primary/40" onClick={() => setParam('candidate', c.id)}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-medium">{c.name}</p><p className="text-xs text-muted-foreground">{jobById.get(c.jobId)?.title}</p></div>
                    <Badge tone={statusTone(c.stage)} dot>{c.stage}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground"><span>Onboarding</span><span className="tabular">{done}/{c.onboarding.length}</span></div>
                  <Progress value={(done / c.onboarding.length) * 100} tone="success" className="mt-1" />
                  <p className="mt-2 text-xs text-muted-foreground">Documents: {c.documentsSubmitted.filter((d) => d.submitted).length}/{c.documentsSubmitted.length} · Offer {c.offerStatus.toLowerCase()}</p>
                </Card>
              );
            })}
            {!onboarding.length && <Card className="md:col-span-2 xl:col-span-3"><EmptyState icon={<ClipboardList />} title="No candidates in onboarding" /></Card>}
          </div>
        </TabsContent>
      </Tabs>
      {open && <CandidateSheet key={open.id} candidate={open} onClose={() => setParam('candidate', null)} onJoin={(c) => { setParam('candidate', null); setJoining(c); }} />}
      <JobDialog open={jobDialog.open} job={jobDialog.job} onOpenChange={(o) => setJobDialog((s) => ({ ...s, open: o }))} />
      <CandidateDialog open={candOpen} onOpenChange={setCandOpen} defaultJob={jobFilter || undefined} />
      <EmployeeFormSheet
        open={!!joining}
        onOpenChange={(o) => !o && setJoining(null)}
        prefill={prefill}
        onSaved={async (e) => {
          if (joining) await run('join', () => markCandidateJoined(user, joining.id, e.id), `${joining.name} has joined as ${e.id}`);
          setJoining(null);
        }}
      />
    </div>
  );
}
