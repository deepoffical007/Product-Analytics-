import { downloadFile } from '@/lib/csv';
import { formatPeriodLong, formatDate } from '@/lib/dates';
import { formatCurrency, maskAccount } from '@/lib/utils';
import { deductionsOf, grossOf } from '@/data/payroll-calc';
import type { Database, PayrollRecord } from '@/data/types';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function payslipHtml(db: Database, p: PayrollRecord) {
  const e = db.employees.find((x) => x.id === p.employeeId)!;
  const dept = db.departments.find((d) => d.id === e.departmentId)?.name ?? '';
  const des = db.designations.find((d) => d.id === e.designationId)?.title ?? '';
  const row = (k: string, v: number) => `<tr><td>${k}</td><td class="r">${formatCurrency(v)}</td></tr>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Payslip ${esc(p.period)} · ${esc(e.id)}</title>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#0f172a;max-width:760px;margin:32px auto;padding:0 20px}
.demo{background:#fef3c7;border:1px solid #f59e0b;color:#92400e;padding:8px 12px;border-radius:8px;font-size:12px;margin-bottom:20px}
header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1e2a5a;padding-bottom:12px}
h1{font-size:20px;margin:0;color:#1e2a5a}h2{font-size:14px;margin:4px 0 0;color:#475569;font-weight:500}
.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:18px 0;font-size:13px}.meta b{color:#475569;font-weight:500;display:inline-block;width:130px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:20px}table{width:100%;border-collapse:collapse;font-size:13px}
th{text-align:left;background:#eef2ff;padding:8px;color:#1e2a5a}td{padding:7px 8px;border-bottom:1px solid #e2e8f0}.r{text-align:right;font-variant-numeric:tabular-nums}
.total td{font-weight:600;border-top:2px solid #cbd5e1}.net{margin-top:20px;background:#1e2a5a;color:#fff;border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;font-size:16px}
footer{margin-top:28px;font-size:11px;color:#64748b}@media print{.demo{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body>
<div class="demo"><strong>DEMO PAYSLIP</strong> — generated from fictional sample data. Not valid for tax, banking or legal purposes.</div>
<header><div><h1>${esc(db.settings.institutionName)}</h1><h2>Salary slip for ${esc(formatPeriodLong(p.period))}</h2></div><div style="text-align:right;font-size:12px;color:#475569">Status: <strong>${esc(p.status)}</strong><br/>${p.paidOn ? `Paid on ${esc(formatDate(p.paidOn))}` : 'Not yet paid'}</div></header>
<div class="meta">
<div><b>Employee name</b>${esc(e.firstName)} ${esc(e.lastName)}</div><div><b>Employee ID</b>${esc(e.id)}</div>
<div><b>Designation</b>${esc(des)}</div><div><b>Department</b>${esc(dept)}</div>
<div><b>Bank account</b>${esc(maskAccount(e.bankAccount))}</div><div><b>Pay period</b>${esc(p.period)}</div>
</div>
<div class="cols">
<table><thead><tr><th>Earnings</th><th class="r">Amount</th></tr></thead><tbody>
${row('Basic salary', p.basic)}${row('House rent allowance', p.hra)}${row('Dearness allowance', p.da)}${row('Other allowances', p.otherAllowances)}
<tr class="total"><td>Gross earnings</td><td class="r">${formatCurrency(grossOf(p))}</td></tr></tbody></table>
<table><thead><tr><th>Deductions</th><th class="r">Amount</th></tr></thead><tbody>
${row('Provident fund', p.pf)}${row('Income tax (TDS)', p.tax)}${row('Professional tax & other', p.otherDeductions)}<tr><td>&nbsp;</td><td></td></tr>
<tr class="total"><td>Total deductions</td><td class="r">${formatCurrency(deductionsOf(p))}</td></tr></tbody></table>
</div>
<div class="net"><span>Net pay</span><strong>${formatCurrency(p.net)}</strong></div>
<footer>This is a system-generated demo document from the College Employee Management System. Generated ${esc(new Date().toLocaleString('en-IN'))}.</footer>
</body></html>`;
}

export function downloadPayslip(db: Database, p: PayrollRecord) {
  downloadFile(`payslip-${p.employeeId}-${p.period}.html`, payslipHtml(db, p), 'text/html;charset=utf-8');
}

export function printPayslip(db: Database, p: PayrollRecord) {
  const w = window.open('', '_blank', 'noopener=no,width=860,height=900');
  if (!w) return false;
  w.document.write(payslipHtml(db, p));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}
