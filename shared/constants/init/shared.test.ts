/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import {FatalHandshakeError, useDaemonState} from '@/stores/daemon'
import {useRouterState} from '@/stores/router'
import {useShellState} from '@/stores/shell'
import {
  applyClientState,
  initSharedSubscriptions,
  loadAccountsStep,
  onEngineConnected,
  onNetworkOnlineChanged,
  sessionSettledStep,
} from './shared'

describe('loadAccountsStep', () => {
  const originalDispatch = useConfigState.getState().dispatch
  let resolveRefresh: (() => void) | undefined

  const withDeferredRefreshAccounts = () => {
    useConfigState.setState({
      dispatch: {
        ...originalDispatch,
        refreshAccounts: async () =>
          new Promise<void>(resolve => {
            resolveRefresh = resolve
          }),
      },
    })
  }

  afterEach(() => {
    resolveRefresh?.()
    resolveRefresh = undefined
    jest.restoreAllMocks()
    useConfigState.setState({dispatch: originalDispatch})
    resetAllStores()
  })

  test('does not wait for accounts while switching', async () => {
    withDeferredRefreshAccounts()
    useConfigState.getState().dispatch.setUserSwitching(true)
    useDaemonState.setState(s => {
      s.bootstrapStatus = {loggedIn: false} as never
    })

    await expect(loadAccountsStep()).resolves.toBeUndefined()
  })

  test('does not wait for accounts when already logged in', async () => {
    withDeferredRefreshAccounts()
    useDaemonState.setState(s => {
      s.bootstrapStatus = {loggedIn: true} as never
    })

    await expect(loadAccountsStep()).resolves.toBeUndefined()
  })

  test('logged-out handshake still waits for the local account list', async () => {
    const spy = jest.spyOn(T.RPCGen, 'loginGetConfiguredAccountsRpcPromise').mockResolvedValue([
      {
        fullname: '',
        hasStoredSecret: true,
        isCurrent: true,
        uid: '00',
        username: 'testuser',
      },
    ])

    await loadAccountsStep()

    expect(spy).toHaveBeenCalled()
    expect(useConfigState.getState().configuredAccounts.map(a => a.username)).toEqual(['testuser'])
  })
})

describe('onEngineConnected', () => {
  const originalConfigDispatch = useConfigState.getState().dispatch
  const originalDaemonDispatch = useDaemonState.getState().dispatch

  afterEach(() => {
    jest.restoreAllMocks()
    useConfigState.setState({dispatch: originalConfigDispatch})
    useDaemonState.setState({dispatch: originalDaemonDispatch})
    resetAllStores()
  })

  const stubRegistrations = () => {
    for (const rpc of [
      'delegateUiCtlRegisterChatUIRpcPromise',
      'delegateUiCtlRegisterLogUIRpcPromise',
      'delegateUiCtlRegisterHomeUIRpcPromise',
      'delegateUiCtlRegisterSecretUIRpcPromise',
      'delegateUiCtlRegisterIdentify3UIRpcPromise',
      'delegateUiCtlRegisterRekeyUIRpcPromise',
    ] as const) {
      jest.spyOn(T.RPCGen, rpc).mockResolvedValue(undefined)
    }
    useConfigState.setState(s => {
      s.dispatch = {...originalConfigDispatch, onEngineConnected: () => {}}
    })
  }

  const deferredSubscription = () => {
    let subscribed!: () => void
    jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockReturnValue(
      new Promise<void>(resolve => {
        subscribed = resolve
      })
    )
    return subscribed
  }
  const spyOnBootstrap = () =>
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue({
      loggedIn: true,
    } as T.RPCGen.BootstrapStatus)

  test('a reconnect clears the disconnect state at once, before the subscription resolves', () => {
    stubRegistrations()
    useDaemonState.setState({error: new Error('Disconnected'), handshakeState: 'failed'})
    deferredSubscription()
    spyOnBootstrap()

    onEngineConnected()

    expect(useDaemonState.getState().error).toBe(undefined)
    expect(useDaemonState.getState().handshakeState).toBe('loading')
  })

  test('the bootstrap read does not wait for the subscription', async () => {
    stubRegistrations()
    deferredSubscription()
    const bootstrap = spyOnBootstrap()

    onEngineConnected()
    await new Promise(resolve => setImmediate(resolve))

    expect(bootstrap).toHaveBeenCalledTimes(1)
  })

  test('the bootstrap read still runs when the subscription fails', async () => {
    stubRegistrations()
    jest
      .spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise')
      .mockRejectedValue(new Error('no notifications'))
    const bootstrap = spyOnBootstrap()

    onEngineConnected()
    await new Promise(resolve => setImmediate(resolve))

    expect(bootstrap).toHaveBeenCalledTimes(1)
  })

  test('the bootstrap status is not a session source', async () => {
    stubRegistrations()
    jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockResolvedValue(undefined)
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue({
      httpSrvInfo: {address: '127.0.0.1:1', token: 'token'},
      loggedIn: true,
      uid: 'u1',
      username: 'testuser',
    } as never)

    onEngineConnected()
    await new Promise(resolve => setImmediate(resolve))

    expect(useDaemonState.getState().bootstrapStatus?.loggedIn).toBe(true)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().httpSrv.address).toBe('')
  })
})

describe('sessionSettledStep', () => {
  const originalConfigDispatch = useConfigState.getState().dispatch

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    useConfigState.setState({dispatch: originalConfigDispatch})
    resetAllStores()
  })

  const connect = (subscribe: () => Promise<void>) => {
    for (const rpc of [
      'delegateUiCtlRegisterChatUIRpcPromise',
      'delegateUiCtlRegisterLogUIRpcPromise',
      'delegateUiCtlRegisterHomeUIRpcPromise',
      'delegateUiCtlRegisterSecretUIRpcPromise',
      'delegateUiCtlRegisterIdentify3UIRpcPromise',
      'delegateUiCtlRegisterRekeyUIRpcPromise',
    ] as const) {
      jest.spyOn(T.RPCGen, rpc).mockResolvedValue(undefined)
    }
    useConfigState.setState(s => {
      s.dispatch = {...originalConfigDispatch, onEngineConnected: () => {}}
    })
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockReturnValue(new Promise(() => {}))
    const setNotifications = jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockImplementation(subscribe)
    onEngineConnected()
    return setNotifications
  }
  const session = {deviceID: 'd1', deviceName: 'testuser-mac', loggedIn: false, uid: '', username: ''}
  const settled = async (p: Promise<void>) => {
    let done = false
    const watch = async () => {
      try {
        await p
      } catch {}
      done = true
    }
    ignorePromise(watch())
    await new Promise(resolve => setImmediate(resolve))
    return done
  }

  test('waits for a clientState that carries a session, which may say logged out', async () => {
    connect(async () => Promise.resolve())
    const step = sessionSettledStep()

    applyClientState({appState: T.RPCGen.MobileAppState.foreground})
    expect(await settled(step)).toBe(false)

    applyClientState({appState: T.RPCGen.MobileAppState.foreground, session})
    expect(await settled(step)).toBe(true)
    await expect(step).resolves.toBeUndefined()
  })

  test('a new connection waits afresh', async () => {
    connect(async () => Promise.resolve())
    applyClientState({appState: T.RPCGen.MobileAppState.foreground, session})
    await sessionSettledStep()

    connect(async () => Promise.resolve())
    const step = sessionSettledStep()
    expect(await settled(step)).toBe(false)
    applyClientState({appState: T.RPCGen.MobileAppState.foreground, session})
    await expect(step).resolves.toBeUndefined()
  })

  test('re-subscribes when the subscription failed, since no clientState is coming otherwise', async () => {
    let calls = 0
    const setNotifications = connect(async () => {
      calls++
      return calls === 1 ? Promise.reject(new Error('no notifications')) : Promise.resolve()
    })
    await new Promise(resolve => setImmediate(resolve))

    const step = sessionSettledStep()
    await new Promise(resolve => setImmediate(resolve))
    expect(setNotifications).toHaveBeenCalledTimes(2)

    applyClientState({appState: T.RPCGen.MobileAppState.foreground, session})
    await expect(step).resolves.toBeUndefined()
  })

  test('is one of the handshake steps', () => {
    // Nothing here tears the subscriptions down, so none may outlive the test.
    for (const store of [useConfigState, useShellState, useRouterState]) {
      jest.spyOn(store, 'subscribe').mockReturnValue(() => {})
    }
    const originalDaemonDispatch = useDaemonState.getState().dispatch
    let steps: ReadonlyArray<unknown> = []
    useDaemonState.setState({
      dispatch: {
        ...originalDaemonDispatch,
        initBootstrapSteps: s => {
          steps = s
        },
      },
    })
    try {
      initSharedSubscriptions()
    } finally {
      useDaemonState.setState({dispatch: originalDaemonDispatch})
    }
    expect(steps).toContain(sessionSettledStep)
  })

  test('fails the handshake attempt when the session never comes', async () => {
    jest.useFakeTimers()
    connect(async () => Promise.resolve())
    const step = sessionSettledStep()
    const failed = expect(step).rejects.toThrow("The service hasn't said who is logged in")
    applyClientState({appState: T.RPCGen.MobileAppState.foreground})
    await jest.advanceTimersByTimeAsync(30_000)
    await failed
    await expect(step).rejects.not.toBeInstanceOf(FatalHandshakeError)
    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('a service that never sends a clientState is out of date, and retrying will not help', async () => {
    jest.useFakeTimers()
    connect(async () => Promise.resolve())
    const step = sessionSettledStep()
    const failed = expect(step).rejects.toBeInstanceOf(FatalHandshakeError)
    await jest.advanceTimersByTimeAsync(30_000)
    await failed
    await expect(step).rejects.toThrow('out of date')
  })

  test('on mobile no clientState is not an out-of-date service: the in-process service is the same build', async () => {
    const g = globalThis as unknown as {isMobile: boolean}
    g.isMobile = true
    try {
      jest.useFakeTimers()
      connect(async () => Promise.resolve())
      const step = sessionSettledStep()
      const failed = expect(step).rejects.toThrow("The service hasn't said who is logged in")
      await jest.advanceTimersByTimeAsync(30_000)
      await failed
      await expect(step).rejects.not.toBeInstanceOf(FatalHandshakeError)
    } finally {
      g.isMobile = false
    }
  })
})

describe('onNetworkOnlineChanged', () => {
  // re-reads the bootstrap status after an offline stretch
  afterEach(() => {
    jest.restoreAllMocks()
    useDaemonState.setState({dispatch: originalDaemonDispatch})
    resetAllStores()
  })

  const originalDaemonDispatch = useDaemonState.getState().dispatch
  const spyOnReRead = () => {
    // userSwitching survives resetAllStores on purpose, and an earlier test in this file sets it
    useConfigState.getState().dispatch.setUserSwitching(false)
    const reRead = jest.fn(async () => {})
    useDaemonState.setState({
      dispatch: {...originalDaemonDispatch, loadDaemonBootstrapStatus: reRead},
      handshakeState: 'done',
    })
    return reRead
  }

  test('re-reads the bootstrap status when the network comes back', () => {
    const reRead = spyOnReRead()
    onNetworkOnlineChanged(true, false)
    expect(reRead).toHaveBeenCalledTimes(1)
  })

  test('does not re-read on the first reading of the network at startup', () => {
    const reRead = spyOnReRead()
    onNetworkOnlineChanged(true, undefined)
    expect(reRead).not.toHaveBeenCalled()
  })

  test('does not re-read when going offline', () => {
    const reRead = spyOnReRead()
    onNetworkOnlineChanged(false, true)
    expect(reRead).not.toHaveBeenCalled()
  })

  test('does not re-read during an account switch', () => {
    const reRead = spyOnReRead()
    useConfigState.getState().dispatch.setUserSwitching(true)
    onNetworkOnlineChanged(true, false)
    expect(reRead).not.toHaveBeenCalled()
  })

  test('does not re-read before the handshake is done', () => {
    const reRead = spyOnReRead()
    useDaemonState.setState({handshakeState: 'loading'})
    onNetworkOnlineChanged(true, false)
    expect(reRead).not.toHaveBeenCalled()
  })
})
