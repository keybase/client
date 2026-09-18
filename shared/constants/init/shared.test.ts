/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useCurrentUserState} from '@/stores/current-user'
import {loadAccountsStep, onEngineConnected, onLoggedInChanged, onNetworkOnlineChanged} from './shared'

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
    let subscribed!: (cs: T.RPCGen.ClientState) => void
    jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockReturnValue(
      new Promise<T.RPCGen.ClientState>(resolve => {
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
    const subscribed = deferredSubscription()
    const bootstrap = spyOnBootstrap()

    onEngineConnected()
    await new Promise(resolve => setImmediate(resolve))

    expect(bootstrap).toHaveBeenCalledTimes(1)

    subscribed({
      deviceID: 'd1',
      deviceName: 'testuser-mac',
      httpSrvInfo: {address: '127.0.0.1:2000', token: 'token'},
      loggedIn: true,
      registered: true,
      uid: 'u1',
      username: 'testuser',
      version: {counter: 1, epoch: 7},
    })
    await new Promise(resolve => setImmediate(resolve))

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2000')
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
})

describe('onNetworkOnlineChanged', () => {
  // replaces the gregor-reachability trigger: re-read the bootstrap status after an offline stretch
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

describe('onLoggedInChanged', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    resetAllStores()
  })

  test('applies the stored status identity when the session catches up with it', () => {
    // the status is read before the login notification lands, so its identity is held back; a
    // status identical to the stored one never notifies again, so the login has to apply it
    jest.spyOn(T.RPCGen, 'loginGetConfiguredAccountsRpcPromise').mockResolvedValue([])
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue({} as never)
    useDaemonState.setState({
      bootstrapStatus: {
        deviceID: 'd1',
        deviceName: 'testuser-mac',
        loggedIn: true,
        registered: true,
        uid: 'u1',
        username: 'testuser',
      } as never,
    })
    useConfigState.setState({loggedIn: true})

    onLoggedInChanged(true)

    expect(useCurrentUserState.getState().username).toBe('testuser')
    expect(useCurrentUserState.getState().uid).toBe('u1')
  })
})
