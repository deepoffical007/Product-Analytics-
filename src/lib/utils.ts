import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrCompact = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 });
const num = new Intl.NumberFormat('en-IN');

export const formatCurrency = (n: number) => inr.format(n);
export const formatCurrencyCompact = (n: number) => inrCompact.format(n);
export const formatNumber = (n: number) => num.format(n);
export const formatPercent = (n: number, digits = 1) => `${Number.isFinite(n) ? n.toFixed(digits) : '0.0'}%`;

export function uid(prefix = '') {
  const r = Math.random().toString(36).slice(2, 8);
  const t = Date.now().toString(36).slice(-4);
  return `${prefix}${t}${r}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter((p) => p && !/^(dr|prof|mr|ms|mrs)\.?$/i.test(p))
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function pluralize(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export function maskAccount(acc: string) {
  return acc.length <= 4 ? acc : `${'•'.repeat(Math.max(0, acc.length - 4))}${acc.slice(-4)}`;
}

export function groupBy<T, K extends string | number>(items: T[], key: (t: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const it of items) {
    const k = key(it);
    (out[k] ||= []).push(it);
  }
  return out;
}

export function sum(ns: number[]) {
  return ns.reduce((a, b) => a + b, 0);
}
