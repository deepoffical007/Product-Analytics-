import { can } from '@/lib/permissions';
import { commit, getDb } from '../store';
import { announcementSchema, firstError, type AnnouncementInput } from '../schemas';
import type { Announcement, User } from '../types';
import { auditEntry, fail, makeNotifications, ok, requireActor, run, withAudit, withNotifications, type Result } from './core';
import { uid } from '@/lib/utils';

// Notification reads are local UI state and should feel instant — no artificial latency.
export function markNotificationRead(actor: User | null, id: string, read = true) {
  if (!actor) return;
  commit((d) => ({ notifications: d.notifications.map((n) => (n.id === id && n.userId === actor.id ? { ...n, read } : n)) }));
}

export function markAllNotificationsRead(actor: User | null) {
  if (!actor) return 0;
  const n = getDb().notifications.filter((x) => x.userId === actor.id && !x.read).length;
  commit((d) => ({ notifications: d.notifications.map((x) => (x.userId === actor.id ? { ...x, read: true } : x)) }));
  return n;
}

export function clearReadNotifications(actor: User | null) {
  if (!actor) return 0;
  const n = getDb().notifications.filter((x) => x.userId === actor.id && x.read).length;
  commit((d) => ({ notifications: d.notifications.filter((x) => !(x.userId === actor.id && x.read)) }));
  return n;
}

export function createAnnouncement(actor: User | null, input: AnnouncementInput): Promise<Result<Announcement>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'announcements.manage')) return fail('You do not have permission to post announcements.');
    const parsed = announcementSchema.safeParse(input);
    if (!parsed.success) return fail(firstError(parsed.error));
    const a: Announcement = { id: uid('AN-'), ...parsed.data, createdBy: actor.id, createdAt: new Date().toISOString() };
    commit((d) => ({
      announcements: [a, ...d.announcements],
      auditLogs: withAudit(d, auditEntry(actor, 'announcement.create', 'announcement', a.id, `Posted announcement “${a.title}”`)),
      notifications: withNotifications(d, makeNotifications(d.users.filter((u) => u.active).map((u) => u.id), { title: `New ${a.category.toLowerCase()}: ${a.title}`, message: a.body.slice(0, 120), kind: 'system', link: '/dashboard' }, actor.id)),
    }));
    return ok(a);
  });
}

export function deleteAnnouncement(actor: User | null, id: string): Promise<Result<void>> {
  return run(() => {
    requireActor(actor);
    if (!can(actor, 'announcements.manage')) return fail('You do not have permission to remove announcements.');
    const a = getDb().announcements.find((x) => x.id === id);
    if (!a) return fail('Announcement not found.');
    commit((d) => ({ announcements: d.announcements.filter((x) => x.id !== id), auditLogs: withAudit(d, auditEntry(actor, 'announcement.delete', 'announcement', id, `Removed announcement “${a.title}”`)) }));
    return ok(undefined);
  });
}
