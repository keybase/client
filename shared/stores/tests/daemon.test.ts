/// <reference types="jest" />
import * as T from '@/constants/types'
import logger from '@/logger'
import {ignorePromise} from '@/constants/utils'
import {maxHandshakeTries} from '@/constants/values'
import {resetAllStores} from '@/util/zustand'
import {_onEngineIncoming} from '@/constants/init/shared'
import {installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
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

  test('startHandshake does not reuse a load orphaned by an engine reset', async () => {
    // engine.reset() drops in-flight RPCs without settling their promises; a later handshake
    // must start a fresh load instead of awaiting the dead one
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
  })
})

describe('the session the service sends and the session read from it', () => {
  const status = (username: string, sessionSeq: number) =>
    ({...bootstrapStatus, httpSrvInfo: null, sessionSeq, userReacjis: {skinTone: 0, topReacjis: null}, username}) as T.RPCGen.BootstrapStatus
  const bootstrapRpc = 'keybase.1.config.getBootstrapStatus'

  let fake: FakeEngine
  let reads: ReturnType<FakeEngine['hold']>
  const send = async (bs: T.RPCGen.BootstrapStatus) => {
    await fake.push('keybase.1.NotifySession.sessionChanged', {status: bs}, {oneway: true})
    await settle()
  }
  const reply = async (bs: T.RPCGen.BootstrapStatus) => {
    reads[reads.length - 1]!.reply(bs)
    await settle()
  }
  const username = () => useDaemonState.getState().bootstrapStatus?.username

  // A connection whose handshake read is held for the test to answer
  beforeEach(async () => {
    fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
    reads = fake.hold(bootstrapRpc)
    useDaemonState.getState().dispatch.initBootstrapSteps([])
    useDaemonState.getState().dispatch.startHandshake()
    await settle()
  })
  afterEach(() => {
    uninstallFakeEngine()
    resetAllStores()
  })

  test('a read older than a session already sent is dropped', async () => {
    await send(status('testuser2', 2))
    await reply(status('testuser', 1))

    expect(username()).toBe('testuser2')
    expect(useDaemonState.getState().handshakeState).toBe('done')
  })

  // The session can change without a login or logout (a device bootstrapped by an engine)
  test('a read as new as the latest session sent applies', async () => {
    await reply(status('testuser', 0))
    await send(status('testuser', 1))
    useDaemonState.getState().dispatch.refreshSessionFromDaemon('test')
    await settle()

    await reply({...status('testuser', 1), fullname: 'changed'})

    expect(useDaemonState.getState().bootstrapStatus?.fullname).toBe('changed')
  })

  test('a session sent no later than the read applied is dropped', async () => {
    await reply(status('testuser2', 2))
    await send(status('testuser', 2))

    expect(username()).toBe('testuser2')
  })

  test('a new handshake counts again, for a restarted service', async () => {
    await reply(status('testuser', 0))
    await send(status('testuser', 5))
    useDaemonState.getState().dispatch.startHandshake()
    await settle()

    await reply(status('testuser2', 0))
    expect(username()).toBe('testuser2')
    await send(status('', 1))
    expect(username()).toBe('')
  })

  test('a store reset keeps the session: it is the service’s, not the account’s', async () => {
    await reply(status('testuser', 0))

    useDaemonState.getState().dispatch.resetState()

    expect(username()).toBe('testuser')
  })
})

describe('reading the session again', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
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
