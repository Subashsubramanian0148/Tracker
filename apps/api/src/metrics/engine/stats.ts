import type { DistributionStats } from '@ado-metrics/shared';

/** Linear-interpolated percentile (same method as Excel PERCENTILE.INC). `p` in [0, 1]. */
export function percentile(sortedAsc: readonly number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0]!;
  const rank = p * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  const loV = sortedAsc[lo]!;
  const hiV = sortedAsc[hi]!;
  return loV + (hiV - loV) * (rank - lo);
}

export function distribution(values: readonly number[]): DistributionStats {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return { count: 0, avg: null, median: null, p85: null, max: null };
  const sum = sorted.reduce((s, v) => s + v, 0);
  return {
    count: sorted.length,
    avg: round(sum / sorted.length),
    median: round(percentile(sorted, 0.5)),
    p85: round(percentile(sorted, 0.85)),
    max: round(sorted[sorted.length - 1]!),
  };
}

export function round(v: number | null, digits = 2): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 24 * HOUR_MS;

export function hoursBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / HOUR_MS;
}

export function toDays(hours: number | null): number | null {
  return hours === null ? null : round(hours / 24, 1);
}

/** Monday 00:00 UTC of the week containing `d`. */
export function weekStartUtc(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}
