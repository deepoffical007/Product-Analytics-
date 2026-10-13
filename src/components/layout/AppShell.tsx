import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import * as D from '@radix-ui/react-dialog';
import * as P from '@radix-ui/react-popover';
import { Bell, CalendarCheck, CalendarDays, CheckCheck, ChevronsLeft, ChevronsRight, FileBarChart, GraduationCap, LogOut, Menu, Moon, Plus, Repeat, Search, Settings, Sun, UserPlus, UserRound, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { can, isTeamManager, ROLE_LABELS } from '@/lib/permissions';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/dates';
import { markAllNotificationsRead, markNotificationRead } from '@/data/services';
import { Avatar, Kbd } from '@/components/ui/misc';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { NAV, PROFILE_ITEM } from './nav';
import { CommandPalette } from './CommandPalette';
import { NotificationIcon } from '@/features/notifications/NotificationIcon';

const COLLAPSE_KEY = 'cems.sidebar.collapsed';

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user, db, employee } = useAuth();
  if (!user) return null;
  const items = NAV.filter((n) => n.visible(user, db));
  const sections = [...new Set(items.map((i) => i.section))];
  return (
    <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto px-3 py-3">
      {sections.map((s) => (
        <div key={s} className="mb-4">
          {!collapsed && <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted/80">{s}</p>}
          <ul className="space-y-0.5">
            {items
              .filter((i) => i.section === s)
              .map((item) => {
                const badge = item.badge?.(user, db) ?? 0;
                const link = (
                  <NavLink
                    to={item.to}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
                        isActive && 'bg-sidebar-accent text-sidebar-foreground before:absolute before:inset-y-1.5 before:-left-3 before:w-[3px] before:rounded-r before:bg-indigo-400',
                        collapsed && 'justify-center px-0',
                      )
                    }
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {badge > 0 && (
                      <span className={cn('tabular rounded-full bg-indigo-500 px-1.5 text-[10px] font-semibold leading-4 text-white', collapsed && 'absolute right-1 top-1')} aria-label={`${badge} pending`}>
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                );
                return <li key={item.to}>{collapsed ? <Tooltip content={item.label} side="right">{link}</Tooltip> : link}</li>;
              })}
          </ul>
        </div>
      ))}
      {employee && (
        <div className="mb-2">
          {!collapsed && <p className="mb-1 px-2 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted/80">You</p>}
          <NavLink
            to={`/employees/${employee.id}`}
            onClick={onNavigate}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground', isActive && 'bg-sidebar-accent text-sidebar-foreground', collapsed && 'justify-center px-0')}
          >
            <PROFILE_ITEM.icon className="size-[18px] shrink-0" aria-hidden />
            {!collapsed && <span>{PROFILE_ITEM.label}</span>}
          </NavLink>
        </div>
      )}
    </nav>
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  const { db } = useAuth();
  return (
    <Link to="/dashboard" className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4', collapsed && 'justify-center px-0')}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/90 text-white shadow-sm">
        <GraduationCap className="size-[18px]" aria-hidden />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">CEMS</span>
          <span className="block truncate text-[11px] text-sidebar-muted">{db.settings.institutionName}</span>
        </span>
      )}
    </Link>
  );
}

function NotificationsMenu() {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const mine = useMemo(() => db.notifications.filter((n) => n.userId === user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [db.notifications, user]);
  const unread = mine.filter((n) => !n.read).length;
  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} className="relative">
          <Bell />
          {unread > 0 && <span className="tabular absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-4 text-white">{unread > 9 ? '9+' : unread}</span>}
        </Button>
      </P.Trigger>
      <P.Portal>
        <P.Content align="end" sideOffset={8} className="z-50 w-[min(24rem,calc(100vw-1.5rem))] rounded-xl border bg-popover text-popover-foreground shadow-pop data-[state=open]:animate-slide-up">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            <Button variant="ghost" size="sm" disabled={!unread} onClick={() => markAllNotificationsRead(user)}>
              <CheckCheck /> Mark all read
            </Button>
          </div>
          <ul className="scrollbar-thin max-h-[22rem] overflow-y-auto">
            {mine.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(user, n.id);
                    setOpen(false);
                    if (n.link) navigate(n.link);
                  }}
                  className={cn('flex w-full gap-3 border-b px-4 py-3 text-left transition last:border-0 hover:bg-muted/60', !n.read && 'bg-accent/40')}
                >
                  <NotificationIcon kind={n.kind} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{n.title}</span>
                      {!n.read && <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                    </span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>
                    <span className="mt-0.5 block text-[11px] text-muted-foreground/80">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!mine.length && <li className="px-4 py-10 text-center text-sm text-muted-foreground">You’re all caught up.</li>}
          </ul>
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => { setOpen(false); navigate('/notifications'); }}>
              View all notifications
            </Button>
          </div>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

function QuickActions() {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const manager = isTeamManager(user, db);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" aria-label="Quick actions" className="max-sm:size-9 max-sm:px-0">
          <Plus /> <span className="hidden sm:inline">Quick action</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel>Quick actions</DropdownMenuLabel>
        {can(user, 'employees.create') && <DropdownMenuItem icon={<UserPlus />} onSelect={() => navigate('/employees?new=1')}>Add employee</DropdownMenuItem>}
        {can(user, 'attendance.mark') && <DropdownMenuItem icon={<CalendarCheck />} onSelect={() => navigate('/attendance')}>Record attendance</DropdownMenuItem>}
        {(can(user, 'leave.review_all') || manager) && <DropdownMenuItem icon={<CheckCheck />} onSelect={() => navigate('/leave-management?tab=approvals')}>Review leave requests</DropdownMenuItem>}
        {user.employeeId && <DropdownMenuItem icon={<CalendarDays />} onSelect={() => navigate('/leave-management?apply=1')}>Apply for leave</DropdownMenuItem>}
        {can(user, 'reports.view') && <DropdownMenuItem icon={<FileBarChart />} onSelect={() => navigate('/reports')}>Generate report</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { user, employee, logout } = useAuth();
  const navigate = useNavigate();
  const { resolved, toggle } = useTheme();
  if (!user) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex items-center gap-2 rounded-full p-0.5 pr-2 transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
          <Avatar name={user.name} color={employee?.avatarColor} size="sm" />
          <span className="hidden text-left leading-tight lg:block">
            <span className="block max-w-[10rem] truncate text-sm font-medium">{user.name}</span>
            <span className="block text-[11px] text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium text-foreground">{user.name}</span>
          <span className="block truncate">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {employee && <DropdownMenuItem icon={<UserRound />} onSelect={() => navigate(`/employees/${employee.id}`)}>My profile</DropdownMenuItem>}
        <DropdownMenuItem icon={<Settings />} onSelect={() => navigate('/settings')}>Settings</DropdownMenuItem>
        <DropdownMenuItem icon={resolved === 'dark' ? <Sun /> : <Moon />} onSelect={toggle}>{resolved === 'dark' ? 'Light theme' : 'Dark theme'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem icon={<Repeat />} onSelect={() => { logout(); navigate('/login'); }}>Switch demo role</DropdownMenuItem>
        <DropdownMenuItem icon={<LogOut />} destructive onSelect={() => { logout(); navigate('/login'); }}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { resolved, toggle } = useTheme();
  const loc = useLocation();

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [loc.pathname]);

  return (
    <div className="flex min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex', collapsed ? 'w-[68px]' : 'w-64')}>
        <Brand collapsed={collapsed} />
        <SidebarContent collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn('flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-muted transition hover:bg-sidebar-accent hover:text-sidebar-foreground', collapsed && 'justify-center px-0')}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronsRight className="size-[18px]" /> : <ChevronsLeft className="size-[18px]" />}
            {!collapsed && 'Collapse'}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <D.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-slate-950/50 md:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-sidebar text-sidebar-foreground shadow-pop data-[state=open]:animate-fade-in md:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">Main navigation menu</D.Description>
            <div className="relative">
              <Brand collapsed={false} />
              <D.Close className="absolute right-3 top-3.5 rounded p-1 text-sidebar-muted hover:text-sidebar-foreground" aria-label="Close menu">
                <X className="size-5" />
              </D.Close>
            </div>
            <SidebarContent collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-card/85 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/70 sm:px-5">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border bg-muted/50 px-3 text-sm text-muted-foreground transition hover:bg-muted sm:max-w-md"
            aria-label="Search employees, pages and records"
          >
            <Search className="size-4 shrink-0" />
            <span className="truncate">Search employees, pages, requests…</span>
            <span className="ml-auto hidden items-center gap-0.5 sm:flex">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Tooltip content="This workspace runs in demo mode with browser storage">
              <span className="hidden xl:inline-flex">
                <Badge tone="warning" dot>Demo mode</Badge>
              </span>
            </Tooltip>
            <QuickActions />
            <Button variant="ghost" size="icon" onClick={toggle} aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}>
              {resolved === 'dark' ? <Sun /> : <Moon />}
            </Button>
            <NotificationsMenu />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
