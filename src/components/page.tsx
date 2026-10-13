import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from './ui/card';
import { InfoTip } from './ui/tooltip';
import { Input } from './ui/input';

export function Breadcrumbs({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-1.5">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" aria-hidden />}
            {it.to ? (
              <Link to={it.to} className="rounded transition hover:text-foreground">
                {it.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground/80">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function PageHeader({ title, description, actions, breadcrumbs }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; breadcrumbs?: { label: string; to?: string }[] }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, trend, tone = 'primary', to, className }: { label: string; value: ReactNode; icon?: ReactNode; hint?: ReactNode; trend?: ReactNode; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet'; to?: string; className?: string }) {
  const toneCls = {
    primary: 'bg-accent text-accent-foreground',
    success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
    warning: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
    danger: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300',
    info: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
    violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  }[tone];
  const body = (
    <Card className={cn('h-full p-4 transition', to && 'hover:border-primary/40 hover:shadow-md', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            {label}
            {hint && <InfoTip label={`About ${label}`}>{hint}</InfoTip>}
          </p>
          <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight" data-testid={`stat-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>{value}</p>
        </div>
        {icon && <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-[18px]', toneCls)}>{icon}</div>}
      </div>
      {trend && <div className="mt-2 text-xs text-muted-foreground">{trend}</div>}
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SearchInput({ value, onChange, placeholder, className, label }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; label?: string }) {
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" aria-label={label ?? placeholder ?? 'Search'} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden" />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col gap-2 border-b p-3 sm:flex-row sm:flex-wrap sm:items-center', className)}>{children}</div>;
}
