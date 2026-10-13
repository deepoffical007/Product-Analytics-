import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/AuthContext';
import { can } from '@/lib/permissions';
import { today } from '@/lib/dates';
import { employeeSchema, type EmployeeInput } from '@/data/schemas';
import { createEmployee, fullName, nextEmployeeId, updateEmployee } from '@/data/services';
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, type Employee } from '@/data/types';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { Dialog, SheetContent } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</legend>
      {children}
    </fieldset>
  );
}

export function toInput(e: Employee): EmployeeInput {
  return {
    id: e.id,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone,
    gender: e.gender,
    dateOfBirth: e.dateOfBirth,
    address: e.address,
    emergencyContact: e.emergencyContact,
    departmentId: e.departmentId,
    designationId: e.designationId,
    employmentType: e.employmentType,
    joiningDate: e.joiningDate,
    reportingManagerId: e.reportingManagerId,
    status: e.status,
    qualification: e.qualification,
    specialization: e.specialization,
    basicSalary: e.basicSalary,
    bankAccount: e.bankAccount,
  };
}

export interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employee?: Employee | null;
  prefill?: Partial<EmployeeInput>;
  onSaved?: (e: Employee) => void;
}

export function EmployeeFormSheet({ open, onOpenChange, employee, prefill, onSaved }: EmployeeFormProps) {
  const { user, db } = useAuth();
  const { pending, run } = useAsyncAction();
  const editing = !!employee;

  const defaults = useMemo<EmployeeInput>(
    () =>
      employee
        ? toInput(employee)
        : {
            id: nextEmployeeId(db),
            firstName: '',
            lastName: '',
            email: '',
            phone: '',
            gender: 'Female',
            dateOfBirth: '',
            address: '',
            emergencyContact: '',
            departmentId: '',
            designationId: '',
            employmentType: 'Full-time',
            joiningDate: today(),
            reportingManagerId: null,
            status: 'Probation',
            qualification: '',
            specialization: '',
            basicSalary: 50000,
            bankAccount: '',
            ...prefill,
          },
    [employee, open],
  );

  const { register, handleSubmit, reset, watch, setValue, setError, formState: { errors, isDirty } } = useForm<EmployeeInput>({ resolver: zodResolver(employeeSchema), defaultValues: defaults });

  useEffect(() => {
    if (open) reset(defaults);
  }, [open, defaults, reset]);

  const deptId = watch('departmentId');
  const prevDept = useRef(deptId);
  useEffect(() => {
    // Follow the department head as default reporting manager when the department changes.
    if (!open || prevDept.current === deptId) return;
    const oldHead = db.departments.find((d) => d.id === prevDept.current)?.headId ?? null;
    const newHead = db.departments.find((d) => d.id === deptId)?.headId ?? null;
    const cur = watch('reportingManagerId');
    if ((!cur || cur === oldHead) && newHead && newHead !== employee?.id) setValue('reportingManagerId', newHead, { shouldDirty: true });
    prevDept.current = deptId;
  }, [deptId, db.departments, employee?.id, open, setValue, watch]);
  useEffect(() => {
    if (open) prevDept.current = defaults.departmentId;
  }, [open, defaults.departmentId]);

  const managers = useMemo(() => {
    const heads = new Set(db.departments.map((d) => d.headId).filter(Boolean) as string[]);
    return db.employees
      .filter((e) => (e.status === 'Active' || e.status === 'Probation') && e.id !== employee?.id)
      .filter((e) => heads.has(e.id) || (e.departmentId === deptId && (db.designations.find((d) => d.id === e.designationId)?.grade ?? 9) <= 3))
      .sort((a, b) => fullName(a).localeCompare(fullName(b)));
  }, [db, deptId, employee?.id]);

  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => (editing ? updateEmployee(user, employee!.id, v) : createEmployee(user, v)), editing ? 'Employee record updated' : `${v.firstName} ${v.lastName} added to the directory`);
    if (r.ok) {
      // Close first so the caller's close handler can't override navigation done in onSaved.
      onOpenChange(false);
      onSaved?.(r.data);
    } else if (/email/i.test(r.error)) setError('email', { message: r.error });
    else if (/Employee ID/i.test(r.error)) setError('id', { message: r.error });
  });

  const canDeactivate = can(user, 'employees.deactivate');
  const err = (k: keyof EmployeeInput) => errors[k]?.message as string | undefined;
  const inv = (k: keyof EmployeeInput) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? `emp-${k}-error` : undefined });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className="max-w-2xl"
        title={editing ? `Edit ${fullName(employee!)}` : 'Add new employee'}
        description={editing ? `${employee!.id} · changes are recorded in the audit log` : 'Fields marked * are required. The employee receives default leave balances for this year.'}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} loading={pending === 'save'} disabled={editing && !isDirty}>{editing ? 'Save changes' : 'Create employee'}</Button>
          </>
        }
      >
        <form onSubmit={submit} noValidate className="space-y-7" aria-label="Employee form">
          <Section title="Identity">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Employee ID" htmlFor="emp-id" error={err('id')} required hint="Auto-generated; must be unique">
                <Input id="emp-id" {...register('id')} readOnly={editing} {...inv('id')} />
              </Field>
              <Field label="Gender" htmlFor="emp-gender">
                <Select id="emp-gender" {...register('gender')}>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </Select>
              </Field>
              <Field label="First name" htmlFor="emp-firstName" error={err('firstName')} required>
                <Input id="emp-firstName" autoComplete="off" {...register('firstName')} {...inv('firstName')} />
              </Field>
              <Field label="Last name" htmlFor="emp-lastName" error={err('lastName')} required>
                <Input id="emp-lastName" autoComplete="off" {...register('lastName')} {...inv('lastName')} />
              </Field>
              <Field label="Date of birth" htmlFor="emp-dateOfBirth" error={err('dateOfBirth')} required>
                <Input id="emp-dateOfBirth" type="date" max={today()} {...register('dateOfBirth')} {...inv('dateOfBirth')} />
              </Field>
            </div>
          </Section>
          <Section title="Contact">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Work email" htmlFor="emp-email" error={err('email')} required>
                <Input id="emp-email" type="email" placeholder="name@northfield.edu.in" {...register('email')} {...inv('email')} />
              </Field>
              <Field label="Phone" htmlFor="emp-phone" error={err('phone')} required>
                <Input id="emp-phone" type="tel" placeholder="+91 98765 43210" {...register('phone')} {...inv('phone')} />
              </Field>
              <Field label="Address" htmlFor="emp-address" error={err('address')} className="sm:col-span-2">
                <Input id="emp-address" {...register('address')} />
              </Field>
              <Field label="Emergency contact" htmlFor="emp-emergencyContact" error={err('emergencyContact')} className="sm:col-span-2">
                <Input id="emp-emergencyContact" placeholder="Name · phone" {...register('emergencyContact')} />
              </Field>
            </div>
          </Section>
          <Section title="Employment">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Department" htmlFor="emp-departmentId" error={err('departmentId')} required>
                <Select id="emp-departmentId" {...register('departmentId')} {...inv('departmentId')}>
                  <option value="">Select department</option>
                  {db.departments.filter((d) => d.status === 'active' || d.id === employee?.departmentId).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
              <Field label="Designation" htmlFor="emp-designationId" error={err('designationId')} required>
                <Select id="emp-designationId" {...register('designationId')} {...inv('designationId')}>
                  <option value="">Select designation</option>
                  {(['faculty', 'administrative'] as const).map((cat) => (
                    <optgroup key={cat} label={cat === 'faculty' ? 'Faculty' : 'Administrative'}>
                      {db.designations.filter((d) => d.category === cat && (d.status === 'active' || d.id === employee?.designationId)).sort((a, b) => a.grade - b.grade).map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </Field>
              <Field label="Employment type" htmlFor="emp-employmentType">
                <Select id="emp-employmentType" {...register('employmentType')}>
                  {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </Select>
              </Field>
              <Field label="Status" htmlFor="emp-status" error={err('status')} hint={!canDeactivate ? 'Only a Super Admin can deactivate or mark resigned' : undefined}>
                <Select id="emp-status" {...register('status')}>
                  {EMPLOYMENT_STATUSES.filter((s) => canDeactivate || (s !== 'Inactive' && s !== 'Resigned') || s === employee?.status).map((s) => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label="Joining date" htmlFor="emp-joiningDate" error={err('joiningDate')} required>
                <Input id="emp-joiningDate" type="date" {...register('joiningDate')} {...inv('joiningDate')} />
              </Field>
              <Field label="Reporting manager" htmlFor="emp-reportingManagerId" hint="Defaults to the department head">
                <Select id="emp-reportingManagerId" {...register('reportingManagerId', { setValueAs: (v) => (v ? v : null) })}>
                  <option value="">No reporting manager</option>
                  {managers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fullName(m)} · {db.designations.find((d) => d.id === m.designationId)?.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Highest qualification" htmlFor="emp-qualification" error={err('qualification')} required>
                <Input id="emp-qualification" placeholder="e.g. Ph.D." {...register('qualification')} {...inv('qualification')} />
              </Field>
              <Field label="Specialisation" htmlFor="emp-specialization" error={err('specialization')}>
                <Input id="emp-specialization" placeholder="e.g. Machine Learning" {...register('specialization')} />
              </Field>
            </div>
          </Section>
          <Section title="Compensation (confidential)">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Basic salary (₹ / month)" htmlFor="emp-basicSalary" error={err('basicSalary')} required>
                <Input id="emp-basicSalary" type="number" inputMode="numeric" min={10000} step={500} {...register('basicSalary')} {...inv('basicSalary')} />
              </Field>
              <Field label="Bank account number" htmlFor="emp-bankAccount" error={err('bankAccount')} required>
                <Input id="emp-bankAccount" inputMode="numeric" autoComplete="off" {...register('bankAccount')} {...inv('bankAccount')} />
              </Field>
            </div>
          </Section>
          <button type="submit" hidden />
        </form>
      </SheetContent>
    </Dialog>
  );
}
