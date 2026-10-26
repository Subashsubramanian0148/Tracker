import { describe, expect, it } from 'vitest';
import { formatOverUnder } from './OverviewPage';

describe('formatOverUnder', () => {
  it('turns the actual ÷ estimate ratio into a plain over/under percentage', () => {
    expect(formatOverUnder(1.22)).toBe('+22% Over');
    expect(formatOverUnder(0.85)).toBe('-15% Under');
    expect(formatOverUnder(1)).toBe('On Target');
    expect(formatOverUnder(1.004)).toBe('On Target');
    expect(formatOverUnder(null)).toBe('—');
  });
});
