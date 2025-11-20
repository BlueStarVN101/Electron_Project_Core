const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  rootDir: path.resolve(__dirname, '..'),
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy'
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  testPathIgnorePatterns: ['<rootDir>/tests/ui/'],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  coverageDirectory: './tests/test-results/coverage',
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: path.resolve(__dirname, '../tsconfig.test.json') }]
  },
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './tests/test-results/Unit_Test_Report',
        filename: 'test-report.html',
        pageTitle: 'Unit Test Report',
        openReport: false,
        expand: true,
        hideIcon: false,
        includeFailureMsg: true,
        includeSuiteFailure: true
      }
    ],
    [
      'jest-junit',
      {
        outputDirectory: './test-results',
        outputName: 'junit.xml',
        suiteName: 'Unit Tests',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        ancestorSeparator: ' › ',
        usePathForSuiteName: 'true'
      }
    ]
  ]
};

