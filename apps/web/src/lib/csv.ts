export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

/**
 * RFC 4180 CSV with spreadsheet formula-injection protection: cells that start with
 * = + - @ (or tab/CR) are prefixed with a quote so Excel treats them as text.
 */
export function toCsv(rows: CsvRow[], columns?: string[]): string {
  const cols = columns ?? Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [cols.map(escapeCell).join(',')];
  for (const row of rows) lines.push(cols.map((c) => escapeCell(row[c])).join(','));
  return lines.join('\r\n');
}

export function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // Spreadsheets run cells starting with these as formulas; prefix a quote whatever the type.
  if (/^[=+\-@\t\r]/.test(s) && typeof value !== 'number') s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(filename: string, rows: CsvRow[], columns?: string[]): void {
  const blob = new Blob(['﻿', toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/[^\w.-]+/g, '_');
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser a tick to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
