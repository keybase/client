// This file is the source of truth for things being mocked out in storyshots and tests.
// Note that there are two sets of mocks defined here. You could consider merging them, but
// you should be careful to make sure you really want to do that. If you change something
// in one of these lists, you likely want to do so in the other as well.

//eslint-disable-next-line
module.exports = {
  // These are used in jest.config.js to mock things out in storyshots and other tests.
  jestReplacements: {
    '/logger': '<rootDir>/logger/__mocks__/index.tsx',
    '@msgpack': '<rootDir>/node_modules/@msgpack/msgpack/dist.es5/msgpack.js',
    '\\.(jpg|png|gif|ttf|css)$': '<rootDir>/__mocks__/file-mock.tsx',
    '^electron$': '<rootDir>/__mocks__/electron.tsx',
    'channel-hooks': '<rootDir>/teams/common/__mocks__/channel-hooks.tsx',
    'constants/platform': '<rootDir>/__mocks__/platform.tsx',
    'desktop/app/resolve-root': '<rootDir>/__mocks__/resolve-root.tsx',
    'engine/saga$': '<rootDir>/__mocks__/engine-saga.tsx',
    'feature-flags': '<rootDir>/__mocks__/feature-flags.tsx',
    'hidden-string': '<rootDir>/__mocks__/hidden-string.tsx',
    'local-debug': '<rootDir>/__mocks__/local-debug.tsx',
    'navigation-hooks': '<rootDir>/util/__mocks__/navigation-hooks.tsx',
    'react-list': '<rootDir>/__mocks__/react-list.tsx',
    'react-spring': '<rootDir>/__mocks__/react-spring.tsx',
    'typed-connect': '<rootDir>/util/__mocks__/typed-connect.tsx',
  },

  // These are used in metro.config.js and .storybook/webpack.config.js to mock things out
  // in storybook on mobile and desktop respectively.
  replacements: [
    [/^electron$/, '__mocks__/electron'],
    // Don't match files that are named `dark-mode.png` accidentally
    [/dark-mode.tsx/, 'styles/__mocks__/dark-mode'],
    [/engine$/, '__mocks__/engine'],
    [/feature-flags/, '__mocks__/feature-flags'],
    [/navigation-hooks/, 'util/__mocks__/navigation-hooks'],
    [/route-tree$/, '__mocks__/empty'],
    [/typed-connect/, 'util/__mocks__/typed-connect'],
    [/util\/saga/, '__mocks__/saga'],
    [/channel-hooks/, 'teams/common/__mocks__/channel-hooks'],
  ],
}
