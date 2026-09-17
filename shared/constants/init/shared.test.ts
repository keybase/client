/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {loadAccountsStep, onEngineConnected} from './shared'

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
      s.bootstrapStatus = {loggedIn: false} as any
    })

    await expect(loadAccountsStep()).resolves.toBeUndefined()
  })

  test('does not wait for accounts when already logged in', async () => {
    withDeferredRefreshAccounts()
    useDaemonState.setState(s => {
      s.bootstrapStatus = {loggedIn: true} as any
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
    return () => subscribed()
  }
  // config's onEngineConnected, which resets the applied versions, is stubbed out here, so each
  // test reads a version newer than the last one applied
  let version = 0
  const spyOnBootstrap = () =>
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockResolvedValue({
      httpSrvInfo: {address: '127.0.0.1:2000', token: 'token'},
      loggedIn: true,
      version: ++version,
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

  test('the bootstrap read starts only once the notification subscription resolves', async () => {
    stubRegistrations()
    const subscribed = deferredSubscription()
    const bootstrap = spyOnBootstrap()

    onEngineConnected()
    await Promise.resolve()
    expect(bootstrap).not.toHaveBeenCalled()

    subscribed()
    await new Promise(resolve => setImmediate(resolve))

    expect(bootstrap).toHaveBeenCalledTimes(1)
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
