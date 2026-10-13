import { can } from '@/lib/permissions';
import { today } from '@/lib/dates';
import { commit, getDb } from '../store';
import { candidateSchema, firstError, jobSchema, type CandidateInput, type JobInput } from '../schemas';
import { PIPELINE_STAGES, type Candidate, type CandidateStage, type JobOpening, type JobStatus, type User } from '../types';
import { auditEntry, fail, ok, requireActor, run, withAudit, type Result } from './core';

const guard = (actor: User | null) => {
  requireActor(actor);
  if (!can(actor, 'recruitment.manage')) throw new Error('You do not have permission to manage recruitment.');
};

export function createJob(actor: User | null, input: JobInput): Promise<Result<JobOpening>> {
  return run(() => {
    guard(actor);
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const db = getDb();
    if (v.closingDate < today()) return fail('Closing date must be today or later.');
    if (db.departments.find((d) => d.id === v.departmentId)?.status !== 'active') return fail('Select an active department.');
    const max = db.jobs.reduce((m, j) => Math.max(m, Number(j.id.split('-')[1]) || 100), 100);
    const job: JobOpening = { id: `JOB-${max + 1}`, ...v, employmentType: v.employmentType as JobOpening['employmentType'], status: 'Open', postedOn: today() };
    commit((d) => ({ jobs: [job, ...d.jobs], auditLogs: withAudit(d, auditEntry(actor!, 'job.create', 'job_opening', job.id, `Posted job opening “${job.title}”`)) }));
    return ok(job);
  });
}

export function updateJob(actor: User | null, id: string, input: JobInput): Promise<Result<JobOpening>> {
  return run(() => {
    guard(actor);
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const before = getDb().jobs.find((j) => j.id === id);
    if (!before) return fail('Job opening not found.');
    const after: JobOpening = { ...before, ...parsed.data, employmentType: parsed.data.employmentType as JobOpening['employmentType'] };
    commit((d) => ({ jobs: d.jobs.map((j) => (j.id === id ? after : j)), auditLogs: withAudit(d, auditEntry(actor!, 'job.update', 'job_opening', id, `Updated job opening “${after.title}”`)) }));
    return ok(after);
  });
}

export function setJobStatus(actor: User | null, id: string, status: JobStatus): Promise<Result<void>> {
  return run(() => {
    guard(actor);
    const job = getDb().jobs.find((j) => j.id === id);
    if (!job) return fail('Job opening not found.');
    commit((d) => ({ jobs: d.jobs.map((j) => (j.id === id ? { ...j, status } : j)), auditLogs: withAudit(d, auditEntry(actor!, 'job.status', 'job_opening', id, `Set “${job.title}” to ${status}`)) }));
    return ok(undefined);
  });
}

export function addCandidate(actor: User | null, input: CandidateInput): Promise<Result<Candidate>> {
  return run(() => {
    guard(actor);
    const parsed = candidateSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const v = parsed.data;
    const db = getDb();
    const job = db.jobs.find((j) => j.id === v.jobId);
    if (!job) return fail('Job opening not found.');
    if (job.status !== 'Open') return fail(`“${job.title}” is ${job.status.toLowerCase()} and not accepting candidates.`);
    if (db.candidates.some((c) => c.jobId === v.jobId && c.email === v.email)) return fail('This candidate has already applied for this opening.');
    const max = db.candidates.reduce((m, c) => Math.max(m, Number(c.id.split('-')[1]) || 200), 200);
    const cand: Candidate = {
      id: `CAN-${max + 1}`,
      ...v,
      stage: 'Applied',
      appliedOn: today(),
      interviewAt: null,
      interviewPanel: '',
      offerStatus: 'None',
      notes: '',
      onboarding: [
        { key: 'offer', label: 'Offer letter signed', done: false },
        { key: 'docs', label: 'Documents verified', done: false },
        { key: 'medical', label: 'Medical fitness certificate', done: false },
        { key: 'it', label: 'Email & ERP account created', done: false },
        { key: 'id', label: 'ID card issued', done: false },
        { key: 'induction', label: 'Induction session attended', done: false },
      ],
      documentsSubmitted: [
        { name: 'Resume / CV', submitted: true },
        { name: 'Degree certificates', submitted: false },
        { name: 'Experience letters', submitted: false },
        { name: 'Identity proof', submitted: false },
      ],
      employeeId: null,
    };
    commit((d) => ({ candidates: [cand, ...d.candidates], auditLogs: withAudit(d, auditEntry(actor!, 'candidate.create', 'candidate', cand.id, `Added candidate ${cand.name} for “${job.title}”`)) }));
    return ok(cand);
  });
}

/** Pipeline rules keep the workflow honest (e.g. no "Joined" without an accepted offer). */
export function stageGuard(c: Candidate, to: CandidateStage): string | null {
  if (c.stage === 'Joined') return 'Joined candidates are now employees and cannot be moved.';
  if (to === 'Interview' && !c.interviewAt) return null; // allowed; UI prompts to schedule
  if (to === 'Offered' && !['Selected', 'Offered'].includes(c.stage)) return 'Only selected candidates can receive an offer.';
  if (to === 'Joined') return 'Use “Complete joining” to convert an accepted offer into an employee record.';
  if (to === 'Selected' && PIPELINE_STAGES.indexOf(c.stage) < PIPELINE_STAGES.indexOf('Interview')) return 'Candidates must be interviewed before selection.';
  return null;
}

export function updateCandidate(actor: User | null, id: string, patch: Partial<Pick<Candidate, 'stage' | 'interviewAt' | 'interviewPanel' | 'offerStatus' | 'notes' | 'onboarding' | 'documentsSubmitted'>>): Promise<Result<Candidate>> {
  return run(() => {
    guard(actor);
    const before = getDb().candidates.find((c) => c.id === id);
    if (!before) return fail('Candidate not found.');
    if (patch.stage && patch.stage !== before.stage) {
      const err = stageGuard(before, patch.stage);
      if (err) return fail(err);
    }
    if (patch.offerStatus && patch.offerStatus !== 'None' && !['Offered', 'Selected'].includes(patch.stage ?? before.stage)) return fail('Offer status applies to selected/offered candidates only.');
    if (patch.interviewAt && patch.interviewAt.slice(0, 10) < today()) return fail('Interview cannot be scheduled in the past.');
    const after: Candidate = { ...before, ...patch };
    if (patch.offerStatus === 'Extended' && after.stage === 'Selected') after.stage = 'Offered';
    if (patch.stage === 'Interview' && !after.interviewPanel) after.interviewPanel = 'HoD, Dean Academics, External Expert';
    const changed = patch.stage && patch.stage !== before.stage ? `moved ${before.name} to ${patch.stage}` : `updated ${before.name}`;
    commit((d) => ({ candidates: d.candidates.map((c) => (c.id === id ? after : c)), auditLogs: withAudit(d, auditEntry(actor!, 'candidate.update', 'candidate', id, changed[0]!.toUpperCase() + changed.slice(1))) }));
    return ok(after);
  });
}

export function markCandidateJoined(actor: User | null, id: string, employeeId: string): Promise<Result<void>> {
  return run(() => {
    guard(actor);
    const db = getDb();
    const c = db.candidates.find((x) => x.id === id);
    if (!c) return fail('Candidate not found.');
    if (!db.employees.some((e) => e.id === employeeId)) return fail('Employee record not found.');
    commit((d) => ({
      candidates: d.candidates.map((x) => (x.id === id ? { ...x, stage: 'Joined', offerStatus: 'Accepted', employeeId } : x)),
      auditLogs: withAudit(d, auditEntry(actor!, 'candidate.joined', 'candidate', id, `${c.name} joined as ${employeeId}`)),
    }));
    return ok(undefined);
  });
}
