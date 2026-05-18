/* global module, require */

// Native-only packages stubbed in desktop/test environments.
// The same list is used by webpack (ignored-modules.js → null-module.js).
// Add new native packages to native-only-modules.js, not here.
const nativeOnlyModules = require('./native-only-modules')
const nativeModuleStub = '<rootDir>/test/mocks/native-module.js'
const nativeModuleMapper = Object.fromEntries(
  nativeOnlyModules.map(name => [`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, nativeModuleStub])
)

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
    ...nativeModuleMapper,
    '\\.(css)$': '<rootDir>/test/mocks/style.js',
    '\\.(png|jpe?g|gif|svg)$': '<rootDir>/test/mocks/file.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^@/logger$': '<rootDir>/test/mocks/logger.js',
    '^@react-navigation/core$': '<rootDir>/test/mocks/react-navigation-core.js',
    '^@react-navigation/native$': '<rootDir>/test/mocks/react-navigation-native.js',
    '^lottie-web$': '<rootDir>/test/mocks/lottie-web.js',
    '^react-native$': '<rootDir>/test/mocks/react-native.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'node',
  testMatch: ['<rootDir>/**/*.test.ts', '<rootDir>/**/*.test.tsx'],
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
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|expo(-[a-z-]+)?|lottie-react-native|react-native-safe-area-context|react-native-screens|react-native-webview|react-native-keyboard-controller|react-native-zoom-toolkit|react-native-kb|@gorhom|@callstack|@legendapp|sf-symbols-typescript)/)',
  ],
}
