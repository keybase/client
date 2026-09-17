/// <reference types="jest" />
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {maxHandshakeTries} from '@/constants/values'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
import {FatalHandshakeError, useDaemonState} from '../daemon'

const bootstrapStatus = {
  deviceID: 'd1',
  deviceName: 'testuser-mac',
  fullname: 'Test User',
  loggedIn: true,
  registered: true,
  uid: 'u1',
  username: 'testuser',
  version: 1,
} as unknown as T.RPCGen.BootstrapStatus

describe('daemon store', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('startHandshake runs bootstrap steps and finishes', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(bootstrapStatus)
    const step = jest.fn(async () => {})
    const store = useDaemonState
    store.getState().dispatch.initBootstrapSteps([step])

    store.getState().dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)

    expect(step).toHaveBeenCalledTimes(1)
    expect(store.getState().handshakeState).toBe('done')
    expect(store.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('a failing step retries and can recover', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(bootstrapStatus)
    const step = jest.fn(async () => {}).mockRejectedValueOnce(new Error('flaky'))
    const store = useDaemonState
    store.getState().dispatch.initBootstrapSteps([step])

    store.getState().dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)

    expect(store.getState().handshakeState).toBe('loading')
    expect(store.getState().handshakeFailedReason).toBe('flaky')
    expect(store.getState().handshakeRetriesLeft).toBe(maxHandshakeTries - 1)

    await jest.advanceTimersByTimeAsync(1000)

    expect(store.getState().handshakeState).toBe('done')
    expect(store.getState().handshakeFailedReason).toBe('')
  })

  test('exhausting retries fails the handshake', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(bootstrapStatus)
    const step = jest.fn(async () => {}).mockRejectedValue(new Error('down'))
    const store = useDaemonState
    store.getState().dispatch.initBootstrapSteps([step])

    store.getState().dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)
    for (let i = 1; i < maxHandshakeTries; i++) {
      await jest.advanceTimersByTimeAsync(1000)
    }

    expect(step).toHaveBeenCalledTimes(maxHandshakeTries)
    expect(store.getState().handshakeState).toBe('failed')
    expect(store.getState().handshakeRetriesLeft).toBe(0)
    expect(store.getState().handshakeFailedReason).toBe('down')
  })

  test('a fatal error skips retries', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(bootstrapStatus)
    const step = jest.fn(async () => {}).mockRejectedValue(new FatalHandshakeError('pipe owner fail'))
    const store = useDaemonState
    store.getState().dispatch.initBootstrapSteps([step])

    store.getState().dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)

    expect(step).toHaveBeenCalledTimes(1)
    expect(store.getState().handshakeState).toBe('failed')
    expect(store.getState().handshakeRetriesLeft).toBe(0)
  })

  test('loadDaemonBootstrapStatus dedupes concurrent loads', async () => {
    const spy = jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockResolvedValue(bootstrapStatus)
    const store = useDaemonState

    await Promise.all([
      store.getState().dispatch.loadDaemonBootstrapStatus(),
      store.getState().dispatch.loadDaemonBootstrapStatus(),
    ])

    expect(spy).toHaveBeenCalledTimes(1)
    expect(store.getState().bootstrapStatus?.uid).toBe('u1')
  })

  test('startHandshake does not reuse a load orphaned by an engine reset', async () => {
    // engine.reset() drops in-flight RPCs without settling their promises (user switch does
    // this twice); a later handshake must start a fresh load instead of awaiting the dead one
    const spy = jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockImplementationOnce(async () => new Promise<never>(() => {}))
      .mockResolvedValue(bootstrapStatus)
    const store = useDaemonState
    store.getState().dispatch.initBootstrapSteps([])

    ignorePromise(store.getState().dispatch.loadDaemonBootstrapStatus())
    await jest.advanceTimersByTimeAsync(0)

    store.getState().dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)

    expect(spy).toHaveBeenCalledTimes(2)
    expect(store.getState().handshakeState).toBe('done')
    expect(store.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('resetState preserves the handshake state but clears transient values', () => {
    const store = useDaemonState
    store.setState(
      {
        ...store.getState(),
        error: new Error('boom'),
        handshakeFailedReason: 'bad',
        handshakeRetriesLeft: 0,
        handshakeState: 'done',
      },
      true
    )

    store.getState().dispatch.resetState()

    expect(store.getState().handshakeState).toBe('done')
    expect(store.getState().error).toBe(undefined)
    expect(store.getState().handshakeFailedReason).toBe('')
    expect(store.getState().handshakeRetriesLeft).toBe(maxHandshakeTries)
  })
})

describe('httpSrvInfo ordering', () => {
  const withHTTP = (address: string, version: number): T.RPCGen.BootstrapStatus => ({
    ...bootstrapStatus,
    httpSrvInfo: {address, token: 'token'},
    version,
  })
  const notify = (address: string, version: number) =>
    useConfigState.getState().dispatch.onEngineIncoming({
      payload: {params: {info: {address, token: 'token'}, version}},
      type: 'keybase.1.NotifyService.HTTPSrvInfoUpdate',
    } as any)

  beforeEach(() => {
    jest.useFakeTimers()
    // the applied versions live outside the store; a fresh engine connection is what clears them
    useConfigState.getState().dispatch.onEngineConnected()
    useConfigState.setState(s => {
      s.httpSrv = {address: '', token: ''}
    })
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('a status older than an http server notification does not overwrite it', async () => {
    notify('127.0.0.1:2', 5)
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:1', 4))

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('a status newer than a notification is applied', async () => {
    notify('127.0.0.1:2', 3)
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:1', 4))

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
  })

  test('an older notification landing after a newer status is ignored', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:1', 6))

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()
    notify('127.0.0.1:2', 5)

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
  })

  test('a version-0 address from a service that never stamped one is applied', async () => {
    // the http server starts before the notify router exists, so its first update stamps nothing
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:1', 0))

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
  })

  test('a status equal to the stored one still applies its newer address', async () => {
    jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockResolvedValueOnce(withHTTP('127.0.0.1:1', 1))
      .mockResolvedValueOnce(withHTTP('127.0.0.1:1', 3))
    const {dispatch} = useDaemonState.getState()

    await dispatch.loadDaemonBootstrapStatus()
    notify('127.0.0.1:2', 2)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')

    // the second status is identical to the stored one, so nothing is written, but its
    // address is newer than the notification's and still has to be applied
    await dispatch.loadDaemonBootstrapStatus()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
  })

  test('logging out keeps the http server address', () => {
    notify('127.0.0.1:2', 1)
    useConfigState.getState().dispatch.resetState()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
  })

  test("a reconnect accepts a restarted service's lower versions", () => {
    notify('127.0.0.1:2', 9)
    useConfigState.getState().dispatch.onEngineConnected()
    notify('127.0.0.1:3', 1)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3')
  })
})

describe('session ordering', () => {
  const notifySession = (kind: 'loggedIn' | 'loggedOut', version: number) =>
    useConfigState.getState().dispatch.onEngineIncoming({
      payload: {
        params: kind === 'loggedIn' ? {signedUp: false, username: 'testuser', version} : {version},
      },
      type: `keybase.1.NotifySession.${kind}`,
    } as any)

  beforeEach(() => {
    jest.useFakeTimers()
    // the applied versions live outside the store; a fresh engine connection is what clears them
    useConfigState.getState().dispatch.onEngineConnected()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('a status older than a session notification is read again', async () => {
    notifySession('loggedIn', 7)
    const spy = jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockResolvedValueOnce({...bootstrapStatus, username: 'stale', version: 6})
      .mockResolvedValueOnce({...bootstrapStatus, username: 'testuser', version: 7})

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(spy).toHaveBeenCalledTimes(2)
    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('a status that keeps losing is not applied', async () => {
    notifySession('loggedOut', 9)
    const spy = jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockResolvedValueOnce({...bootstrapStatus, version: 1})
      .mockResolvedValueOnce({...bootstrapStatus, version: 2})
      .mockResolvedValueOnce({...bootstrapStatus, version: 3})

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(spy).toHaveBeenCalledTimes(3)
    expect(useDaemonState.getState().bootstrapStatus).toBe(undefined)
  })

  test('a status whose only change is its version does not rewrite the store', async () => {
    // a login, logout or http server change bumps the version without changing this status
    jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockResolvedValueOnce({...bootstrapStatus, version: 1})
      .mockResolvedValueOnce({...bootstrapStatus, version: 2})
    const {dispatch} = useDaemonState.getState()

    await dispatch.loadDaemonBootstrapStatus()
    const stored = useDaemonState.getState().bootstrapStatus
    await dispatch.loadDaemonBootstrapStatus()

    expect(useDaemonState.getState().bootstrapStatus).toBe(stored)
  })

  test('a session notification older than the applied one is ignored', () => {
    useConfigState.setState({loggedIn: true})

    notifySession('loggedOut', 5)
    expect(useConfigState.getState().loggedIn).toBe(false)

    notifySession('loggedIn', 4)
    expect(useConfigState.getState().loggedIn).toBe(false)
  })
})
