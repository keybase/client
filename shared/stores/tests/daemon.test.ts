/// <reference types="jest" />
import * as T from '@/constants/types'
import {maxHandshakeTries} from '@/constants/values'
import {resetAllStores} from '@/util/zustand'
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
