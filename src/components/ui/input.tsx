import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const base =
  'flex w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/40';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, 'h-9 py-1', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, 'min-h-[80px] py-2 resize-y', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <div className={cn('relative', className?.includes('w-') ? '' : 'w-full')}>
    <select ref={ref} className={cn(base, 'h-9 appearance-none pr-8 py-1 cursor-pointer', className)} {...props}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
  </div>
));
Select.displayName = 'Select';

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none text-foreground', className)} {...props} />;
}

export function Field({ label, htmlFor, error, hint, required, children, className }: { label: string; htmlFor?: string; error?: string; hint?: string; required?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
      </Label>
      {children}
      {error ? (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { indeterminate?: boolean }>(({ className, indeterminate, ...props }, ref) => (
  <input
    ref={(el) => {
      if (el) el.indeterminate = !!indeterminate;
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    }}
    type="checkbox"
    className={cn('size-4 cursor-pointer rounded border-input accent-[hsl(var(--primary))]', className)}
    {...props}
  />
));
Checkbox.displayName = 'Checkbox';
