import { describe, expect, it } from 'vitest';
import { escapeCell, toCsv } from './csv';
import {
  avatarColor,
  AVATAR_COLORS,
  daysBetween,
  formatDays,
  formatHours,
  formatPercent,
  formatRatio,
  formatRelative,
  formatShortDate,
  initials,
  isOverdue,
  typeShortCode,
} from './format';

describe('format', () => {
  it('formats days and hours', () => {
    expect(formatDays(6.24)).toBe('6.2d');
    expect(formatDays(null)).toBe('—');
    expect(formatHours(0.5)).toBe('<1h');
    expect(formatHours(5)).toBe('5h');
    expect(formatHours(5.25)).toBe('5.3h');
    expect(formatHours(72)).toBe('3.0d');
    expect(formatHours(undefined)).toBe('—');
  });

  it('formats percent and ratios', () => {
    expect(formatPercent(0.823)).toBe('82%');
    expect(formatPercent(null)).toBe('—');
    expect(formatRatio(1.254)).toBe('1.25×');
  });

  it('formats dates', () => {
    expect(formatShortDate('2026-05-16T00:00:00Z')).toMatch(/^1[56] May$/);
    expect(formatShortDate('not a date')).toBe('—');
  });

  it('formats relative times against an explicit now', () => {
    const now = Date.parse('2026-10-22T12:00:00Z');
    expect(formatRelative('2026-10-22T11:56:00Z', now)).toBe('4 min ago');
    expect(formatRelative('2026-10-22T11:59:50Z', now)).toBe('just now');
    expect(formatRelative('2026-10-20T12:00:00Z', now)).toBe('2 days ago');
    expect(daysBetween('2026-10-18T12:00:00Z', now)).toBe(4);
  });

  it('computes initials', () => {
    expect(initials('Subash S')).toBe('SS');
    expect(initials('ada lovelace byron')).toBe('AB');
    expect(initials('ada')).toBe('AD');
    expect(initials('')).toBe('?');
    expect(initials(null)).toBe('?');
  });

  it('picks a deterministic avatar colour', () => {
    expect(avatarColor('user-1')).toBe(avatarColor('user-1'));
    expect(AVATAR_COLORS).toContain(avatarColor('anyone'));
  });

  it('maps work item types to short codes', () => {
    expect(typeShortCode('Product Backlog Item')).toBe('PBI');
    expect(typeShortCode('Bug')).toBe('BUG');
    expect(typeShortCode('Impediment')).toBe('IMPE');
  });

  it('detects overdue items only after the due day and when not done', () => {
    const now = Date.parse('2026-05-18T10:00:00');
    expect(isOverdue('2026-05-16T00:00:00', now, false)).toBe(true);
    expect(isOverdue('2026-05-16T00:00:00', now, true)).toBe(false);
    expect(isOverdue('2026-05-18T00:00:00', now, false)).toBe(false);
    expect(isOverdue(null, now, false)).toBe(false);
  });
});

describe('csv', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(escapeCell('a,b')).toBe('"a,b"');
    expect(escapeCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCell(null)).toBe('');
  });

  it('neutralises spreadsheet formulas', () => {
    expect(escapeCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(escapeCell('+1')).toBe("'+1");
    expect(escapeCell(-1)).toBe('-1');
  });

  it('builds a CSV with a header row', () => {
    expect(toCsv([{ a: 1, b: 'x' }, { a: 2 }])).toBe('a,b\r\n1,x\r\n2,');
  });
});
