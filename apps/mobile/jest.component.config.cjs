module.exports = {
  preset: 'jest-expo',
  modulePathIgnorePatterns: ['<rootDir>/.qa/'],
  testMatch: ['<rootDir>/tests/component/**/*.test.ts?(x)'],
  setupFilesAfterEnv: ['<rootDir>/tests/component/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'features/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    // Platform variants that this (ios) component run never loads.
    '!**/*.web.{ts,tsx}',
    '!components/ui/icon-symbol.tsx',
    // Static web shell; not a React Native component.
    '!app/+html.tsx',
    // Shared keyboard/sheet plumbing hooks (not part of the primitives' render
    // surface); their native keyboard flows belong to the e2e lane.
    '!components/ds/primitives/use*.ts',
  ],
  clearMocks: true,
  restoreMocks: true,
  maxWorkers: '50%',
  testTimeout: 10000,
  // Floors are what this lane actually reaches, rounded down to the nearest 5,
  // so a regression below them fails CI instead of quietly shipping.
  coverageThreshold: {
    global: { branches: 75, functions: 95, lines: 95, statements: 95 },
  },
};
