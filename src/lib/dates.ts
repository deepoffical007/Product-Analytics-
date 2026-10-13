import type { Holiday, ISODate } from '@/data/types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats a Date using *local* calendar fields (avoids UTC off-by-one bugs). */
export function toISODate(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

export function today(): ISODate {
  return toISODate(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number);
  const d = new Date(y!, m! - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function currentPeriod(): string {
  return today().slice(0, 7);
}

export function isWeekend(s: ISODate) {
  const day = parseISODate(s).getDay();
  return day === 0 || day === 6;
}

export function isWorkingDay(s: ISODate, holidays: Holiday[]) {
  return !isWeekend(s) && !holidays.some((h) => h.date === s);
}

export function eachDay(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 3700) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function workingDaysBetween(start: ISODate, end: ISODate, holidays: Holiday[]): ISODate[] {
  return eachDay(start, end).filter((d) => isWorkingDay(d, holidays));
}

export function rangesOverlap(aStart: ISODate, aEnd: ISODate, bStart: ISODate, bEnd: ISODate) {
  return aStart <= bEnd && bStart <= aEnd;
}

export function daysInMonth(period: string) {
  const [y, m] = period.split('-').map(Number);
  return new Date(y!, m!, 0).getDate();
}

export function monthStart(period: string): ISODate {
  return `${period}-01`;
}

export function monthEnd(period: string): ISODate {
  return `${period}-${pad(daysInMonth(period))}`;
}

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });
const monthLong = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });
const weekdayFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dtFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const formatDate = (s: ISODate | null | undefined) => (s ? dateFmt.format(parseISODate(s.slice(0, 10))) : '—');
export const formatShortDate = (s: ISODate) => shortFmt.format(parseISODate(s.slice(0, 10)));
export const formatPeriod = (p: string) => monthFmt.format(parseISODate(`${p}-01`));
export const formatPeriodLong = (p: string) => monthLong.format(parseISODate(`${p}-01`));
export const formatWeekday = (s: ISODate) => weekdayFmt.format(parseISODate(s));
export const formatDateTime = (s: string | null | undefined) => (s ? dtFmt.format(new Date(s)) : '—');

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDate(iso.slice(0, 10));
}

export function yearsBetween(from: ISODate, to: ISODate) {
  const a = parseISODate(from);
  const b = parseISODate(to);
  let y = b.getFullYear() - a.getFullYear();
  if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--;
  return y;
}

/** Days until the next yearly occurrence of a month/day (birthday, anniversary). */
export function daysUntilAnniversary(date: ISODate, from: ISODate = today()) {
  const f = parseISODate(from);
  const d = parseISODate(date);
  let next = new Date(f.getFullYear(), d.getMonth(), d.getDate());
  if (toISODate(next) < from) next = new Date(f.getFullYear() + 1, d.getMonth(), d.getDate());
  return Math.round((next.getTime() - f.getTime()) / 86400000);
}
