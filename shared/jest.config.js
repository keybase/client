/* eslint-disable */
module.exports = {
  coverageDirectory: './coverage',
  modulePaths: ['<rootDir>/desktop/node_modules'],
  modulePathIgnorePatterns: ['<rootDir>/.tsOut'],
  transformIgnorePatterns: [
    'node_modules/(?!universalify|fs-extra|react-redux|react-gateway|@storybook|@react-navigation)',
  ],
  setupFiles: ['<rootDir>/test/setupFiles.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setupTestFrameworkScriptFile.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/.tsOut/'],
  snapshotSerializers: ['jest-emotion'],
  timers: 'fake',
  testEnvironment: 'jsdom',
  moduleNameMapper: require('./mocks').jestReplacements,
  moduleFileExtensions: ['js', 'json', 'ts', 'tsx', 'jsx', 'node', 'desktop.js', 'desktop.tsx'],
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': 'babel-jest',
  },
  globals: {
    __DEV__: true,
    __STORYBOOK__: true,
    __STORYSHOT__: true,
  },
}
