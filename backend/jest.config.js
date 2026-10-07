const { mkdtempSync } = require('fs');
const { tmpdir } = require('os');
const { join } = require('path');

// Tests always run against a throwaway database, never the live library.
process.env.DATABASE_PATH = join(mkdtempSync(join(tmpdir(), 'reading-tracker-test-')), 'test.db');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  silent: true,
};
