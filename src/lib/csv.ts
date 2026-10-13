export type CsvColumn<T> = { header: string; value: (row: T) => string | number | null | undefined };

function escape(v: unknown) {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formula injection and quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escape(c.header)).join(',');
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(','));
  return [head, ...body].join('\r\n');
}

export function downloadFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  downloadFile(filename, toCsv(rows, columns));
}
