import type { HTMLAttributes, ReactNode } from 'react';
import { cn, initials } from '@/lib/utils';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />;
}

export function Avatar({ name, color, size = 'md', className }: { name: string; color?: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const s = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-9 text-sm', lg: 'size-12 text-base', xl: 'size-20 text-2xl' }[size];
  return (
    <span className={cn('inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-card', s, className)} style={{ background: color ?? '#4f46e5' }} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Progress({ value, className, tone = 'primary' }: { value: number; className?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' }) {
  const color = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-destructive' }[tone];
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">{children}</kbd>;
}

export function DemoBanner({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900 dark:border-amber-400/20 dark:bg-amber-500/10 dark:text-amber-200', className)}>{children}</div>;
}
