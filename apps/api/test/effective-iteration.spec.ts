import { effectiveIteration } from '../src/work-items/mappers';

describe('effectiveIteration', () => {
  it("uses the parent's sprint when the story has none of its own", () => {
    expect(
      effectiveIteration({ iterationPath: 'CORE 2.0', parentIterationPath: 'CORE 2.0\\Sprint 30' }),
    ).toEqual({ path: 'CORE 2.0\\Sprint 30', fromParent: true });
  });

  it("keeps the story's own sprint over the parent's", () => {
    expect(
      effectiveIteration({
        iterationPath: 'CORE 2.0\\Sprint 118',
        parentIterationPath: 'CORE 2.0\\Sprint 30',
      }),
    ).toEqual({ path: 'CORE 2.0\\Sprint 118', fromParent: false });
  });

  const ends = new Map([
    ['CORE 2.0\\Sprint 118', new Date('2026-03-20')],
    ['CORE 2.0\\Sprint 135', new Date('2026-11-13')],
  ]);

  it("uses the parent's sprint when the story's sprint ended before work started", () => {
    expect(
      effectiveIteration(
        {
          iterationPath: 'CORE 2.0\\Sprint 118',
          parentIterationPath: 'CORE 2.0\\Sprint 135',
          activatedDate: new Date('2026-10-28'),
        },
        ends,
      ),
    ).toEqual({ path: 'CORE 2.0\\Sprint 135', fromParent: true });
  });

  it("keeps the story's sprint when work started inside it", () => {
    expect(
      effectiveIteration(
        {
          iterationPath: 'CORE 2.0\\Sprint 118',
          parentIterationPath: 'CORE 2.0\\Sprint 135',
          activatedDate: new Date('2026-03-12'),
        },
        ends,
      ),
    ).toEqual({ path: 'CORE 2.0\\Sprint 118', fromParent: false });
  });

  it('leaves the project root when neither has a sprint', () => {
    expect(
      effectiveIteration({ iterationPath: 'CORE 2.0', parentIterationPath: 'CORE 2.0' }),
    ).toEqual({ path: 'CORE 2.0', fromParent: false });
  });
});
