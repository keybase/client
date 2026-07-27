/// <reference types="jest" />

import type {CreateClientType, IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'

type IndexPlatformModule = {
  createClient: (
    incomingRPCCallback: IncomingRPCCallbackType,
    connectCallback: ConnectDisconnectCB,
    disconnectCallback: ConnectDisconnectCB
  ) => CreateClientType
}

// isMobile is a bare global (see globals.d.ts / jest.setup.js), read once at
// module load time by index.platform.tsx. To exercise the isMobile branch
// (normally never taken in this desktop test env) each test here flips the
// global, resets the module registry so index.platform re-evaluates it, and
// mocks the native imports that branch touches.
//
// local-debug.tsx calls LogBox.ignoreAllLogs() at module load time when
// isMobile is true; the desktop react-native mock has no LogBox because that
// branch is normally dead code in this test env.
const mockNativeModules = (onMetaEvent: (cb: (payload: string) => void) => void) => {
  jest.doMock('react-native', () => ({
    ...jest.requireActual('react-native'),
    LogBox: {ignoreAllLogs: () => {}},
  }))
  jest.doMock('react-native-kb', () => ({
    onMetaEvent,
    notifyJSReady: () => {},
  }))
}

const teardownMobileMocks = (originalIsMobile: boolean, originalRpcOnGo: unknown) => {
  jest.dontMock('react-native-kb')
  jest.dontMock('react-native')
  jest.resetModules()
  global.isMobile = originalIsMobile
  global.rpcOnGo = originalRpcOnGo as typeof global.rpcOnGo
}

test('disconnectCallback throwing does not prevent connectCallback from running on kb-engine-reset', () => {
  const originalIsMobile = global.isMobile
  const originalRpcOnGo = global.rpcOnGo
  global.isMobile = true

  let capturedMetaCb: ((payload: string) => void) | undefined
  mockNativeModules(cb => {
    capturedMetaCb = cb
  })
  jest.resetModules()

  try {
    const {createClient} = require('./index.platform') as IndexPlatformModule
    const connectCallback = jest.fn()
    const disconnectCallback = jest.fn(() => {
      throw new Error('disconnect handler blew up')
    })
    createClient(() => {}, connectCallback, disconnectCallback)

    if (!capturedMetaCb) {
      throw new Error('kb-engine-reset handler was never registered')
    }
    capturedMetaCb('kb-engine-reset')

    expect(disconnectCallback).toHaveBeenCalledTimes(1)
    // The isolation fix: disconnectCallback throwing must not skip connectCallback,
    // or the UI is stranded on the disconnect banner forever.
    expect(connectCallback).toHaveBeenCalledTimes(1)
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo)
  }
})

test('NativeTransportMobile fails the invocation (not hang) when rpcOnGo reports failure', () => {
  const originalIsMobile = global.isMobile
  const originalRpcOnGo = global.rpcOnGo
  global.isMobile = true

  mockNativeModules(() => {})
  jest.resetModules()

  try {
    const {createClient} = require('./index.platform') as IndexPlatformModule
    const client = createClient(
      () => {},
      () => {},
      () => {}
    )
    global.rpcOnGo = () => false

    const cb = jest.fn()
    client.invoke('keybase.1.test.hello', [{}], cb)

    expect(cb).toHaveBeenCalledTimes(1)
    const [err] = cb.mock.calls[0] as [unknown, unknown]
    expect(err).toBeTruthy()
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo)
  }
})
