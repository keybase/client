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

  test('the handshake starts only once the notification subscription resolves', async () => {
    stubRegistrations()
    const startHandshake = jest.fn()
    useDaemonState.setState({dispatch: {...originalDaemonDispatch, startHandshake}})
    let subscribed!: () => void
    jest.spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise').mockReturnValue(
      new Promise<void>(resolve => {
        subscribed = resolve
      })
    )

    onEngineConnected()
    await Promise.resolve()
    expect(startHandshake).not.toHaveBeenCalled()

    subscribed()
    await new Promise(resolve => setImmediate(resolve))

    expect(startHandshake).toHaveBeenCalledTimes(1)
  })

  test('the handshake still starts when the subscription fails', async () => {
    stubRegistrations()
    const startHandshake = jest.fn()
    useDaemonState.setState({dispatch: {...originalDaemonDispatch, startHandshake}})
    jest
      .spyOn(T.RPCGen, 'notifyCtlSetNotificationsRpcPromise')
      .mockRejectedValue(new Error('no notifications'))

    onEngineConnected()
    await new Promise(resolve => setImmediate(resolve))

    expect(startHandshake).toHaveBeenCalledTimes(1)
  })
})
