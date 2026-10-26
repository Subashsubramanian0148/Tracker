import { describe, expect, it } from 'vitest';
import { validateTask } from './TaskDialog';

const ok = { title: 'Checkout mockups', workItemId: '', estimateHours: '', spentHours: '' };

describe('validateTask', () => {
  it('accepts a title with optional fields left empty', () => {
    expect(validateTask(ok)).toEqual({});
  });

  it('requires a short title', () => {
    expect(validateTask({ ...ok, title: ' a ' }).title).toBeDefined();
    expect(validateTask({ ...ok, title: 'x'.repeat(201) }).title).toBeDefined();
  });

  it('checks the story id and hours', () => {
    expect(validateTask({ ...ok, workItemId: '10.5' }).workItemId).toBeDefined();
    expect(validateTask({ ...ok, workItemId: '1079' })).toEqual({});
    expect(validateTask({ ...ok, estimateHours: '-1' }).estimateHours).toBeDefined();
    expect(validateTask({ ...ok, spentHours: 'abc' }).spentHours).toBeDefined();
  });
});
