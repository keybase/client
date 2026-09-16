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
  const withHTTP = (address: string): T.RPCGen.BootstrapStatus => ({
    ...bootstrapStatus,
    httpSrvInfo: {address, token: 'token'},
  })
  const notify = (address: string) =>
    useConfigState.getState().dispatch.onEngineIncoming({
      payload: {params: {info: {address, token: 'token'}}},
      type: 'keybase.1.NotifyService.HTTPSrvInfoUpdate',
    } as any)
  const deferredBootstrap = () => {
    let resolve!: (bs: T.RPCGen.BootstrapStatus) => void
    const promise = new Promise<T.RPCGen.BootstrapStatus>(_resolve => {
      resolve = _resolve
    })
    return {promise, resolve}
  }

  beforeEach(() => {
    jest.useFakeTimers()
    useConfigState.setState(s => {
      s.httpSrv = {address: '', token: ''}
    })
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('a bootstrap read that started before a notification does not overwrite it', async () => {
    const read = deferredBootstrap()
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockReturnValue(read.promise)

    const load = useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()
    notify('127.0.0.1:2000')
    read.resolve(withHTTP('127.0.0.1:1000'))
    await load

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2000')
    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('a bootstrap read that started after a notification is applied', async () => {
    notify('127.0.0.1:2000')
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:3000'))

    await useDaemonState.getState().dispatch.loadDaemonBootstrapStatus()

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3000')
  })

  test('an older bootstrap read landing after a newer one does not overwrite it', async () => {
    const older = deferredBootstrap()
    jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockReturnValueOnce(older.promise)
      .mockResolvedValueOnce(withHTTP('127.0.0.1:3000'))
    const {dispatch} = useDaemonState.getState()

    const olderLoad = dispatch.loadDaemonBootstrapStatus()
    // a new handshake starts its own load instead of reusing the in-flight one
    dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3000')

    older.resolve(withHTTP('127.0.0.1:1000'))
    await olderLoad
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3000')
  })

  test('a status equal to the stored one still applies its newer address', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(withHTTP('127.0.0.1:1000'))
    const {dispatch} = useDaemonState.getState()
    await dispatch.loadDaemonBootstrapStatus()
    notify('127.0.0.1:2000')
    await dispatch.loadDaemonBootstrapStatus()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1000')
  })

  test('logging out keeps the http server address', () => {
    notify('127.0.0.1:2000')
    useConfigState.getState().dispatch.resetState()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2000')
  })
})
