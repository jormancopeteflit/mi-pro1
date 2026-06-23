/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'react-native',
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      { tsconfig: { jsx: 'react-native' } },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterFramework: ['@testing-library/jest-native/extend-expect'],
  testMatch: ['**/__tests__/**/*.test.(ts|tsx)'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|zustand)/)',
  ],
};
