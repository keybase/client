module.exports = {
  moduleFileExtensions: [
    'desktop.tsx',
    'desktop.ts',
    'desktop.jsx',
    'desktop.js',
    'tsx',
    'ts',
    'jsx',
    'js',
    'json',
    'node',
  ],
  moduleNameMapper: {
    '\\.(css)$': '<rootDir>/test/mocks/style.js',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/test/mocks/file.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^@/logger$': '<rootDir>/test/mocks/logger.js',
    '^@react-navigation/core$': '<rootDir>/test/mocks/react-navigation-core.js',
    '^react-native$': '<rootDir>/test/mocks/react-native.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/**/*.test.ts',
    '<rootDir>/**/*.test.tsx',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/desktop/dist/',
    '<rootDir>/desktop/release/',
    '<rootDir>/ios/',
    '<rootDir>/android/',
    '<rootDir>/images/',
    '<rootDir>/perf/',
    '<rootDir>/.tsOuts/',
  ],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation)/)',
  ],
}
