import { commentDelay, commentSignals } from '../src/metrics/engine/comment-signals';

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

describe('commentSignals', () => {
  it.each([
    ['Reopening this, the spacing is off', ['REOPEN']],
    ['Sent back for changes', ['REOPEN']],
    ['Blocked: waiting on copy from marketing', ['BLOCKED']],
    ['Completed and handed off to dev', ['DONE']],
    ['Mockups are done', ['DONE']],
    ['Not done yet, still polishing', ['REOPEN']],
    ['Unblocked now, copy arrived', ['UNBLOCKED']],
    ['No longer blocked', ['UNBLOCKED']],
    ['Looks good to me', []],
  ])('%s', (text, expected) => {
    expect(commentSignals(text)).toEqual(expected);
  });
});

describe('commentDelay', () => {
  const open = { stateCategory: 'InProgress' as const, completedDate: null };

  it('counts a blocked hold until the unblocked comment', () => {
    const r = commentDelay(
      [
        { createdAt: at(1), signals: ['BLOCKED'] },
        { createdAt: at(4), signals: ['UNBLOCKED'] },
      ],
      open,
      at(10),
    );
    expect(r.hours).toBe(72);
    expect(r.flags).toEqual([]);
  });

  it('keeps an open blocked hold running and flags it', () => {
    const r = commentDelay([{ createdAt: at(1), signals: ['BLOCKED'] }], open, at(3));
    expect(r.hours).toBe(48);
    expect(r.flags).toEqual(['BLOCKED_IN_COMMENTS']);
  });

  it('ends a reopen hold at completion', () => {
    const r = commentDelay(
      [{ createdAt: at(1), signals: ['REOPEN'] }],
      { stateCategory: 'Completed', completedDate: at(2) },
      at(10),
    );
    expect(r.hours).toBe(24);
    expect(r.flags).toEqual(['REOPENED_IN_COMMENTS']);
  });

  it('flags work said to be done but still open after two days', () => {
    expect(commentDelay([{ createdAt: at(1), signals: ['DONE'] }], open, at(4)).flags).toEqual(['DONE_NOT_CLOSED']);
    expect(commentDelay([{ createdAt: at(1), signals: ['DONE'] }], open, at(2)).flags).toEqual([]);
  });
});
