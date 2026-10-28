import { effectiveIteration } from '../src/work-items/mappers';

describe('effectiveIteration', () => {
  it("uses the parent's sprint when the story has none of its own", () => {
    expect(
      effectiveIteration({ iterationPath: 'CORE 2.0', parentIterationPath: 'CORE 2.0\\Sprint 30' }),
    ).toEqual({ path: 'CORE 2.0\\Sprint 30', fromParent: true });
  });

  it("uses the parent's sprint over the story's own", () => {
    expect(
      effectiveIteration({
        iterationPath: 'CORE 2.0\\Sprint 118',
        parentIterationPath: 'CORE 2.0\\Sprint 135',
      }),
    ).toEqual({ path: 'CORE 2.0\\Sprint 135', fromParent: true });
  });

  it("keeps the story's own sprint when the parent has none", () => {
    expect(
      effectiveIteration({
        iterationPath: 'CORE 2.0\\Sprint 118',
        parentIterationPath: 'CORE 2.0',
      }),
    ).toEqual({ path: 'CORE 2.0\\Sprint 118', fromParent: false });
  });

  it('leaves the project root when neither has a sprint', () => {
    expect(
      effectiveIteration({ iterationPath: 'CORE 2.0', parentIterationPath: 'CORE 2.0' }),
    ).toEqual({ path: 'CORE 2.0', fromParent: false });
  });
});
