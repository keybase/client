/// <reference types="jest" />

import type {CreateClientType, IncomingRPCCallbackType, ConnectDisconnectCB} from './index.platform'
import {errors} from './rpc-transport'
import type * as EngineModule from './index'
import type * as ConfigModule from '@/stores/config'

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
    const duringDown = jest.fn()
    const disconnectCallback = jest.fn(() => {
      // A call made while the link is down is refused, not sent to the next one
      client.invoke('keybase.1.test.duringDown', [{}], duringDown)
      throw new Error('disconnect handler blew up')
    })
    const sent = new Array<Array<unknown>>()
    global.rpcOnGo = m => {
      sent.push(m as Array<unknown>)
      return true
    }
    const client = createClient(() => {}, connectCallback, disconnectCallback)
    const inFlight = jest.fn()
    client.invoke('keybase.1.test.hello', [{}], inFlight)

    if (!capturedMetaCb) {
      throw new Error('kb-engine-reset handler was never registered')
    }
    capturedMetaCb('kb-engine-reset')

    // The link must actually go down -- not just the two callbacks below --
    // or pre-reset in-flight invocations stay outstanding forever.
    expect(inFlight).toHaveBeenCalledTimes(1)
    expect(disconnectCallback).toHaveBeenCalledTimes(1)
    // The isolation fix: disconnectCallback throwing must not skip connectCallback,
    // or the UI is stranded on the disconnect banner forever.
    expect(connectCallback).toHaveBeenCalledTimes(1)
    expect(duringDown).toHaveBeenCalledWith({code: errors.EOF, desc: 'The service connection was lost', name: 'EOF'}, {})
    expect(sent.map(m => m[2])).toEqual(['keybase.1.test.hello'])
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})

// Guard for a load-bearing asymmetry: on mobile, outstanding RPCs must be
// failed ONLY when Go drops the connection ('kb-engine-reset'). Engine.reset()
// early-returns on mobile precisely so an account switch does not fail them --
// doing so EOFs login.login (proven on device). If a future refactor moves a
// reset() call into code shared with the account-switch path, the first half
// of this test starts failing instead of the bug shipping silently.
test('outstanding invocations survive everything except kb-engine-reset', () => {
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
    global.rpcOnGo = () => true
    const client = createClient(
      () => {},
      () => {},
      () => {}
    )

    const cb = jest.fn()
    client.invoke('keybase.1.login.login', [{}], cb)
    expect(cb).not.toHaveBeenCalled()

    if (!capturedMetaCb) {
      throw new Error('meta event handler was never registered')
    }

    // Any other meta payload (and, by construction, everything else that runs
    // on an account switch) must leave the invocation outstanding.
    capturedMetaCb('kb-some-other-event')
    expect(cb).not.toHaveBeenCalled()

    capturedMetaCb('kb-engine-reset')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(cb).toHaveBeenCalledWith({code: errors.EOF, desc: 'The service connection was lost', name: 'EOF'}, {})

    // Each reset fails only what was in flight on the link it ended, and calls go out on the new link
    const sent = new Array<unknown>()
    global.rpcOnGo = m => {
      sent.push(m)
      return true
    }
    const after = jest.fn()
    client.invoke('keybase.1.test.after', [{}], after)
    capturedMetaCb('kb-engine-reset')
    capturedMetaCb('kb-engine-reset')
    expect(cb).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)
    expect(sent).toHaveLength(1)
    client.invoke('keybase.1.test.later', [{}], () => {})
    expect(sent).toHaveLength(2)
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})

test('an answer to a call Go made before kb-engine-reset is not written to the new connection', () => {
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
    const sent = new Array<unknown>()
    global.rpcOnGo = m => {
      sent.push(m)
      return true
    }
    let payload: Parameters<IncomingRPCCallbackType>[0] | undefined
    createClient(
      p => {
        payload = p
      },
      () => {},
      () => {}
    )
    global.rpcOnJs?.([0, 9, 'keybase.1.test.prompt', [{}]], 1)
    capturedMetaCb?.('kb-engine-reset')

    payload?.response?.result?.({answer: true})

    expect(sent).toEqual([])
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
    // site that fires when rpcOnGo is undefined. The transport wraps the
    // thrown Error into its code/desc shape; the message survives in desc.
    expect((err as {code?: number; desc?: string}).code).toBe(errors.EOF)
    expect((err as {code?: number; desc?: string}).desc).toBe('native rpc write failed')
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})

test('an account switch fails no outgoing call; only kb-engine-reset does', () => {
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
    const {makeEngine} = require('./index') as typeof EngineModule
    const {useConfigState} = require('@/stores/config') as typeof ConfigModule
    const sent = new Array<Array<unknown>>()
    global.rpcOnGo = m => {
      sent.push(m as Array<unknown>)
      return true
    }
    const engine = makeEngine(
      () => {},
      () => {}
    )
    const loggedIn = jest.fn()
    // switchToAccount: the switch starts, then login goes out
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
    engine.call({callback: loggedIn, method: 'keybase.1.login.login', params: {}})
    engine.reset()
    useConfigState.getState().dispatch.setUserSwitching(false)
    expect(loggedIn).not.toHaveBeenCalled()
    expect(sent.map(m => m[2])).toEqual(['keybase.1.login.login'])

    capturedMetaCb?.('kb-engine-reset')
    expect(loggedIn).toHaveBeenCalledTimes(1)
    expect(loggedIn.mock.calls[0]![0]).toMatchObject({
      code: errors.EOF,
      desc: 'The service connection was lost',
    })
  } finally {
    teardownMobileMocks(originalIsMobile, originalRpcOnGo, originalRpcOnJs)
  }
})
