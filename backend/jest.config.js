/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/database.ts',
    'src/validation.ts',
    'src/routes/tarot.ts',
    'src/routes/analytics.ts',
  ],
};
