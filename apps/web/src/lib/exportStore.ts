import { useEffect, useSyncExternalStore } from 'react';
import { downloadCsv, type CsvRow } from './csv';

/**
 * Pages register "the current table" here; the top bar's Export button downloads it
 * as CSV, generated client-side (no server round-trip, CSP friendly).
 */
export interface ExportSource {
  filename: string;
  columns?: string[];
  rows: CsvRow[];
}

let current: ExportSource | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useExportSource(): ExportSource | null {
  return useSyncExternalStore(subscribe, () => current);
}

export function useRegisterExport(source: ExportSource | null): void {
  useEffect(() => {
    current = source;
    emit();
    return () => {
      if (current === source) {
        current = null;
        emit();
      }
    };
  }, [source]);
}

export function exportCurrent(source: ExportSource): void {
  downloadCsv(source.filename, source.rows, source.columns);
}
