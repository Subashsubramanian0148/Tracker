import { format, formatDistanceStrict, isValid, parseISO } from 'date-fns';

const DASH = '—';

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = parseISO(iso);
  return isValid(d) ? d : null;
}

/** 6.24 → "6.2d". */
export function formatDays(days: number | null | undefined, digits = 1): string {
  if (days === null || days === undefined || !Number.isFinite(days)) return DASH;
  return `${days.toFixed(digits)}d`;
}

/** Hours rendered compactly: < 1h → "<1h", < 48h → "5.5h", else in days. */
export function formatHours(hours: number | null | undefined): string {
  if (hours === null || hours === undefined || !Number.isFinite(hours)) return DASH;
  if (hours > 0 && hours < 1) return '<1h';
  if (hours < 48) return `${round1(hours)}h`;
  return formatDays(hours / 24);
}

function round1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** "2026-05-16T…" → "16 May". */
export function formatShortDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'd MMM') : DASH;
}

export function formatDate(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'd MMM yyyy') : DASH;
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = toDate(iso);
  return d ? format(d, 'd MMM yyyy, HH:mm') : DASH;
}

/** "4 min ago" relative to `now` (passed in so render stays pure and testable). */
export function formatRelative(iso: string | null | undefined, now: number): string {
  const d = toDate(iso);
  if (!d) return DASH;
  if (Math.abs(now - d.getTime()) < 45_000) return 'just now';
  const text = formatDistanceStrict(d, now, { roundingMethod: 'floor' })
    .replace(/ minutes?/, ' min')
    .replace(/ seconds?/, ' sec');
  return d.getTime() <= now ? `${text} ago` : `in ${text}`;
}

/** Whole days between two instants (floor), never negative. */
export function daysBetween(fromIso: string | null | undefined, now: number): number | null {
  const d = toDate(fromIso);
  if (!d) return null;
  return Math.max(0, Math.floor((now - d.getTime()) / 86_400_000));
}

/** 0.823 → "82%". */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return DASH;
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** 1.254 → "1.25×". */
export function formatRatio(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return DASH;
  return `${ratio.toFixed(2)}×`;
}

export function formatNumber(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return DASH;
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

/** 1234 → "1.2k". */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Math.round(n / 1000)}k`;
}

/** "Subash S" → "SS", "ada" → "AD", "" → "?". */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '')
    .replace(/[<>()[\]{}"']/g, '')
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0] ?? '';
  if (parts.length === 1) return first.slice(0, 2).toUpperCase();
  const last = parts[parts.length - 1] ?? '';
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

/** Stable 32-bit FNV-1a hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Avatar colour pairs; every pair passes WCAG AA for 12px+ bold text. */
export const AVATAR_COLORS = [
  'bg-[#dbeafe] text-[#1e3a8a]',
  'bg-[#fce7f3] text-[#831843]',
  'bg-[#dcfce7] text-[#14532d]',
  'bg-[#fef3c7] text-[#78350f]',
  'bg-[#ede9fe] text-[#4c1d95]',
  'bg-[#ccfbf1] text-[#134e4a]',
  'bg-[#ffe4e6] text-[#881337]',
  'bg-[#e0e7ff] text-[#312e81]',
] as const;

export function avatarColor(seed: string): string {
  return AVATAR_COLORS[hashString(seed) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

/** "Product Backlog Item" → "PBI". */
export function typeShortCode(type: string): string {
  switch (type) {
    case 'Product Backlog Item':
      return 'PBI';
    case 'Issue':
      return 'ISSUE';
    case 'Bug':
      return 'BUG';
    case 'Task':
      return 'TASK';
    case 'Feature':
      return 'FEAT';
    case 'Epic':
      return 'EPIC';
    default:
      return (
        type
          .replace(/[^A-Za-z]/g, '')
          .slice(0, 4)
          .toUpperCase() || 'ITEM'
      );
  }
}

export function isOverdue(dueIso: string | null | undefined, now: number, done: boolean): boolean {
  if (done) return false;
  const d = toDate(dueIso);
  if (!d) return false;
  // Due dates are sprint end *dates*; an item is overdue only after that whole day.
  const endOfDay = new Date(d);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay.getTime() < now;
}

export function durationBetween(startIso: string, endIso: string | null): string {
  const s = toDate(startIso);
  const e = toDate(endIso);
  if (!s || !e) return DASH;
  const secs = Math.max(0, Math.round((e.getTime() - s.getTime()) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${n === 1 ? one : many}`;
}
