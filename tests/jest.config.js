const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/ui/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: process.env.JEST_COVERAGE_DIR || 'tests/results/coverage',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: path.resolve(__dirname, '../tsconfig.test.json') }]
  }
};

