import { Bell, Briefcase, CalendarCheck, CalendarDays, Gift, Target, UserRound, Wallet } from 'lucide-react';
import type { Notification } from '@/data/types';
import { cn } from '@/lib/utils';

const MAP: Record<Notification['kind'], { icon: typeof Bell; cls: string }> = {
  leave: { icon: CalendarDays, cls: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300' },
  employee: { icon: UserRound, cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300' },
  attendance: { icon: CalendarCheck, cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' },
  payroll: { icon: Wallet, cls: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300' },
  anniversary: { icon: Gift, cls: 'bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-300' },
  recruitment: { icon: Briefcase, cls: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300' },
  performance: { icon: Target, cls: 'bg-teal-50 text-teal-600 dark:bg-teal-500/10 dark:text-teal-300' },
  system: { icon: Bell, cls: 'bg-muted text-muted-foreground' },
};

export function NotificationIcon({ kind, className }: { kind: Notification['kind']; className?: string }) {
  const m = MAP[kind] ?? MAP.system;
  return (
    <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', m.cls, className)} aria-hidden>
      <m.icon className="size-4" />
    </span>
  );
}
