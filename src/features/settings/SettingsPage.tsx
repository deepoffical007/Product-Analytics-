import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building, CalendarDays, Database, Monitor, Moon, Palette, RotateCcw, ShieldCheck, Sun, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can, ROLE_LABELS, ROLE_PERMISSIONS } from '@/lib/permissions';
import { formatDate, formatDateTime, today } from '@/lib/dates';
import { useTheme, type ThemePref } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { getPersistError, storageSize } from '@/data/store';
import { resetDemoData, updateInstitution, updateLeavePolicy, updateUserAccess } from '@/data/services';
import { LEAVE_TYPES, type LeaveType, type Role } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader } from '@/components/page';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Avatar, DemoBanner } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { useConfirm } from '@/components/ui/confirm';

const SECTIONS = [
  { id: 'preferences', label: 'Preferences', icon: Palette, show: () => true },
  { id: 'institution', label: 'Institution', icon: Building, show: () => true },
  { id: 'leave', label: 'Leave policy & holidays', icon: CalendarDays, show: () => true },
  { id: 'users', label: 'Users & roles', icon: UserCog, show: (r: Role) => r === 'super_admin' },
  { id: 'data', label: 'Data & backend', icon: Database, show: () => true },
] as const;

export function SettingsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  if (!user) return null;
  const sections = SECTIONS.filter((s) => s.show(user.role));
  const active = sections.find((s) => s.id === params.get('section'))?.id ?? 'preferences';
  return (
    <div>
      <PageHeader breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Settings' }]} title="Settings" description="Personal preferences and system configuration" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Settings sections">
          <ul className="scrollbar-thin flex gap-1 overflow-x-auto lg:flex-col">
            {sections.map((s) => (
              <li key={s.id} className="shrink-0">
                <button type="button" onClick={() => setParams({ section: s.id }, { replace: true })} aria-current={active === s.id ? 'page' : undefined} className={cn('flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground', active === s.id && 'bg-card text-foreground shadow-card ring-1 ring-border')}>
                  <s.icon className="size-4" /> {s.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-4">
          {active === 'preferences' && <Preferences />}
          {active === 'institution' && <Institution />}
          {active === 'leave' && <LeavePolicy />}
          {active === 'users' && <Users />}
          {active === 'data' && <DataBackend />}
        </div>
      </div>
    </div>
  );
}

function Preferences() {
  const { user, employee } = useAuth();
  const { pref, setPref } = useTheme();
  if (!user) return null;
  const opts: { value: ThemePref; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: 'Light', icon: Sun },
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'system', label: 'System', icon: Monitor },
  ];
  const perms = [...ROLE_PERMISSIONS[user.role]];
  return (
    <>
      <Card>
        <CardHeader title="Account" />
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar name={user.name} color={employee?.avatarColor} size="lg" />
          <div className="flex-1">
            <p className="font-semibold">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-1 flex gap-2"><Badge tone="primary">{ROLE_LABELS[user.role]}</Badge>{employee && <Badge>{employee.id}</Badge>}</div>
          </div>
          {employee && <Link to={`/employees/${employee.id}?tab=personal`}><Button variant="outline">Edit contact details</Button></Link>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Appearance" description="Choose how CEMS looks on this device" />
        <CardContent>
          <div role="radiogroup" aria-label="Theme" className="grid max-w-md grid-cols-3 gap-3">
            {opts.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={pref === o.value} onClick={() => { setPref(o.value); toast.success(`Theme set to ${o.label.toLowerCase()}`); }} className={cn('flex flex-col items-center gap-2 rounded-lg border p-4 text-sm font-medium transition hover:border-primary/40', pref === o.value && 'border-primary ring-2 ring-primary/20')}>
                <o.icon className="size-5" /> {o.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Your permissions" description="Determined by your role; managers also get scoped access to their team" />
        <CardContent className="flex flex-wrap gap-1.5">
          {perms.length ? perms.map((p) => <Badge key={p}>{p}</Badge>) : <p className="text-sm text-muted-foreground">Self-service access: your profile, attendance, leave, payslips, reviews and notifications{employee ? '. If you manage a team, you can also review their leave and performance.' : '.'}</p>}
        </CardContent>
      </Card>
    </>
  );
}

function Institution() {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const editable = can(user, 'settings.manage');
  const [form, setForm] = useState({ institutionName: db.settings.institutionName, workdayStart: db.settings.workdayStart, lateAfter: db.settings.lateAfter });
  return (
    <Card>
      <CardHeader title="Institution" description={editable ? 'Visible throughout the application and on payslips' : 'Only a Super Admin can change these settings'} />
      <CardContent>
        <form className="grid grid-cols-1 max-w-xl gap-4 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run('save', () => updateInstitution(user, form), 'Institution settings saved'); }}>
          <Field label="Institution name" htmlFor="inst-name" className="sm:col-span-2"><Input id="inst-name" disabled={!editable} value={form.institutionName} onChange={(e) => setForm({ ...form, institutionName: e.target.value })} /></Field>
          <Field label="Workday starts" htmlFor="inst-start"><Input id="inst-start" type="time" disabled={!editable} value={form.workdayStart} onChange={(e) => setForm({ ...form, workdayStart: e.target.value })} /></Field>
          <Field label="Late after" htmlFor="inst-late" hint="Check-ins after this time count as late"><Input id="inst-late" type="time" disabled={!editable} value={form.lateAfter} onChange={(e) => setForm({ ...form, lateAfter: e.target.value })} /></Field>
          {editable && <div className="sm:col-span-2"><Button type="submit" loading={pending === 'save'}>Save changes</Button></div>}
        </form>
      </CardContent>
    </Card>
  );
}

function LeavePolicy() {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const editable = can(user, 'settings.manage');
  const [policy, setPolicy] = useState<Record<LeaveType, number | ''>>(db.settings.leavePolicy);
  useEffect(() => setPolicy(db.settings.leavePolicy), [db.settings.leavePolicy]);
  const year = today().slice(0, 4);
  const holidays = db.settings.holidays.filter((h) => h.date.startsWith(year));
  return (
    <>
      <Card>
        <CardHeader title="Annual leave entitlements" description={`Applies to ${year} balances. Used days are always derived from approved requests, so changing entitlements never double-counts.`} />
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (Object.values(policy).some((v) => v === '')) return toast.error('Enter an entitlement for every leave type.');
              run('save', () => updateLeavePolicy(user, policy as Record<LeaveType, number>), 'Leave policy updated');
            }}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LEAVE_TYPES.map((l) => (
                <Field key={l.value} label={l.label} htmlFor={`pol-${l.value}`} hint="days per year">
                  <Input id={`pol-${l.value}`} type="number" min={0} max={60} disabled={!editable} value={policy[l.value]} onChange={(e) => setPolicy({ ...policy, [l.value]: e.target.value === '' ? '' : Number(e.target.value) })} />
                </Field>
              ))}
            </div>
            {editable ? <Button type="submit" loading={pending === 'save'}>Save policy</Button> : <p className="text-xs text-muted-foreground">Only a Super Admin can change the leave policy.</p>}
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader title={`College holidays ${year}`} description="Excluded from attendance and leave day counts" />
        <ul className="divide-y border-t">
          {holidays.map((h) => (
            <li key={h.date} className="flex items-center justify-between px-5 py-2.5 text-sm">
              <span className="font-medium">{h.name}</span>
              <span className="flex items-center gap-2 text-muted-foreground">{formatDate(h.date)} {h.date < today() && <Badge>Past</Badge>}</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Users() {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  return (
    <Card>
      <CardHeader title="Users & roles" description="Role changes take effect immediately and are recorded in the audit log" />
      <ul className="divide-y border-t">
        {db.users.map((u) => {
          const emp = db.employees.find((e) => e.id === u.employeeId);
          const self = u.id === user?.id;
          return (
            <li key={u.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
              <Avatar name={u.name} color={emp?.avatarColor} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{u.name} {self && <Badge className="ml-1">You</Badge>}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email} · last change {formatDateTime(db.auditLogs.find((a) => a.entityId === u.id)?.at ?? null)}</p>
              </div>
              <Select aria-label={`Role for ${u.name}`} className="h-8 text-xs sm:w-48" value={u.role} disabled={self || pending === u.id} onChange={(e) => run(u.id, () => updateUserAccess(user, u.id, { role: e.target.value as Role }), `${u.name} is now ${ROLE_LABELS[e.target.value as Role]}`)}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </Select>
              <Button size="sm" variant={u.active ? 'outline' : 'default'} disabled={self} loading={pending === `${u.id}-a`} onClick={() => run(`${u.id}-a`, () => updateUserAccess(user, u.id, { active: !u.active }), u.active ? `${u.name}’s access disabled` : `${u.name}’s access restored`)}>
                {u.active ? 'Disable' : 'Enable'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function DataBackend() {
  const { user, db, logout } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const size = storageSize();
  const err = getPersistError();
  const canReset = can(user, 'reports.view');
  return (
    <>
      <DemoBanner>
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span><strong>Demo mode is active.</strong> All data lives in this browser’s local storage and sign-in is simulated. This is suitable for evaluation only — not for real employee or salary data.</span>
      </DemoBanner>
      <Card>
        <CardHeader title="Storage" />
        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div><p className="text-xs text-muted-foreground">Persistence layer</p><p className="font-medium">Browser localStorage</p></div>
          <div><p className="text-xs text-muted-foreground">Data size</p><p className="tabular font-medium">{(size / 1024).toFixed(0)} KB</p></div>
          <div><p className="text-xs text-muted-foreground">Sample data created</p><p className="font-medium">{formatDateTime(db.seededAt)}</p></div>
          {err && <p className="text-destructive sm:col-span-3">Last save failed: {err}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Reset demo data" description="Restore the original sample college. Every change made in this browser is discarded." />
        <CardContent>
          <Button
            variant="destructive"
            disabled={!canReset}
            onClick={async () => {
              if (!(await confirm({ title: 'Reset all demo data?', description: 'Employees, attendance, leave, payroll, reviews, recruitment, notifications and audit logs will be restored to the original sample data. You will be signed out.', confirmLabel: 'Reset data', destructive: true }))) return;
              resetDemoData();
              logout();
              toast.success('Demo data restored — sign in again to continue');
              navigate('/login');
            }}
          >
            <RotateCcw /> Reset demo data
          </Button>
          {!canReset && <p className="mt-2 text-xs text-muted-foreground">Ask HR or a Super Admin, or use the reset link on the sign-in page.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader title="Connecting a production backend" description="What you need to go live" />
        <CardContent className="space-y-2 text-sm text-muted-foreground [overflow-wrap:anywhere]">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>Create a Supabase project (PostgreSQL + Auth) and run <code className="rounded bg-muted px-1">supabase/migrations/0001_cems_schema.sql</code>.</li>
            <li>Set <code className="rounded bg-muted px-1">VITE_SUPABASE_URL</code> and <code className="rounded bg-muted px-1">VITE_SUPABASE_ANON_KEY</code> in <code className="rounded bg-muted px-1">.env.local</code>. Never put the service-role key in frontend code.</li>
            <li>Replace the service functions in <code className="rounded bg-muted px-1">src/data/services</code> with Supabase queries — row-level security policies in the migration enforce role access server-side.</li>
            <li>Connect a verified payroll provider before processing real salaries.</li>
          </ol>
          <p>See the README for the full setup guide.</p>
        </CardContent>
      </Card>
    </>
  );
}
