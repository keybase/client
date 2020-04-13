/* eslint-env jest */
require('../app/preload.native')
require('immer').enableAllPlugins()
jest.mock('rn-fetch-blob', () => ({}))
jest.mock('react-native', () =>
  jest.fn().mockImplementation(() => ({
    NativeModules: {
      NativeEventEmitter: jest.fn(),
      ReanimatedModule: jest.fn(),
    },
  }))
)
