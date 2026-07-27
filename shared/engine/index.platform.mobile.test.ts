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
const mockNativeModules = (onMetaEvent: (cb: (payload: string) => void) => void) => {
  jest.doMock('react-native-kb', () => ({
    onMetaEvent,
    notifyJSReady: () => {},
  }))
}

const teardownMobileMocks = (
  originalIsMobile: boolean,
  originalRpcOnGo: unknown,
  originalRpcOnJs: unknown
) => {
  jest.dontMock('react-native-kb')
  jest.resetModules()
  global.isMobile = originalIsMobile
  global.rpcOnGo = originalRpcOnGo as typeof global.rpcOnGo
  global.rpcOnJs = originalRpcOnJs as typeof global.rpcOnJs
}

test('disconnectCallback throwing does not prevent connectCallback from running on kb-engine-reset', () => {
  const originalIsMobile = global.isMobile
  const originalRpcOnGo = global.rpcOnGo
  const originalRpcOnJs = global.rpcOnJs
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
    const client = createClient(() => {}, connectCallback, disconnectCallback)
    const resetSpy = jest.spyOn(client.transport, 'reset')

    if (!capturedMetaCb) {
      throw new Error('kb-engine-reset handler was never registered')
    }
    capturedMetaCb('kb-engine-reset')

    // The reset must actually happen -- not just the two callbacks below --
    // or pre-reset in-flight invocations stay outstanding forever.
    expect(resetSpy).toHaveBeenCalledTimes(1)
    expect(disconnectCallback).toHaveBeenCalledTimes(1)
    // The isolation fix: disconnectCallback throwing must not skip connectCallback,
    // or the UI is stranded on the disconnect banner forever.
    expect(connectCallback).toHaveBeenCalledTimes(1)
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})

test('NativeTransportMobile fails the invocation (not hang) when rpcOnGo reports failure', () => {
  const originalIsMobile = global.isMobile
  const originalRpcOnGo = global.rpcOnGo
  const originalRpcOnJs = global.rpcOnJs
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
    // rpcOnGo is defined but returns false -- this must be the "native rpc
    // write failed" throw site, not the "rpcOnGo send before rpcOnGo global"
    // site that fires when rpcOnGo is undefined.
    expect((err as Error).message).toBe('native rpc write failed')
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})
