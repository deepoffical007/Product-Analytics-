import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '@/auth/AuthContext';
import { announcementSchema, type AnnouncementInput } from '@/data/schemas';
import { createAnnouncement } from '@/data/services';
import { addDays, today } from '@/lib/dates';
import { useAsyncAction } from '@/hooks/useAsyncAction';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AnnouncementDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { user } = useAuth();
  const { pending, run } = useAsyncAction();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<AnnouncementInput>({
    resolver: zodResolver(announcementSchema),
    defaultValues: { title: '', body: '', category: 'Notice', date: addDays(today(), 3) },
  });
  const submit = handleSubmit(async (v) => {
    const r = await run('save', () => createAnnouncement(user, v), 'Announcement published to all staff');
    if (r.ok) {
      reset();
      onOpenChange(false);
    }
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="New announcement"
        description="Visible on every staff dashboard. All users receive a notification."
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={submit} loading={pending === 'save'}>Publish</Button>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Title" htmlFor="an-title" error={errors.title?.message} required>
            <Input id="an-title" {...register('title')} aria-invalid={!!errors.title} />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="an-cat">
              <Select id="an-cat" {...register('category')}>
                {['Notice', 'Event', 'Academic', 'Holiday'].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Event date" htmlFor="an-date" error={errors.date?.message} required>
              <Input id="an-date" type="date" {...register('date')} aria-invalid={!!errors.date} />
            </Field>
          </div>
          <Field label="Details" htmlFor="an-body" error={errors.body?.message} required>
            <Textarea id="an-body" rows={4} {...register('body')} aria-invalid={!!errors.body} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
