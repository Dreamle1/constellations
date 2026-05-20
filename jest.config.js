module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components$': '<rootDir>/src/components',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@screens$': '<rootDir>/src/screens',
    '^@screens/(.*)$': '<rootDir>/src/screens/$1',
    '^@utils$': '<rootDir>/src/utils',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@hooks$': '<rootDir>/src/hooks',
    '^@hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@types$': '<rootDir>/src/types',
    '^@types/(.*)$': '<rootDir>/src/types/$1',
  },
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
  ],
};
