import type { PayrollRecord, StaffCategory } from './types';

export type PayComponents = Pick<PayrollRecord, 'basic' | 'hra' | 'da' | 'otherAllowances' | 'pf' | 'tax' | 'otherDeductions' | 'net'>;

/**
 * Demo salary structure (NOT a statutory payroll engine):
 *  HRA 20% · DA 12% · fixed allowance by category
 *  PF 12% of basic · simplified monthly TDS slab on gross · professional tax ₹200.
 */
export function computePayroll(basic: number, category: StaffCategory): PayComponents {
  const hra = Math.round(basic * 0.2);
  const da = Math.round(basic * 0.12);
  const otherAllowances = category === 'faculty' ? 2500 : 1500;
  const gross = basic + hra + da + otherAllowances;
  const pf = Math.round(basic * 0.12);
  const rate = gross <= 50000 ? 0 : gross <= 100000 ? 0.05 : gross <= 160000 ? 0.1 : 0.15;
  const tax = Math.round(gross * rate);
  const otherDeductions = 200;
  return { basic, hra, da, otherAllowances, pf, tax, otherDeductions, net: gross - pf - tax - otherDeductions };
}

export const grossOf = (p: Pick<PayrollRecord, 'basic' | 'hra' | 'da' | 'otherAllowances'>) => p.basic + p.hra + p.da + p.otherAllowances;
export const deductionsOf = (p: Pick<PayrollRecord, 'pf' | 'tax' | 'otherDeductions'>) => p.pf + p.tax + p.otherDeductions;

/** Validates a payroll record; returns an error message or null. Mirrors the DB CHECK constraint. */
export function validatePayroll(p: PayComponents): string | null {
  const parts = [p.basic, p.hra, p.da, p.otherAllowances, p.pf, p.tax, p.otherDeductions];
  if (parts.some((v) => !Number.isFinite(v) || v < 0)) return 'All salary components must be non-negative numbers.';
  if (p.basic <= 0) return 'Basic salary must be greater than zero.';
  if (deductionsOf(p) > grossOf(p)) return 'Total deductions cannot exceed gross salary.';
  if (p.net !== grossOf(p) - deductionsOf(p)) return 'Net salary does not equal gross minus deductions.';
  return null;
}
