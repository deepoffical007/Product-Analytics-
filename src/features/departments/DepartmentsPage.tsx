import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2, Download, MoreHorizontal, Pencil, Plus, Power, PowerOff, Tags, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { exportCsv } from '@/lib/csv';
import { today } from '@/lib/dates';
import { categoryOf, isCurrent } from '@/data/metrics';
import { departmentSchema, designationSchema, type DepartmentInput, type DesignationInput } from '@/data/schemas';
import { createDepartment, createDesignation, fullName, setDepartmentStatus, setDesignationStatus, updateDepartment, updateDesignation } from '@/data/services';
import type { Department, Designation } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { PageHeader, SearchInput, Toolbar } from '@/components/page';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Avatar, EmptyState } from '@/components/ui/misc';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, SheetContent } from '@/components/ui/dialog';
import { DataTable } from '@/components/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown';
import { useConfirm } from '@/components/ui/confirm';

function DepartmentDialog({ open, onOpenChange, dept }: { open: boolean; onOpenChange: (o: boolean) => void; dept: Department | null }) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, setError, formState: { errors } } = useForm<DepartmentInput>({
    resolver: zodResolver(departmentSchema),
    values: dept ? { code: dept.code, name: dept.name, headId: dept.headId, description: dept.description } : { code: '', name: '', headId: null, description: '' },
  });
  const members = dept ? db.employees.filter((e) => e.departmentId === dept.id && isCurrent(e)).sort((a, b) => (db.designations.find((d) => d.id === a.designationId)?.grade ?? 9) - (db.designations.find((d) => d.id === b.designationId)?.grade ?? 9)) : [];
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => (dept ? updateDepartment(user, dept.id, v) : createDepartment(user, v)), dept ? 'Department updated' : `Department ${v.name} created`);
    if (r.ok) onOpenChange(false);
    else if (/code/i.test(r.error)) setError('code', { message: r.error });
    else if (/named/i.test(r.error)) setError('name', { message: r.error });
    else if (/head/i.test(r.error)) setError('headId', { message: r.error });
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={dept ? `Edit ${dept.name}` : 'New department'} description={dept ? undefined : 'Assign a department head after moving employees into the new department.'} footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>{dept ? 'Save changes' : 'Create department'}</Button></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[120px_1fr]">
            <Field label="Code" htmlFor="dep-code" error={errors.code?.message} required><Input id="dep-code" className="uppercase" {...register('code')} aria-invalid={!!errors.code} /></Field>
            <Field label="Department name" htmlFor="dep-name" error={errors.name?.message} required><Input id="dep-name" {...register('name')} aria-invalid={!!errors.name} /></Field>
          </div>
          {dept && (
            <Field label="Department head" htmlFor="dep-head" error={errors.headId?.message} hint="Must be an active member of this department">
              <Select id="dep-head" {...register('headId', { setValueAs: (v) => (v ? v : null) })}>
                <option value="">No head assigned</option>
                {members.map((m) => <option key={m.id} value={m.id}>{fullName(m)} · {db.designations.find((d) => d.id === m.designationId)?.title}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Description" htmlFor="dep-desc" error={errors.description?.message}><Textarea id="dep-desc" rows={3} {...register('description')} /></Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DesignationDialog({ open, onOpenChange, des }: { open: boolean; onOpenChange: (o: boolean) => void; des: Designation | null }) {
  const { user } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, formState: { errors } } = useForm<DesignationInput>({ resolver: zodResolver(designationSchema), values: des ? { title: des.title, category: des.category, grade: des.grade } : { title: '', category: 'faculty', grade: 4 } });
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => (des ? updateDesignation(user, des.id, v) : createDesignation(user, v)), des ? 'Designation updated' : `Designation “${v.title}” created`);
    if (r.ok) onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" title={des ? 'Edit designation' : 'New designation'} footer={<><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} loading={pending === 'save'}>Save</Button></>}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <Field label="Title" htmlFor="des-title" error={errors.title?.message} required><Input id="des-title" {...register('title')} aria-invalid={!!errors.title} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Staff category" htmlFor="des-cat"><Select id="des-cat" {...register('category')}><option value="faculty">Faculty</option><option value="administrative">Administrative</option></Select></Field>
            <Field label="Grade" htmlFor="des-grade" error={errors.grade?.message} hint="1 = most senior"><Input id="des-grade" type="number" min={1} max={9} {...register('grade')} /></Field>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentsPage() {
  const { user, db } = useAuth();
  const confirm = useConfirm();
  const { run } = useAsyncAction();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [deptDialog, setDeptDialog] = useState<{ open: boolean; dept: Department | null }>({ open: false, dept: null });
  const [desDialog, setDesDialog] = useState<{ open: boolean; des: Designation | null }>({ open: false, des: null });
  const manage = can(user, 'departments.manage');
  const tab = params.get('tab') ?? 'departments';
  const viewing = db.departments.find((d) => d.id === params.get('dept'));

  const stats = useMemo(
    () =>
      new Map(
        db.departments.map((d) => {
          const emps = db.employees.filter((e) => e.departmentId === d.id && isCurrent(e));
          const faculty = emps.filter((e) => categoryOf(db, e) === 'faculty').length;
          return [d.id, { total: emps.length, faculty, admin: emps.length - faculty, emps }] as const;
        }),
      ),
    [db],
  );

  const rows = db.departments.filter((d) => (showInactive || d.status === 'active') && `${d.name} ${d.code}`.toLowerCase().includes(q.toLowerCase()));
  const head = (d: Department) => db.employees.find((e) => e.id === d.headId);

  const toggleDept = async (d: Department) => {
    if (d.status === 'active') {
      const n = stats.get(d.id)!.total;
      if (n > 0) {
        toast.error(`${d.name} still has ${n} active employee(s). Move them to another department before deactivating.`);
        return;
      }
      if (!(await confirm({ title: `Deactivate ${d.name}?`, description: 'The department will be hidden from forms and reports. You can reactivate it later.', confirmLabel: 'Deactivate', destructive: true }))) return;
    }
    await run('dept', () => setDepartmentStatus(user, d.id, d.status === 'active' ? 'inactive' : 'active'), d.status === 'active' ? `${d.name} deactivated` : `${d.name} reactivated`);
  };

  const toggleDes = async (d: Designation) => {
    if (d.status === 'active' && !(await confirm({ title: `Deactivate “${d.title}”?`, description: 'It will no longer be available when adding or editing employees.', confirmLabel: 'Deactivate', destructive: true }))) return;
    await run('des', () => setDesignationStatus(user, d.id, d.status === 'active' ? 'inactive' : 'active'), d.status === 'active' ? 'Designation deactivated' : 'Designation reactivated');
  };

  const setTab = (t: string) => setParams(t === 'departments' ? {} : { tab: t }, { replace: true });
  const openDept = (id: string | null) => {
    const next = new URLSearchParams(params);
    id ? next.set('dept', id) : next.delete('dept');
    setParams(next, { replace: true });
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/dashboard' }, { label: 'Departments' }]}
        title="Departments & designations"
        description="Organisational structure, department heads and role catalogue"
        actions={
          <>
            <Button variant="outline" onClick={() => { exportCsv(`departments-${today()}.csv`, db.departments, [{ header: 'Code', value: (d) => d.code }, { header: 'Department', value: (d) => d.name }, { header: 'Head', value: (d) => (head(d) ? fullName(head(d)!) : '') }, { header: 'Employees', value: (d) => stats.get(d.id)!.total }, { header: 'Faculty', value: (d) => stats.get(d.id)!.faculty }, { header: 'Administrative', value: (d) => stats.get(d.id)!.admin }, { header: 'Status', value: (d) => d.status }]); toast.success('Departments exported'); }}><Download /> Export</Button>
            {manage && (tab === 'designations' ? <Button onClick={() => setDesDialog({ open: true, des: null })}><Plus /> New designation</Button> : <Button onClick={() => setDeptDialog({ open: true, dept: null })}><Plus /> New department</Button>)}
          </>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="departments"><Building2 /> Departments</TabsTrigger>
          <TabsTrigger value="designations"><Tags /> Designations</TabsTrigger>
        </TabsList>
        <TabsContent value="departments">
          <Card>
            <Toolbar>
              <SearchInput value={q} onChange={setQ} placeholder="Search departments" className="sm:w-64" />
              <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show inactive</label>
            </Toolbar>
            <DataTable
              rows={rows}
              getRowId={(d) => d.id}
              onRowClick={(d) => openDept(d.id)}
              initialSort={{ key: 'total', dir: 'desc' }}
              columns={[
                { key: 'name', header: 'Department', sortValue: (d) => d.name, cell: (d) => <div className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-xs font-semibold text-accent-foreground">{d.code}</span><span className="min-w-0"><span className="block font-medium">{d.name}</span><span className="block truncate text-xs text-muted-foreground">{d.description}</span></span></div> },
                { key: 'head', header: 'Department head', sortValue: (d) => (head(d) ? fullName(head(d)!) : ''), cell: (d) => { const h = head(d); return h ? <span className="flex items-center gap-2 whitespace-nowrap"><Avatar name={fullName(h)} color={h.avatarColor} size="xs" />{fullName(h)}</span> : <Badge tone="warning">Not assigned</Badge>; } },
                { key: 'total', header: 'Employees', align: 'right', sortValue: (d) => stats.get(d.id)!.total, cell: (d) => <span className="tabular font-medium">{stats.get(d.id)!.total}</span> },
                { key: 'faculty', header: 'Faculty', align: 'right', sortValue: (d) => stats.get(d.id)!.faculty, cell: (d) => <span className="tabular">{stats.get(d.id)!.faculty}</span> },
                { key: 'admin', header: 'Admin staff', align: 'right', sortValue: (d) => stats.get(d.id)!.admin, cell: (d) => <span className="tabular">{stats.get(d.id)!.admin}</span> },
                { key: 'status', header: 'Status', sortValue: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
                {
                  key: 'actions',
                  header: <span className="sr-only">Actions</span>,
                  align: 'right',
                  cell: (d) =>
                    manage ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem icon={<Users />} onSelect={() => openDept(d.id)}>View members</DropdownMenuItem>
                            <DropdownMenuItem icon={<Pencil />} onSelect={() => setDeptDialog({ open: true, dept: d })}>Edit / assign head</DropdownMenuItem>
                            {d.status === 'active' ? <DropdownMenuItem icon={<PowerOff />} destructive onSelect={() => toggleDept(d)}>Deactivate{stats.get(d.id)!.total ? ` (${stats.get(d.id)!.total} active)` : ''}</DropdownMenuItem> : <DropdownMenuItem icon={<Power />} onSelect={() => toggleDept(d)}>Reactivate</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    ) : null,
                },
              ]}
              empty={<EmptyState icon={<Building2 />} title="No departments found" />}
            />
          </Card>
        </TabsContent>
        <TabsContent value="designations">
          <Card>
            <p className="border-b px-4 py-3 text-xs text-muted-foreground">Grade is the seniority band used for reporting lines — 1 is the most senior. Designations held by active employees cannot be deactivated.</p>
            <DataTable
              rows={db.designations}
              getRowId={(d) => d.id}
              initialSort={{ key: 'grade', dir: 'asc' }}
              pageSize={25}
              columns={[
                { key: 'title', header: 'Designation', sortValue: (d) => d.title, cell: (d) => <span className="font-medium">{d.title}</span> },
                { key: 'cat', header: 'Category', sortValue: (d) => d.category, cell: (d) => <Badge tone={d.category === 'faculty' ? 'primary' : 'info'}>{d.category === 'faculty' ? 'Faculty' : 'Administrative'}</Badge> },
                { key: 'grade', header: 'Grade', sortValue: (d) => d.grade, cell: (d) => <span className="tabular">{d.grade}</span> },
                { key: 'holders', header: 'Active holders', align: 'right', sortValue: (d) => db.employees.filter((e) => e.designationId === d.id && isCurrent(e)).length, cell: (d) => <Link onClick={(e) => e.stopPropagation()} className="tabular text-primary hover:underline" to={`/employees?designation=${d.id}`}>{db.employees.filter((e) => e.designationId === d.id && isCurrent(e)).length}</Link> },
                { key: 'status', header: 'Status', sortValue: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
                {
                  key: 'actions',
                  header: <span className="sr-only">Actions</span>,
                  align: 'right',
                  cell: (d) =>
                    manage ? (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon-sm" aria-label={`Edit ${d.title}`} onClick={() => setDesDialog({ open: true, des: d })}><Pencil /></Button>
                        <Button variant="ghost" size="icon-sm" aria-label={d.status === 'active' ? `Deactivate ${d.title}` : `Reactivate ${d.title}`} onClick={() => toggleDes(d)}>{d.status === 'active' ? <PowerOff /> : <Power />}</Button>
                      </div>
                    ) : null,
                },
              ]}
            />
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!viewing} onOpenChange={(o) => !o && openDept(null)}>
        {viewing && (
          <SheetContent
            title={viewing.name}
            description={`${viewing.code} · ${stats.get(viewing.id)!.total} active employees`}
            footer={manage ? <Button onClick={() => { setDeptDialog({ open: true, dept: viewing }); }}><Pencil /> Edit department</Button> : undefined}
          >
            <p className="mb-4 text-sm text-muted-foreground">{viewing.description}</p>
            <div className="mb-5 grid grid-cols-3 gap-2">
              {[['Total', stats.get(viewing.id)!.total], ['Faculty', stats.get(viewing.id)!.faculty], ['Admin', stats.get(viewing.id)!.admin]].map(([k, v]) => (
                <div key={k} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{k}</p><p className="tabular text-lg font-semibold">{v}</p></div>
              ))}
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
            <ul className="divide-y rounded-md border">
              {stats.get(viewing.id)!.emps.map((e) => (
                <li key={e.id}>
                  <Link to={`/employees/${e.id}`} className="flex items-center gap-3 px-3 py-2 transition hover:bg-muted/50">
                    <Avatar name={fullName(e)} color={e.avatarColor} size="sm" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{fullName(e)}</span><span className="block text-xs text-muted-foreground">{db.designations.find((d) => d.id === e.designationId)?.title}</span></span>
                    {viewing.headId === e.id && <Badge tone="primary">Head</Badge>}
                  </Link>
                </li>
              ))}
              {!stats.get(viewing.id)!.emps.length && <li><EmptyState icon={<Users />} title="No active members" className="py-6" /></li>}
            </ul>
          </SheetContent>
        )}
      </Dialog>
      <DepartmentDialog open={deptDialog.open} dept={deptDialog.dept} onOpenChange={(o) => setDeptDialog((s) => ({ ...s, open: o }))} />
      <DesignationDialog open={desDialog.open} des={desDialog.des} onOpenChange={(o) => setDesDialog((s) => ({ ...s, open: o }))} />
    </div>
  );
}
