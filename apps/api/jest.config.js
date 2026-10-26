/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/test/tsconfig.json', diagnostics: { ignoreCodes: [151002] } }],
  },
  // The generated Prisma client uses NodeNext-style `.js` specifiers for its `.ts` files.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  collectCoverageFrom: ['src/**/*.ts', '!src/generated/**', '!src/main.ts', '!src/scripts/**'],
  coverageReporters: ['text-summary', 'lcov', 'cobertura'],
};
