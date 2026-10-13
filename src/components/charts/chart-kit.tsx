import type { ReactNode } from 'react';
import type { TooltipProps } from 'recharts';

export const C = {
  c1: 'hsl(var(--chart-1))',
  c2: 'hsl(var(--chart-2))',
  c3: 'hsl(var(--chart-3))',
  c4: 'hsl(var(--chart-4))',
  c5: 'hsl(var(--chart-5))',
  c6: 'hsl(var(--chart-6))',
  success: 'hsl(var(--success))',
  warning: 'hsl(var(--warning))',
  danger: 'hsl(var(--destructive))',
  muted: 'hsl(var(--muted-foreground))',
  grid: 'hsl(var(--border))',
};
export const SERIES = [C.c1, C.c2, C.c3, C.c4, C.c5, C.c6];

export const axisProps = {
  tick: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export function ChartTooltip({ active, payload, label, formatter }: TooltipProps<number, string> & { formatter?: (v: number, name: string) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-pop">
      {label !== undefined && <p className="mb-1 font-medium text-foreground">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p) => (
          <li key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ background: (p.color ?? (p.payload as { fill?: string })?.fill) as string }} />
            <span>{p.name}</span>
            <span className="tabular ml-auto pl-3 font-medium text-foreground">{formatter ? formatter(Number(p.value), String(p.name)) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; value?: ReactNode }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
          {i.value !== undefined && <span className="tabular font-medium text-foreground">{i.value}</span>}
        </li>
      ))}
    </ul>
  );
}
