import { can, canManageReview, headedDepartmentIds, isManagerOf } from '@/lib/permissions';
import { commit, getDb } from '../store';
import { firstError, reviewCreateSchema, type ReviewCreateInput } from '../schemas';
import type { Database, PerformanceReview, ReviewStatus, User } from '../types';
import { auditEntry, fail, makeNotifications, ok, requireActor, run, userForEmployee, withAudit, withNotifications, type Result } from './core';
import { fullName } from './employees';

export function visibleReviews(actor: User | null, db: Database = getDb()): PerformanceReview[] {
  if (!actor) return [];
  if (can(actor, 'performance.view_all')) return db.reviews;
  const heads = headedDepartmentIds(actor, db);
  return db.reviews.filter((r) => {
    if (r.employeeId === actor.employeeId) return true;
    if (r.reviewerId && r.reviewerId === actor.employeeId) return true;
    const emp = db.employees.find((e) => e.id === r.employeeId);
    return !!emp && (heads.includes(emp.departmentId) || isManagerOf(actor, emp, db));
  });
}

export function createReview(actor: User | null, input: ReviewCreateInput): Promise<Result<PerformanceReview>> {
  return run(() => {
    requireActor(actor);
    const parsed = reviewCreateSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const db = getDb();
    const emp = db.employees.find((e) => e.id === parsed.data.employeeId);
    if (!emp) return fail('Employee not found.');
    const allowed = can(actor, 'performance.manage_all') || isManagerOf(actor, emp, db);
    if (!allowed || emp.id === actor.employeeId) return fail('You are not authorised to create a review for this employee.');
    if (db.reviews.some((r) => r.employeeId === emp.id && r.cycle.toLowerCase() === parsed.data.cycle.toLowerCase())) return fail(`${fullName(emp)} already has a review for “${parsed.data.cycle}”.`);
    const max = db.reviews.reduce((m, r) => Math.max(m, Number(r.id.split('-')[1]) || 0), 0);
    const review: PerformanceReview = {
      id: `PR-${String(max + 1).padStart(4, '0')}`,
      employeeId: emp.id,
      cycle: parsed.data.cycle,
      reviewerId: emp.reportingManagerId ?? actor.employeeId,
      status: 'Not Started',
      goals: parsed.data.goals.map((g, i) => ({ id: `g${i}`, title: g.title, weight: g.weight, progress: 0 })),
      ratings: { teaching: null, research: null, service: null, professionalism: null },
      overallRating: null,
      managerFeedback: '',
      selfAssessment: '',
      trainingNeeds: [],
      updatedAt: new Date().toISOString(),
      completedAt: null,
    };
    const u = userForEmployee(db, emp.id);
    commit((d) => ({
      reviews: [review, ...d.reviews],
      auditLogs: withAudit(d, auditEntry(actor, 'performance.create', 'performance_review', review.id, `Opened ${review.cycle} for ${fullName(emp)}`)),
      notifications: withNotifications(d, u ? makeNotifications([u.id], { title: 'New performance review', message: `${review.cycle} has been opened for you. Add your self-assessment.`, kind: 'performance', link: '/performance' }, actor.id) : []),
    }));
    return ok(review);
  });
}

export interface ManagerReviewUpdate {
  goals: { id: string; progress: number }[];
  ratings: PerformanceReview['ratings'];
  managerFeedback: string;
  trainingNeeds: string[];
  status: ReviewStatus;
}

export function updateReviewAsManager(actor: User | null, id: string, input: ManagerReviewUpdate): Promise<Result<PerformanceReview>> {
  return run(() => {
    requireActor(actor);
    const db = getDb();
    const before = db.reviews.find((r) => r.id === id);
    if (!before) return fail('Review not found.');
    const emp = db.employees.find((e) => e.id === before.employeeId);
    if (!emp || !canManageReview(actor, before, emp, db)) return fail('You are not authorised to update this review.');
    if (before.status === 'Completed') return fail('Completed reviews are locked.');
    const ratingVals = Object.values(input.ratings);
    if (ratingVals.some((v) => v !== null && (v < 1 || v > 5))) return fail('Ratings must be between 1 and 5.');
    if (input.goals.some((g) => g.progress < 0 || g.progress > 100)) return fail('Goal progress must be between 0 and 100%.');
    if (input.status === 'Completed') {
      const isFaculty = db.designations.find((d) => d.id === emp.designationId)?.category === 'faculty';
      const required: (keyof PerformanceReview['ratings'])[] = isFaculty ? ['teaching', 'research', 'service', 'professionalism'] : ['service', 'professionalism'];
      if (required.some((k) => input.ratings[k] === null)) return fail(`Add ratings for: ${required.filter((k) => input.ratings[k] === null).join(', ')} before completing.`);
      if (input.managerFeedback.trim().length < 10) return fail('Add manager feedback (at least 10 characters) before completing.');
    }
    const vals = ratingVals.filter((v): v is number => v !== null);
    const after: PerformanceReview = {
      ...before,
      goals: before.goals.map((g) => ({ ...g, progress: input.goals.find((x) => x.id === g.id)?.progress ?? g.progress })),
      ratings: input.ratings,
      managerFeedback: input.managerFeedback.trim(),
      trainingNeeds: input.trainingNeeds.map((t) => t.trim()).filter(Boolean),
      status: input.status,
      // Overall = simple mean of recorded ratings; no inferred labels.
      overallRating: input.status === 'Completed' && vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
      completedAt: input.status === 'Completed' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    };
    const u = userForEmployee(db, emp.id);
    commit((d) => ({
      reviews: d.reviews.map((r) => (r.id === id ? after : r)),
      auditLogs: withAudit(d, auditEntry(actor, 'performance.update', 'performance_review', id, `Updated ${after.cycle} for ${fullName(emp)} (${after.status})`)),
      notifications: withNotifications(d, u && after.status === 'Completed' ? makeNotifications([u.id], { title: 'Performance review completed', message: `Your ${after.cycle} has been completed by your reviewer.`, kind: 'performance', link: '/performance' }, actor.id) : []),
    }));
    return ok(after);
  });
}

export function submitSelfAssessment(actor: User | null, id: string, text: string, goals: { id: string; progress: number }[]): Promise<Result<PerformanceReview>> {
  return run(() => {
    requireActor(actor);
    const db = getDb();
    const before = db.reviews.find((r) => r.id === id);
    if (!before) return fail('Review not found.');
    if (before.employeeId !== actor.employeeId) return fail('You can only submit a self-assessment for your own review.');
    if (before.status === 'Completed' || before.status === 'Manager Review') return fail('This review is with your manager and can no longer be edited.');
    if (text.trim().length < 20) return fail('Self-assessment should be at least 20 characters.');
    if (goals.some((g) => g.progress < 0 || g.progress > 100)) return fail('Goal progress must be between 0 and 100%.');
    const after: PerformanceReview = {
      ...before,
      selfAssessment: text.trim(),
      goals: before.goals.map((g) => ({ ...g, progress: goals.find((x) => x.id === g.id)?.progress ?? g.progress })),
      status: 'Manager Review',
      updatedAt: new Date().toISOString(),
    };
    const reviewerUser = userForEmployee(db, before.reviewerId);
    commit((d) => ({
      reviews: d.reviews.map((r) => (r.id === id ? after : r)),
      auditLogs: withAudit(d, auditEntry(actor, 'performance.self_assessment', 'performance_review', id, `Submitted self-assessment for ${after.cycle}`)),
      notifications: withNotifications(d, reviewerUser ? makeNotifications([reviewerUser.id], { title: 'Self-assessment submitted', message: `${actor.name} submitted their self-assessment for ${after.cycle}.`, kind: 'performance', link: '/performance' }, actor.id) : []),
    }));
    return ok(after);
  });
}
