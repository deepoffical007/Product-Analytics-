import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, GraduationCap, KeyRound, Lock, RotateCcw, ShieldCheck, UserRound, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, DEMO_PASSWORD } from '@/auth/AuthContext';
import { DEMO_USERS } from '@/data/seed';
import { resetDemoData } from '@/data/services';
import { ROLE_LABELS } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Avatar, DemoBanner } from '@/components/ui/misc';
import { useConfirm } from '@/components/ui/confirm';
import { cn } from '@/lib/utils';

const PERSONAS = [
  { id: DEMO_USERS.admin, icon: ShieldCheck, blurb: 'Full access: all modules, departments, user roles and system settings.' },
  { id: DEMO_USERS.hr, icon: Users, blurb: 'Onboarding, attendance, leave approvals, payroll, performance and reports.' },
  { id: DEMO_USERS.head, icon: Briefcase, blurb: 'Faculty member who heads CSE — approves team leave and reviews.' },
  { id: DEMO_USERS.faculty, icon: UserRound, blurb: 'Personal dashboard, leave requests, attendance history and payslips.' },
];

export function LoginPage() {
  const { user, db, login, loginWithPassword } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const confirm = useConfirm();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const from = (loc.state as { from?: string } | null)?.from ?? '/dashboard';

  if (user) return <Navigate to={from} replace />;

  const enter = (id: string) => {
    setBusy(id);
    setTimeout(() => {
      login(id);
      const u = db.users.find((x) => x.id === id);
      toast.success(`Signed in as ${u?.name}`, { description: ROLE_LABELS[u!.role] });
      navigate(from, { replace: true });
    }, 350);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) return setError('Enter your email address.');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.');
    if (!password) return setError('Enter your password.');
    setBusy('form');
    setTimeout(() => {
      const err = loginWithPassword(email, password);
      setBusy(null);
      if (err) return setError(err);
      toast.success('Welcome back');
      navigate(from, { replace: true });
    }, 400);
  };

  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-indigo-500 text-white"><GraduationCap className="size-5" /></span>
          <div>
            <p className="font-semibold">CEMS</p>
            <p className="text-xs text-sidebar-muted">{db.settings.institutionName}</p>
          </div>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Everything your college needs to manage its people.</h2>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">Faculty and staff records, attendance, leave workflows, payroll, performance reviews and recruitment — connected, auditable and role-aware.</p>
          <dl className="mt-8 grid grid-cols-3 gap-4">
            {[
              ['Employees', db.employees.filter((e) => e.status !== 'Resigned').length],
              ['Departments', db.departments.filter((d) => d.status === 'active').length],
              ['Open roles', db.jobs.filter((j) => j.status === 'Open').length],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-sidebar-border bg-sidebar-accent/50 p-3">
                <dt className="text-[11px] uppercase tracking-wider text-sidebar-muted">{k}</dt>
                <dd className="tabular mt-1 text-xl font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className="relative text-xs text-sidebar-muted">Demo workspace · fictional data · © {new Date().getFullYear()}</p>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-lg">
          <div className="mb-6 flex items-center gap-2 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><GraduationCap className="size-5" /></span>
            <span className="font-semibold">CEMS · {db.settings.institutionShort}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose a demo persona to explore each role, or sign in with email.</p>

          <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PERSONAS.map((p) => {
              const u = db.users.find((x) => x.id === p.id);
              if (!u) return null;
              const emp = db.employees.find((e) => e.id === u.employeeId);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => enter(p.id)}
                  disabled={!!busy || !u.active}
                  data-testid={`login-${p.id}`}
                  className={cn('group flex flex-col rounded-lg border bg-card p-3.5 text-left shadow-card transition hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60', busy === p.id && 'border-primary ring-2 ring-primary/30')}
                >
                  <span className="flex items-center gap-2.5">
                    <Avatar name={u.name} color={emp?.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{u.name}</span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><p.icon className="size-3" /> {p.id === DEMO_USERS.head ? 'Faculty · Department Head' : ROLE_LABELS[u.role]}</span>
                    </span>
                    <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
                  </span>
                  <span className="mt-2 text-xs leading-relaxed text-muted-foreground">{p.blurb}</span>
                </button>
              );
            })}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or sign in with email <span className="h-px flex-1 bg-border" />
          </div>

          <Card className="p-5">
            <form onSubmit={submit} noValidate className="space-y-4">
              <Field label="Email" htmlFor="email">
                <Input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@northfield.edu.in" aria-invalid={!!error && !email} />
              </Field>
              <Field label="Password" htmlFor="password" hint={`Demo password for all accounts: ${DEMO_PASSWORD}`}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="password" type="password" autoComplete="current-password" className="pl-8" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
              </Field>
              {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
              <Button type="submit" className="w-full" loading={busy === 'form'}>
                <KeyRound /> Sign in
              </Button>
              <p className="text-center text-xs text-muted-foreground">Try {db.users.find((u) => u.id === DEMO_USERS.hr)?.email}</p>
            </form>
          </Card>

          <DemoBanner className="mt-5 text-xs">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" />
            <span>
              <strong>Demo mode.</strong> Data is stored in this browser and authentication is simulated — it is not production security. Connect Supabase Auth with row-level security before handling real employee data.{' '}
              <button
                type="button"
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
                onClick={async () => {
                  if (await confirm({ title: 'Reset demo data?', description: 'All changes made in this browser will be discarded and the sample data restored.', confirmLabel: 'Reset data', destructive: true })) {
                    resetDemoData();
                    toast.success('Demo data restored');
                  }
                }}
              >
                <RotateCcw className="size-3" /> Reset demo data
              </button>
            </span>
          </DemoBanner>
        </div>
      </div>
    </div>
  );
}
