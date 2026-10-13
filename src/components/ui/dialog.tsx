import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ title, description, children, className, footer, size = 'md' }: { title: ReactNode; description?: ReactNode; children?: ReactNode; className?: string; footer?: ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const width = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
      <D.Content
        className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100vw-1.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-popover text-popover-foreground shadow-pop data-[state=open]:animate-scale-in focus:outline-none', width, className)}
        aria-describedby={description ? undefined : undefined}
      >
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">Dialog</D.Description>}
          </div>
          <D.Close className="-mr-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}

/** Slide-over panel (right side). */
export function SheetContent({ title, description, children, footer, className }: { title: ReactNode; description?: ReactNode; children?: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-slate-950/40 data-[state=open]:animate-fade-in" />
      <D.Content className={cn('fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l bg-popover text-popover-foreground shadow-pop data-[state=open]:animate-slide-in-right focus:outline-none', className)}>
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <D.Title className="text-base font-semibold">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">Panel</D.Description>}
          </div>
          <D.Close className="-mr-1 rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Close panel">
            <X className="size-4" />
          </D.Close>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 border-t bg-muted/30 px-5 py-3 sm:flex-row sm:justify-end">{footer}</div>}
      </D.Content>
    </D.Portal>
  );
}
