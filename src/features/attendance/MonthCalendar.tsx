import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, daysInMonth, formatPeriodLong, isWeekend, parseISODate, today } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { AttendanceRecord, Holiday } from '@/data/types';
import { Button } from '@/components/ui/button';
import { Legend } from '@/components/charts/chart-kit';

const STYLE: Record<AttendanceRecord['status'], string> = {
  present: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
  late: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200',
  absent: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200',
  on_leave: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200',
};
const LABEL: Record<AttendanceRecord['status'], string> = { present: 'Present', late: 'Late', absent: 'Absent', on_leave: 'On leave' };

export function MonthCalendar({ period, onPeriodChange, records, holidays, onDayClick, selected }: { period: string; onPeriodChange: (p: string) => void; records: Map<string, AttendanceRecord>; holidays: Holiday[]; onDayClick?: (d: string) => void; selected?: string }) {
  const n = daysInMonth(period);
  const firstDow = (parseISODate(`${period}-01`).getDay() + 6) % 7; // Monday first
  const t = today();
  const cells: (string | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: n }, (_, i) => `${period}-${String(i + 1).padStart(2, '0')}`)];
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">{formatPeriodLong(period)}</p>
        <div className="flex gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Previous month" onClick={() => onPeriodChange(addMonths(period, -1))}><ChevronLeft /></Button>
          <Button variant="outline" size="icon-sm" aria-label="Next month" disabled={period >= t.slice(0, 7)} onClick={() => onPeriodChange(addMonths(period, 1))}><ChevronRight /></Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={`Attendance for ${formatPeriodLong(period)}`}>
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;
          const r = records.get(d);
          const hol = holidays.find((h) => h.date === d);
          const weekend = isWeekend(d);
          const future = d > t;
          const label = `${d}: ${r ? LABEL[r.status] : hol ? hol.name : weekend ? 'Weekend' : future ? 'Upcoming' : 'Not marked'}`;
          return (
            <button
              key={d}
              type="button"
              title={label}
              aria-label={label}
              disabled={!onDayClick}
              onClick={() => onDayClick?.(d)}
              className={cn(
                'flex h-10 flex-col sm:h-14 items-center justify-center rounded-md text-xs transition',
                r ? STYLE[r.status] : hol ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' : weekend ? 'text-muted-foreground/50' : 'bg-muted/50 text-muted-foreground',
                onDayClick && 'hover:ring-2 hover:ring-primary/40',
                d === t && 'ring-2 ring-primary',
                selected === d && 'ring-2 ring-foreground',
              )}
            >
              <span className="tabular font-medium">{Number(d.slice(8))}</span>
              {hol && <span className="hidden max-w-full truncate px-0.5 text-[9px] sm:block">{hol.name}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3">
        <Legend items={[{ label: 'Present', color: '#10b981' }, { label: 'Late', color: '#f59e0b' }, { label: 'Absent', color: '#ef4444' }, { label: 'On leave', color: '#8b5cf6' }, { label: 'Holiday', color: '#0ea5e9' }]} />
      </div>
    </div>
  );
}
