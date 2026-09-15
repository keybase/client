/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {loadAccountsStep} from './shared'

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
