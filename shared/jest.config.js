/* global module, process, require */
// Pin the clock's zone so a timezone-dependent regression fails everywhere
// rather than only on a machine that happens to sit in the wrong offset. Chatham
// is deliberately hostile: a :45 offset, DST, and the far side of the date line,
// so anything that assumes whole hours, a stable offset, or that local and UTC
// share a calendar day breaks here. Set before any test module can touch Date -
// workers inherit it from this process.
process.env.TZ = 'Pacific/Chatham'

// Native-only packages stubbed in desktop/test environments.
// The same list is used by webpack (ignored-modules.js → null-module.js).
// Add new native packages to native-only-modules.js, not here.
const nativeOnlyModules = require('./native-only-modules')

// The desktop build's own stubs (vite.config.mts stubbedModules), so jest runs what desktop runs,
// and the one stub with exports desktop doesn't need.
const stubs = {
  '@react-native-picker/picker': '<rootDir>/desktop/stubs/react-native-picker.js',
  // constants/platform calls these at import time under isIOS, which some tests set
  'expo-glass-effect': '<rootDir>/test/mocks/expo-glass-effect.js',
  'react-native-safe-area-context': '<rootDir>/desktop/stubs/react-native-safe-area-context.js',
}
// The rest are empty, as desktop's empty-module.js is, each in its own file under test/mocks/native/
// (the name with / as __): Jest keys its registry by path, so with one shared file a jest.mock of one
// package would replace them all. native-only-stubs.test.ts checks the files match the list.
const nativeStubFile = name => `<rootDir>/test/mocks/native/${name.replace(/\//g, '__')}.js`
const escapeRe = name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const nativeModuleMapper = Object.fromEntries(
  nativeOnlyModules.map(name => [`^${escapeRe(name)}$`, stubs[name] ?? nativeStubFile(name)])
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
    '^lottie-web$': '<rootDir>/test/mocks/lottie-web.js',
    // the library desktop runs (vite.config.mts), not a model of it
    '^react-native$': '<rootDir>/node_modules/react-native-web/dist/cjs/index.js',
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/test/fail-on-console.js'],
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
    // tests/e2e/shared (shared/gate included), ios-appium/gate, tests/e2e/accounts, the corpus, the electron and ios-appium release libs and electron's main-process lib hold helper unit tests; the rest are playwright/appium/node:test suites
    '<rootDir>/tests/e2e/(?!shared/|accounts/|ios-appium/(?:gate/|release-lib\\.test\\.ts$)|fixtures/corpus/|electron/(?:release-lib|helpers/main-process-lib)\\.test\\.ts$)',
  ],
  transform: {
    '^.+\\.(js|jsx|mjs|ts|tsx)$': 'babel-jest',
  },
  // emoji-regex 11 and React Navigation's ESM-only dependencies have to be transformed to CJS.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|@react-navigation|expo(-[a-z-]+)?|lottie-react-native|react-native-safe-area-context|react-native-screens|react-native-webview|react-native-keyboard-controller|react-native-kb|@gorhom|@legendapp|sf-symbols-typescript|emoji-regex|nanoid|use-latest-callback|query-string|decode-uri-component|split-on-first|filter-obj|escape-string-regexp)/)',
  ],
}
