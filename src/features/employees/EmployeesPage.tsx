import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Eye, FilterX, MoreHorizontal, Pencil, Trash2, UserCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { formatDate, today } from '@/lib/dates';
import { exportCsv, type CsvColumn } from '@/lib/csv';
import { deleteEmployee, fullName, setEmployeesStatus } from '@/data/services';
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, type Employee, type EmploymentStatus } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, Toolbar } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Avatar, EmptyState } from '@/components/ui/misc';
import { StatusBadge } from '@/components/status';
import { DataTable, type Column } from '@/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { useConfirm } from '@/components/ui/confirm';
import { EmployeeFormSheet } from './EmployeeForm';

export function EmployeesPage() {
  const { user, db } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { pending, run } = useAsyncAction();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Employee | null>(null);
  const formOpen = params.get('new') === '1' || !!editing;

  const filters = {
    dept: params.get('dept') ?? '',
    designation: params.get('designation') ?? '',
    type: params.get('type') ?? '',
    status: params.get('status') ?? 'current',
    category: params.get('category') ?? '',
  };
  const setFilter = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    v ? next.set(k, v) : next.delete(k);
    setParams(next, { replace: true });
  };
  const hasFilters = !!(q || filters.dept || filters.designation || filters.type || filters.category || filters.status !== 'current');

  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? '—';
  const des = (id: string) => db.designations.find((d) => d.id === id);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return db.employees.filter((e) => {
      if (needle && !`${fullName(e)} ${e.id} ${e.email}`.toLowerCase().includes(needle)) return false;
      if (filters.dept && e.departmentId !== filters.dept) return false;
      if (filters.designation && e.designationId !== filters.designation) return false;
      if (filters.type && e.employmentType !== filters.type) return false;
      if (filters.category && des(e.designationId)?.category !== filters.category) return false;
      if (filters.status === 'current' && !(e.status === 'Active' || e.status === 'Probation')) return false;
      if (filters.status && filters.status !== 'current' && filters.status !== 'all' && e.status !== filters.status) return false;
      return true;
    });
  }, [db.employees, db.designations, q, filters.dept, filters.designation, filters.type, filters.status, filters.category]);

  // Drop selections that are no longer visible.
  useEffect(() => {
    setSelected((s) => {
      const ids = new Set(rows.map((r) => r.id));
      const next = new Set([...s].filter((id) => ids.has(id)));
      return next.size === s.size ? s : next;
    });
  }, [rows]);

  const csvColumns: CsvColumn<Employee>[] = [
    { header: 'Employee ID', value: (e) => e.id },
    { header: 'First Name', value: (e) => e.firstName },
    { header: 'Last Name', value: (e) => e.lastName },
    { header: 'Email', value: (e) => e.email },
    { header: 'Phone', value: (e) => e.phone },
    { header: 'Department', value: (e) => deptName(e.departmentId) },
    { header: 'Designation', value: (e) => des(e.designationId)?.title },
    { header: 'Category', value: (e) => des(e.designationId)?.category },
    { header: 'Employment Type', value: (e) => e.employmentType },
    { header: 'Joining Date', value: (e) => e.joiningDate },
    { header: 'Reporting Manager', value: (e) => { const m = db.employees.find((x) => x.id === e.reportingManagerId); return m ? fullName(m) : ''; } },
    { header: 'Status', value: (e) => e.status },
  ];

  const doExport = (list: Employee[]) => {
    if (!can(user, 'employees.export')) return toast.error('You do not have permission to export employee data.');
    exportCsv(`employees-${today()}.csv`, list, csvColumns);
    toast.success(`Exported ${list.length} employee record(s) to CSV`);
  };

  const bulkStatus = async (status: EmploymentStatus) => {
    const ids = [...selected];
    const destructive = status === 'Inactive' || status === 'Resigned';
    if (destructive && !(await confirm({ title: `Mark ${ids.length} employee(s) as ${status}?`, description: 'They will lose access and no longer appear in active headcount. You can reactivate them later.', confirmLabel: `Mark ${status}`, destructive: true }))) return;
    const r = await run('bulk', () => setEmployeesStatus(user, ids, status), (n) => `${n} employee(s) set to ${status}`);
    if (r.ok) setSelected(new Set());
  };

  const rowStatus = async (e: Employee, status: EmploymentStatus) => {
    if ((status === 'Inactive' || status === 'Resigned') && !(await confirm({ title: `Deactivate ${fullName(e)}?`, description: 'The employee will be excluded from attendance, payroll runs and active headcount until reactivated.', confirmLabel: 'Deactivate', destructive: true }))) return;
    await run('row', () => setEmployeesStatus(user, [e.id], status), `${fullName(e)} is now ${status}`);
  };

  const remove = async (e: Employee) => {
    if (!(await confirm({ title: `Permanently delete ${fullName(e)}?`, description: <>This removes the employee and their attendance, leave, payroll and review records. <strong>This cannot be undone.</strong> Consider deactivating instead.</>, confirmLabel: 'Delete permanently', destructive: true }))) return;
    await run('row', () => deleteEmployee(user, e.id), `${fullName(e)} deleted`);
  };

  const columns: Column<Employee>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortValue: (e) => fullName(e),
      cell: (e) => (
        <Link to={`/employees/${e.id}`} className="flex items-center gap-3 rounded" onClick={(ev) => ev.stopPropagation()}>
          <Avatar name={fullName(e)} color={e.avatarColor} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-medium hover:text-primary">{fullName(e)}</span>
            <span className="block truncate text-xs text-muted-foreground">{e.email}</span>
          </span>
        </Link>
      ),
    },
    { key: 'id', header: 'ID', hideBelow: 'md', sortValue: (e) => e.id, cell: (e) => <span className="tabular whitespace-nowrap text-muted-foreground">{e.id}</span> },
    { key: 'dept', header: 'Department', sortValue: (e) => deptName(e.departmentId), cell: (e) => <span className="whitespace-nowrap">{deptName(e.departmentId)}</span> },
    { key: 'des', header: 'Designation', hideBelow: 'sm', sortValue: (e) => des(e.designationId)?.title ?? '', cell: (e) => <span className="whitespace-nowrap">{des(e.designationId)?.title}</span> },
    { key: 'phone', header: 'Phone', hideBelow: '2xl', cell: (e) => <span className="tabular whitespace-nowrap text-muted-foreground">{e.phone}</span> },
    { key: 'type', header: 'Type', hideBelow: 'xl', sortValue: (e) => e.employmentType, cell: (e) => <span className="whitespace-nowrap text-muted-foreground">{e.employmentType}</span> },
    { key: 'join', header: 'Joined', hideBelow: 'lg', sortValue: (e) => e.joiningDate, cell: (e) => <span className="tabular whitespace-nowrap text-muted-foreground">{formatDate(e.joiningDate)}</span> },
    { key: 'mgr', header: 'Reports to', hideBelow: '2xl', sortValue: (e) => e.reportingManagerId ?? '', cell: (e) => { const m = db.employees.find((x) => x.id === e.reportingManagerId); return <span className="whitespace-nowrap text-muted-foreground">{m ? fullName(m) : '—'}</span>; } },
    { key: 'status', header: 'Status', sortValue: (e) => e.status, cell: (e) => <StatusBadge status={e.status} /> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      cell: (e) => (
        <div onClick={(ev) => ev.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${fullName(e)}`}><MoreHorizontal /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem icon={<Eye />} onSelect={() => navigate(`/employees/${e.id}`)}>View profile</DropdownMenuItem>
              {can(user, 'employees.edit') && <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing(e)}>Edit details</DropdownMenuItem>}
              {can(user, 'employees.deactivate') && (
                <>
                  <DropdownMenuSeparator />
                  {e.status === 'Active' || e.status === 'Probation' ? (
                    <DropdownMenuItem icon={<UserMinus />} destructive onSelect={() => rowStatus(e, 'Inactive')}>Deactivate</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem icon={<UserCheck />} onSelect={() => rowStatus(e, 'Active')}>Reactivate</DropdownMenuItem>
                  )}
                  {can(user, 'employees.delete') && <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => remove(e)}>Delete permanently</DropdownMenuItem>}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const closeForm = (o: boolean) => {
    if (o) return;
    setEditing(null);
    if (params.get('new')) setFilter('new', '');
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Employees' }]}
        title="Employee directory"
        description={`${db.employees.filter((e) => e.status === 'Active' || e.status === 'Probation').length} active of ${db.employees.length} records across ${db.departments.filter((d) => d.status === 'active').length} departments`}
        actions={
          <>
            {can(user, 'employees.export') && <Button variant="outline" onClick={() => doExport(rows)} disabled={!rows.length}><Download /> Export CSV</Button>}
            {can(user, 'employees.create') && <Button onClick={() => setFilter('new', '1')}><UserPlus /> Add employee</Button>}
          </>
        }
      />
      <Card>
        <Toolbar>
          <SearchInput value={q} onChange={setQ} placeholder="Search name, ID or email" className="sm:w-64" />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Select aria-label="Filter by department" className="sm:w-48" value={filters.dept} onChange={(e) => setFilter('dept', e.target.value)}>
              <option value="">All departments</option>
              {db.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </Select>
            <Select aria-label="Filter by designation" className="sm:w-44" value={filters.designation} onChange={(e) => setFilter('designation', e.target.value)}>
              <option value="">All designations</option>
              {[...db.designations].sort((a, b) => a.title.localeCompare(b.title)).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </Select>
            <Select aria-label="Filter by staff category" className="sm:w-40" value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
              <option value="">All staff</option>
              <option value="faculty">Faculty</option>
              <option value="administrative">Administrative</option>
            </Select>
            <Select aria-label="Filter by employment type" className="sm:w-36" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
              <option value="">All types</option>
              {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
            <Select aria-label="Filter by status" className="sm:w-36" value={filters.status} onChange={(e) => setFilter('status', e.target.value === 'current' ? '' : e.target.value)}>
              <option value="current">Current staff</option>
              <option value="all">All statuses</option>
              {EMPLOYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={() => { setQ(''); setParams({}, { replace: true }); }}>
              <FilterX /> Clear
            </Button>
          )}
        </Toolbar>
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b bg-accent/40 px-4 py-2 text-sm animate-slide-up" role="region" aria-label="Bulk actions">
            <span className="font-medium">{selected.size} selected</span>
            <span className="mx-1 h-4 w-px bg-border" />
            {can(user, 'employees.export') && <Button size="sm" variant="outline" onClick={() => doExport(db.employees.filter((e) => selected.has(e.id)))}><Download /> Export selected</Button>}
            {can(user, 'employees.edit') && <Button size="sm" variant="outline" loading={pending === 'bulk'} onClick={() => bulkStatus('Active')}><UserCheck /> Mark active</Button>}
            {can(user, 'employees.deactivate') && <Button size="sm" variant="outline" className="text-destructive" loading={pending === 'bulk'} onClick={() => bulkStatus('Inactive')}><UserMinus /> Deactivate</Button>}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        )}
        <DataTable
          caption="Employees"
          rows={rows}
          columns={columns}
          getRowId={(e) => e.id}
          initialSort={{ key: 'name', dir: 'asc' }}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          onRowClick={(e) => navigate(`/employees/${e.id}`)}
          empty={
            <EmptyState
              icon={<Users />}
              title="No employees match your filters"
              description="Try a different search term or clear the filters."
              action={<Button variant="outline" size="sm" onClick={() => { setQ(''); setParams({}, { replace: true }); }}><FilterX /> Clear filters</Button>}
            />
          }
        />
      </Card>
      <EmployeeFormSheet open={formOpen} onOpenChange={closeForm} employee={editing} onSaved={(e) => !editing && navigate(`/employees/${e.id}`)} />
    </div>
  );
}
