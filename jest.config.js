/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/coverage/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
    }],
    '^.+\\.js$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: false,
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@helpers/(.*)$': '<rootDir>/helpers/$1',
    '^@utils/(.*)$': '<rootDir>/utils/$1',
    '^@controllers/(.*)$': '<rootDir>/controllers/$1',
    '^@services/(.*)$': '<rootDir>/services/$1',
    '^@middleware/(.*)$': '<rootDir>/middleware/$1',
    '^@types/(.*)$': '<rootDir>/types/$1',
    '^(.*)\\.js$': '$1',
  },
  collectCoverageFrom: [
    'controllers/**/*.ts',
    'routes/**/*.ts',
    'types/**/*.ts',
    'validators/**/*.ts',
    'helpers/**/*.ts',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'clover'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: [],
  testTimeout: 30000,
  verbose: true,
};
