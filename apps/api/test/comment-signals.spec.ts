import { commentDelay, commentSignals } from '../src/metrics/engine/comment-signals';

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

describe('commentSignals', () => {
  it.each([
    ['#reopen the spacing is off', ['REOPEN']],
    ['#sentback for changes', ['REOPEN']],
    ['#blocked waiting on copy from marketing', ['BLOCKED']],
    ['Handed off to dev #done', ['DONE']],
    ['#unblocked copy arrived', ['UNBLOCKED']],
    ["I'm done for today, will continue tomorrow", []],
    ['Not blocked by anything', []],
    ['See issue#done-ish', []],
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

  it('no longer treats a done comment on an open item as a delay', () => {
    expect(commentDelay([{ createdAt: at(1), signals: ['DONE'] }], open, at(4)).flags).toEqual([]);
  });
});
