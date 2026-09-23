/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {ignorePromise} from '@/constants/utils'
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

describe('reading the session from the daemon', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  const deferredReads = () => {
    const replies: Array<(bs: T.RPCGen.BootstrapStatus) => void> = []
    const spy = jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockImplementation(
      async () =>
        new Promise<T.RPCGen.BootstrapStatus>(resolve => {
          replies.push(resolve)
        })
    )
    return {replies, spy}
  }

  test('a refresh asks again even while a read is in flight', async () => {
    const {spy} = deferredReads()
    const {dispatch} = useDaemonState.getState()

    ignorePromise(dispatch.loadDaemonBootstrapStatus())
    dispatch.refreshSessionFromDaemon('test')
    await jest.advanceTimersByTimeAsync(0)

    expect(spy).toHaveBeenCalledTimes(2)
  })

  test('of two overlapping refreshes, the older reply is dropped', async () => {
    const {replies} = deferredReads()
    const {dispatch} = useDaemonState.getState()

    dispatch.refreshSessionFromDaemon('first')
    dispatch.refreshSessionFromDaemon('second')
    await jest.advanceTimersByTimeAsync(0)
    replies[1]?.({...bootstrapStatus, username: 'newer'})
    await jest.advanceTimersByTimeAsync(0)
    replies[0]?.({...bootstrapStatus, username: 'older'})
    await jest.advanceTimersByTimeAsync(0)

    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('newer')
  })

  test('an older reply that lands first is dropped too, the newer one is coming', async () => {
    const {replies} = deferredReads()
    const {dispatch} = useDaemonState.getState()

    dispatch.refreshSessionFromDaemon('first')
    dispatch.refreshSessionFromDaemon('second')
    await jest.advanceTimersByTimeAsync(0)
    replies[0]?.({...bootstrapStatus, username: 'older'})
    await jest.advanceTimersByTimeAsync(0)

    expect(useDaemonState.getState().bootstrapStatus).toBeUndefined()

    replies[1]?.({...bootstrapStatus, username: 'newer'})
    await jest.advanceTimersByTimeAsync(0)

    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('newer')
  })

  test('a load superseded by a refresh settles with the refresh, so the handshake sees the newer status', async () => {
    const {replies} = deferredReads()
    const {dispatch} = useDaemonState.getState()
    const seen: Array<string | undefined> = []
    dispatch.initBootstrapSteps([
      async () => {
        seen.push(useDaemonState.getState().bootstrapStatus?.username)
        return Promise.resolve()
      },
    ])

    dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)
    dispatch.refreshSessionFromDaemon('hint')
    await jest.advanceTimersByTimeAsync(0)
    replies[0]?.({...bootstrapStatus, username: 'older'})
    await jest.advanceTimersByTimeAsync(0)

    expect(useDaemonState.getState().handshakeState).toBe('loading')

    replies[1]?.({...bootstrapStatus, username: 'newer'})
    await jest.advanceTimersByTimeAsync(0)

    expect(seen).toEqual(['newer'])
    expect(useDaemonState.getState().handshakeState).toBe('done')
  })

  test('a load started after a refresh joins it instead of asking again', async () => {
    const {replies, spy} = deferredReads()
    const {dispatch} = useDaemonState.getState()

    dispatch.refreshSessionFromDaemon('hint')
    const joined = dispatch.loadDaemonBootstrapStatus()
    await jest.advanceTimersByTimeAsync(0)
    replies[0]?.(bootstrapStatus)
    await joined

    expect(spy).toHaveBeenCalledTimes(1)
    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('testuser')
  })

  test('a failed refresh is logged, not thrown', async () => {
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockRejectedValue(new Error('down'))
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => {})

    useDaemonState.getState().dispatch.refreshSessionFromDaemon('hint')
    await jest.advanceTimersByTimeAsync(0)

    expect(warn).toHaveBeenCalled()
  })
})

describe('a superseded read', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('does not write its status over the newer load', async () => {
    // a reconnect invalidates in-flight reads: the generation orders client attempts
    let resolveLosing!: (bs: T.RPCGen.BootstrapStatus) => void
    jest
      .spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise')
      .mockReturnValueOnce(
        new Promise<T.RPCGen.BootstrapStatus>(resolve => {
          resolveLosing = resolve
        })
      )
      .mockResolvedValue(bootstrapStatus)
    const {dispatch} = useDaemonState.getState()
    dispatch.initBootstrapSteps([])

    const losing = dispatch.loadDaemonBootstrapStatus()
    dispatch.startHandshake()
    await jest.advanceTimersByTimeAsync(0)
    resolveLosing({...bootstrapStatus, username: 'stale'})
    await losing
    await jest.advanceTimersByTimeAsync(0)

    expect(useDaemonState.getState().bootstrapStatus?.username).toBe('testuser')
  })
})

test('resetState keeps the handshake generation: it counts connections, not accounts', () => {
  jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue(bootstrapStatus)
  const {dispatch} = useDaemonState.getState()
  dispatch.initBootstrapSteps([])
  dispatch.startHandshake()
  dispatch.startHandshake()
  const gen = useDaemonState.getState().handshakeGeneration

  dispatch.resetState()

  expect(gen).toBeGreaterThan(0)
  expect(useDaemonState.getState().handshakeGeneration).toBe(gen)
  jest.restoreAllMocks()
  resetAllStores()
})
