/// <reference types="jest" />
import type * as Init from './index'
import type * as EngineGen from '@/constants/rpc'
import type * as Shell from '@/stores/shell'

// The init module picks its mobile behavior from the platform globals, so each test loads it
// fresh with them set and the native modules mocked.

type Fix = {accuracy: number; lat: number; lon: number}

const calls = new Array<string>()
const fixListeners = new Array<(fix: Fix) => void>()
let startLocationWatchThrows = false
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
        // Registered until it is unregistered, like the real task store.
        isTaskRegisteredAsync: async () => {
          calls.push('isTaskRegistered')
          return Promise.resolve(!calls.includes('unregisterTask'))
        },
        unregisterTaskAsync: async () => {
          calls.push('unregisterTask')
          return Promise.resolve()
        },
      },
      addLocationFixListener: (cb: (fix: Fix) => void) => {
        calls.push('addFixListener')
        fixListeners.push(cb)
        return () => {
          calls.push('removeFixListener')
          fixListeners.splice(fixListeners.indexOf(cb), 1)
        }
      },
      requestLocationPermission: async (perm: unknown) => {
        calls.push(`requestPermission:${String(perm)}`)
        return Promise.resolve()
      },
      startLocationWatch: () => {
        calls.push('startLocationWatch')
        if (startLocationWatchThrows) throw new Error('no native module')
      },
      stopLocationWatch: () => {
        calls.push('stopLocationWatch')
      },
    }),
  }))
  jest.doMock('@/constants/rpc/rpc-chat-gen', () => ({
    ...jest.requireActual<object>('@/constants/rpc/rpc-chat-gen'),
    localLocationUpdateRpcPromise: async ({coord}: {coord: Fix}) => {
      calls.push(`locationUpdate:${coord.lat},${coord.lon},${coord.accuracy}`)
      return Promise.resolve()
    },
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

const setAppState = (mobileAppState: 'active' | 'background') => {
  const {useShellState} = require('@/stores/shell') as typeof Shell
  useShellState.setState({mobileAppState})
}

const sendFix = (fix: Fix) => fixListeners.forEach(l => l(fix))

afterEach(() => {
  calls.length = 0
  fixListeners.length = 0
  startLocationWatchThrows = false
  jest.dontMock('./platform')
  jest.dontMock('@/constants/rpc/rpc-chat-gen')
  jest.dontMock('./shared')
  jest.dontMock('@/fs/common/lifecycle')
  jest.resetModules()
  global.isMobile = originalGlobals.isMobile
  global.isIOS = originalGlobals.isIOS
  global.isAndroid = originalGlobals.isAndroid
})

test('iOS starts the native watch once for overlapping watches and stops it after the last clear', async () => {
  const init = load('ios')
  init.onEngineIncoming(watchPosition())
  await flush()
  init.onEngineIncoming(watchPosition())
  await flush()
  init.onEngineIncoming(clearWatch())
  await flush()
  expect(calls.filter(c => c === 'stopLocationWatch')).toEqual([])
  init.onEngineIncoming(clearWatch())
  await flush()

  expect(calls).toEqual([
    'result',
    'requestPermission:1',
    'startLocationWatch',
    'addFixListener',
    'result',
    'requestPermission:1',
    'stopLocationWatch',
    'removeFixListener',
  ])
})

test('iOS forwards each native fix to the service in the foreground', async () => {
  const init = load('ios')
  setAppState('active')
  init.onEngineIncoming(watchPosition())
  await flush()
  calls.length = 0

  sendFix({accuracy: 12.7, lat: 37.7749, lon: -122.4194})
  sendFix({accuracy: 5, lat: 37.775, lon: -122.4194})
  await flush()

  expect(calls).toEqual(['locationUpdate:37.7749,-122.4194,12', 'locationUpdate:37.775,-122.4194,5'])
})

test('iOS drops background jitter and records a real move', async () => {
  const init = load('ios')
  setAppState('background')
  init.onEngineIncoming(watchPosition())
  await flush()
  calls.length = 0

  sendFix({accuracy: 10, lat: 37.7749, lon: -122.4194})
  // ~11m north
  sendFix({accuracy: 10, lat: 37.7750, lon: -122.4194})
  // ~111m north
  sendFix({accuracy: 10, lat: 37.7759, lon: -122.4194})
  await flush()

  expect(calls).toEqual(['locationUpdate:37.7749,-122.4194,10', 'locationUpdate:37.7759,-122.4194,10'])
})

test('iOS restarts the throttle with each watch, so its first fix always records', async () => {
  const init = load('ios')
  setAppState('background')
  init.onEngineIncoming(watchPosition())
  await flush()
  sendFix({accuracy: 10, lat: 37.7749, lon: -122.4194})
  init.onEngineIncoming(clearWatch())
  await flush()
  init.onEngineIncoming(watchPosition())
  await flush()
  calls.length = 0

  sendFix({accuracy: 10, lat: 37.775, lon: -122.4194})
  await flush()

  expect(calls).toEqual(['locationUpdate:37.775,-122.4194,10'])
})

test('iOS answers the watch before starting the native watch, which may throw', async () => {
  startLocationWatchThrows = true
  const init = load('ios')
  init.onEngineIncoming(watchPosition())
  await flush()
  // the failed start gave its ref back, so the next watch tries again
  init.onEngineIncoming(watchPosition())
  await flush()

  expect(calls).toEqual([
    'result',
    'requestPermission:1',
    'startLocationWatch',
    'result',
    'requestPermission:1',
    'startLocationWatch',
  ])
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

// The second run stands for every launch after the cleanup: unregistering a task that is gone
// throws E_TASK_NOT_FOUND, so it must not be asked for again.
test('iOS removes the legacy expo background location task once', async () => {
  const init = load('ios')
  await init.unregisterLegacyIOSLocationTask()
  await init.unregisterLegacyIOSLocationTask()

  expect(calls).toEqual(['isTaskRegistered', 'unregisterTask', 'isTaskRegistered'])
})

test('Android keeps its expo background location task', async () => {
  const init = load('android')
  await init.unregisterLegacyIOSLocationTask()

  expect(calls).toEqual([])
})
