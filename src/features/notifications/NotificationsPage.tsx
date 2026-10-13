import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BellOff, CheckCheck, ChevronDown, Circle, CircleDot, Download, History, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, ROLE_LABELS } from '@/lib/permissions';
import { formatDateTime, timeAgo, today } from '@/lib/dates';
import { exportCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { clearReadNotifications, markAllNotificationsRead, markNotificationRead } from '@/data/services';
import type { AuditLog, Notification } from '@/data/types';
import { PageHeader, SearchInput, Toolbar } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { DataTable } from '@/components/data-table';
import { useConfirm } from '@/components/ui/confirm';
import { NotificationIcon } from './NotificationIcon';

const KINDS: { value: Notification['kind'] | ''; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'leave', label: 'Leave' },
  { value: 'employee', label: 'Employee records' },
  { value: 'payroll', label: 'Payroll' },
  { value: 'performance', label: 'Performance' },
  { value: 'recruitment', label: 'Recruitment' },
  { value: 'anniversary', label: 'Anniversaries' },
  { value: 'system', label: 'Announcements & system' },
];

export function NotificationsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'inbox';
  if (!user) return null;
  const audit = can(user, 'audit.view');
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Notifications' }]} title="Notifications" description={audit ? 'Your alerts and the institution-wide audit trail' : 'Updates about your requests, records and announcements'} />
      <Tabs value={tab} onValueChange={(t) => setParams(t === 'inbox' ? {} : { tab: t }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="inbox">Inbox</TabsTrigger>
          {audit && <TabsTrigger value="activity"><History /> Activity log</TabsTrigger>}
        </TabsList>
        <TabsContent value="inbox"><Inbox /></TabsContent>
        {audit && <TabsContent value="activity"><ActivityLog /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Inbox() {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [kind, setKind] = useState('');
  const mine = useMemo(() => db.notifications.filter((n) => n.userId === user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.notifications, user]);
  const rows = mine.filter((n) => (filter === 'all' || !n.read) && (!kind || n.kind === kind));
  const unread = mine.filter((n) => !n.read).length;
  return (
    <Card>
      <Toolbar>
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: `All (${mine.length})` }, { value: 'unread', label: `Unread (${unread})` }]} />
        <Select aria-label="Notification type" className="sm:w-56" value={kind} onChange={(e) => setKind(e.target.value)}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </Select>
        <div className="flex gap-2 sm:ml-auto">
          <Button variant="outline" size="sm" disabled={!unread} onClick={() => { const n = markAllNotificationsRead(user); toast.success(`Marked ${n} notification(s) as read`); }}><CheckCheck /> Mark all read</Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={mine.length === unread}
            onClick={async () => {
              if (!(await confirm({ title: 'Clear read notifications?', description: 'Read notifications will be removed from your inbox.', confirmLabel: 'Clear', destructive: true }))) return;
              const n = clearReadNotifications(user);
              toast.success(`Cleared ${n} notification(s)`);
            }}
          >
            <Trash2 /> Clear read
          </Button>
        </div>
      </Toolbar>
      <ul className="divide-y" aria-label="Notifications">
        {rows.map((n) => (
          <li key={n.id} className={cn('group flex items-start gap-3 px-4 py-3.5 transition hover:bg-muted/40', !n.read && 'bg-accent/30')}>
            <NotificationIcon kind={n.kind} />
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => {
                markNotificationRead(user, n.id);
                if (n.link) navigate(n.link);
              }}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className={cn('text-sm', !n.read ? 'font-semibold' : 'font-medium')}>{n.title}</span>
                {!n.read && <Badge tone="primary">New</Badge>}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{n.message}</span>
              <span className="mt-1 block text-xs text-muted-foreground/80">{timeAgo(n.createdAt)}{n.link && ' · Open related record →'}</span>
            </button>
            <Tooltip content={n.read ? 'Mark as unread' : 'Mark as read'}>
              <Button variant="ghost" size="icon-sm" aria-label={n.read ? `Mark “${n.title}” as unread` : `Mark “${n.title}” as read`} onClick={() => markNotificationRead(user, n.id, !n.read)}>
                {n.read ? <Circle /> : <CircleDot className="!text-primary" />}
              </Button>
            </Tooltip>
          </li>
        ))}
      </ul>
      {!rows.length && <EmptyState icon={<BellOff />} title={filter === 'unread' ? 'No unread notifications' : 'No notifications'} description="You’re all caught up." />}
    </Card>
  );
}

function Changes({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const entries = Object.entries(log.changes ?? {});
  if (!entries.length) return <span className="text-muted-foreground">—</span>;
  const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '∅' : String(v));
  return (
    <div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium text-primary" aria-expanded={open}>
        {entries.length} field(s) <ChevronDown className={cn('size-3 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 text-xs">
          {entries.map(([k, v]) => (
            <li key={k}><span className="font-medium">{k}</span>: <span className="text-muted-foreground line-through">{fmt(v.from)}</span> → {fmt(v.to)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityLog() {
  const { db } = useAuth();
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('');
  const [entity, setEntity] = useState('');
  const actors = [...new Map(db.auditLogs.map((a) => [a.actorId, a.actorName])).entries()];
  const entities = [...new Set(db.auditLogs.map((a) => a.entity))].sort();
  const rows = db.auditLogs.filter((a) => (!actor || a.actorId === actor) && (!entity || a.entity === entity) && (!q || `${a.summary} ${a.entityId} ${a.action}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Card>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Search activity" className="sm:w-64" />
        <Select aria-label="Acting user" className="sm:w-52" value={actor} onChange={(e) => setActor(e.target.value)}>
          <option value="">All users</option>
          {actors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </Select>
        <Select aria-label="Record type" className="sm:w-48" value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">All record types</option>
          {entities.map((e) => <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>)}
        </Select>
        <Button variant="outline" size="sm" className="sm:ml-auto" onClick={() => { exportCsv(`audit-log-${today()}.csv`, rows, [{ header: 'Timestamp', value: (a) => a.at }, { header: 'User', value: (a) => a.actorName }, { header: 'Role', value: (a) => ROLE_LABELS[a.actorRole] }, { header: 'Action', value: (a) => a.action }, { header: 'Record', value: (a) => `${a.entity}:${a.entityId}` }, { header: 'Summary', value: (a) => a.summary }, { header: 'Changes', value: (a) => (a.changes ? JSON.stringify(a.changes) : '') }]); toast.success('Audit log exported'); }}>
          <Download /> CSV
        </Button>
      </Toolbar>
      <DataTable
        rows={rows}
        getRowId={(a) => a.id}
        initialSort={{ key: 'at', dir: 'desc' }}
        pageSize={25}
        columns={[
          { key: 'at', header: 'When', sortValue: (a) => a.at, cell: (a) => <span className="whitespace-nowrap text-muted-foreground" title={a.at}>{formatDateTime(a.at)}</span> },
          { key: 'actor', header: 'User', sortValue: (a) => a.actorName, cell: (a) => <span className="whitespace-nowrap"><span className="block font-medium">{a.actorName}</span><span className="block text-xs text-muted-foreground">{ROLE_LABELS[a.actorRole]}</span></span> },
          { key: 'action', header: 'Action', hideBelow: 'md', sortValue: (a) => a.action, cell: (a) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{a.action}</code> },
          { key: 'summary', header: 'Summary', cell: (a) => <span className="text-sm">{a.summary}</span> },
          { key: 'changes', header: 'Changes', hideBelow: 'lg', cell: (a) => <Changes log={a} /> },
        ]}
        empty={<EmptyState icon={<History />} title="No activity matches your filters" />}
      />
    </Card>
  );
}
