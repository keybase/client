/// <reference types="jest" />
import type * as Init from './index'
import type * as EngineGen from '@/constants/rpc'

// The init module picks its mobile behavior from the platform globals, so each test loads it
// fresh with them set and the native modules mocked.

const calls = new Array<string>()
const originalGlobals = {isAndroid: global.isAndroid, isIOS: global.isIOS, isMobile: global.isMobile}

const load = (platform: 'ios' | 'android'): typeof Init => {
  global.isMobile = true
  global.isIOS = platform === 'ios'
  global.isAndroid = platform === 'android'
  jest.resetModules()
  jest.doMock('./platform', () => ({
    getNative: () => ({
      ExpoLocation: {
        startLocationUpdatesAsync: async () => {
          calls.push('startLocationUpdates')
          return Promise.resolve()
        },
        stopLocationUpdatesAsync: async () => {
          calls.push('stopLocationUpdates')
          return Promise.resolve()
        },
      },
      ExpoTaskManager: {
        defineTask: () => {
          calls.push('defineTask')
        },
      },
      requestLocationPermission: async (perm: unknown) => {
        calls.push(`requestPermission:${String(perm)}`)
        return Promise.resolve()
      },
    }),
  }))
  jest.doMock('./shared', () => ({
    _onEngineIncoming: () => {},
  }))
  // pulls in the mobile theme, which needs more of react-native than the test mock has
  jest.doMock('@/fs/common/lifecycle', () => ({}))
  return require('./index') as typeof Init
}

const watchPosition = () =>
  ({
    payload: {
      params: {convID: new Uint8Array([0xaa, 0xbb]), perm: 1},
      response: {
        result: () => {
          calls.push('result')
        },
      },
    },
    type: 'chat.1.chatUi.chatWatchPosition',
  }) as unknown as EngineGen.Actions

const clearWatch = () =>
  ({
    payload: {params: {id: 1}, response: {result: () => {}}},
    type: 'chat.1.chatUi.chatClearWatch',
  }) as unknown as EngineGen.Actions

const flush = async () => new Promise(resolve => setTimeout(resolve, 0))

afterEach(() => {
  calls.length = 0
  jest.dontMock('./platform')
  jest.dontMock('./shared')
  jest.dontMock('@/fs/common/lifecycle')
  jest.resetModules()
  global.isMobile = originalGlobals.isMobile
  global.isIOS = originalGlobals.isIOS
  global.isAndroid = originalGlobals.isAndroid
})

test('iOS only asks for permission; the native watcher runs location', async () => {
  const init = load('ios')
  init.onEngineIncoming(watchPosition())
  await flush()
  init.onEngineIncoming(clearWatch())
  await flush()

  expect(calls).toEqual(['result', 'requestPermission:1'])
})

test('Android asks for permission and runs the expo location task', async () => {
  const init = load('android')
  init.onEngineIncoming(watchPosition())
  await flush()
  init.onEngineIncoming(clearWatch())
  await flush()

  expect(calls).toEqual([
    'result',
    'requestPermission:1',
    'defineTask',
    'startLocationUpdates',
    'stopLocationUpdates',
  ])
})
