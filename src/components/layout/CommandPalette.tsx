import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { Briefcase, Building2, CalendarDays, CornerDownLeft, Plus, Search } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { visibleEmployees, visibleLeaveRequests, fullName } from '@/data/services';
import { leaveTypeLabel } from '@/data/types';
import { Avatar } from '@/components/ui/misc';
import { StatusBadge } from '@/components/status';
import { NAV } from './nav';

const itemCls = 'flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted [&_svg]:size-4 [&_svg]:text-muted-foreground';
const groupCls = '[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground';

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const employees = useMemo(() => (user ? visibleEmployees(user, db) : []), [user, db]);
  const leaves = useMemo(() => (user ? visibleLeaveRequests(user, db).slice(0, 200) : []), [user, db]);
  if (!user) return null;
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? '';
  const desName = (id: string) => db.designations.find((d) => d.id === id)?.title ?? '';

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-pop focus:outline-none">
          <D.Title className="sr-only">Global search</D.Title>
          <D.Description className="sr-only">Search employees, departments, leave requests and pages</D.Description>
          <Command label="Global search" loop>
            <div className="flex items-center gap-2 border-b px-3">
              <Search className="size-4 text-muted-foreground" aria-hidden />
              <Command.Input autoFocus placeholder="Search by name, employee ID, email, department…" className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </div>
            <Command.List className="scrollbar-thin max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">No results found.</Command.Empty>
              <Command.Group heading="Actions" className={groupCls}>
                {can(user, 'employees.create') && (
                  <Command.Item className={itemCls} value="action add new employee onboard" onSelect={() => go('/employees?new=1')}>
                    <Plus /> Add new employee
                  </Command.Item>
                )}
                {user.employeeId && (
                  <Command.Item className={itemCls} value="action apply for leave request" onSelect={() => go('/leave-management?apply=1')}>
                    <CalendarDays /> Apply for leave
                  </Command.Item>
                )}
              </Command.Group>
              <Command.Group heading="Pages" className={groupCls}>
                {NAV.filter((n) => n.visible(user, db)).map((n) => (
                  <Command.Item key={n.to} className={itemCls} value={`page ${n.label}`} onSelect={() => go(n.to)}>
                    <n.icon /> {n.label}
                  </Command.Item>
                ))}
              </Command.Group>
              {employees.length > 0 && (
                <Command.Group heading="Employees" className={groupCls}>
                  {employees.map((e) => (
                    <Command.Item key={e.id} className={itemCls} value={`${fullName(e)} ${e.id} ${e.email} ${deptName(e.departmentId)} ${desName(e.designationId)}`} onSelect={() => go(`/employees/${e.id}`)}>
                      <Avatar name={fullName(e)} color={e.avatarColor} size="xs" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{fullName(e)}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {e.id} · {desName(e.designationId)} · {deptName(e.departmentId)}
                        </span>
                      </span>
                      <StatusBadge status={e.status} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {can(user, 'departments.view') && (
                <Command.Group heading="Departments" className={groupCls}>
                  {db.departments.map((d) => (
                    <Command.Item key={d.id} className={itemCls} value={`department ${d.name} ${d.code}`} onSelect={() => go(`/departments?dept=${d.id}`)}>
                      <Building2 /> {d.name} <span className="ml-auto text-xs text-muted-foreground">{d.code}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
              {leaves.length > 0 && (
                <Command.Group heading="Leave requests" className={groupCls}>
                  {leaves.map((r) => {
                    const e = db.employees.find((x) => x.id === r.employeeId);
                    return (
                      <Command.Item key={r.id} className={itemCls} value={`leave ${r.id} ${e ? fullName(e) : ''} ${leaveTypeLabel(r.type)} ${r.status}`} onSelect={() => go(`/leave-management?request=${r.id}`)}>
                        <CalendarDays />
                        <span className="min-w-0 flex-1 truncate">
                          {r.id} · {e ? fullName(e) : r.employeeId} · {leaveTypeLabel(r.type)}
                        </span>
                        <StatusBadge status={r.status} />
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}
              {can(user, 'recruitment.view') && (
                <Command.Group heading="Candidates" className={groupCls}>
                  {db.candidates.map((c) => (
                    <Command.Item key={c.id} className={itemCls} value={`candidate ${c.name} ${c.id} ${c.email}`} onSelect={() => go(`/recruitment?candidate=${c.id}`)}>
                      <Briefcase /> <span className="flex-1 truncate">{c.name}</span>
                      <StatusBadge status={c.stage} />
                    </Command.Item>
                  ))}
                </Command.Group>
              )}
            </Command.List>
            <div className="flex items-center gap-3 border-t px-3 py-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><CornerDownLeft className="size-3" /> to open</span>
              <span>↑↓ to navigate</span>
              <span>Esc to close</span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
