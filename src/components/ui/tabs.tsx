import * as T from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Tabs = T.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof T.List>) {
  return <T.List className={cn('scrollbar-thin flex items-center gap-1 overflow-x-auto border-b', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground [&_svg]:size-4',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof T.Content>) {
  return <T.Content className={cn('pt-5 focus-visible:outline-none', className)} {...props} />;
}

/** Compact pill-style segmented control. */
export function Segmented<T extends string>({ value, onChange, options, className, size = 'md' }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; size?: 'sm' | 'md' }) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-md border bg-muted/60 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded px-2.5 font-medium text-muted-foreground transition', size === 'sm' ? 'py-0.5 text-xs' : 'py-1 text-sm', value === o.value && 'bg-card text-foreground shadow-sm')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
