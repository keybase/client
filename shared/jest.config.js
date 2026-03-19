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
    '^@/(.*)$': '<rootDir>/$1',
    '^@react-navigation/core$': '<rootDir>/test/mocks/react-navigation-core.js',
    '^react-native$': '<rootDir>/test/mocks/react-native.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/stores/**/*.test.ts'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|uint8array-extras)/)',
  ],
}
