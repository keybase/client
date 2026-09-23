/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {_onEngineIncoming, initSharedSubscriptions, loadAccountsStep, onNetworkOnlineChanged} from './shared'

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

describe('onNetworkOnlineChanged', () => {
  const originalDaemonDispatch = useDaemonState.getState().dispatch
  afterEach(() => {
    jest.restoreAllMocks()
    useDaemonState.setState({dispatch: originalDaemonDispatch})
    resetAllStores()
  })

  const spyOnReRead = () => {
    // userSwitching survives resetAllStores on purpose, and an earlier test in this file sets it
    useConfigState.getState().dispatch.setUserSwitching(false)
    const reRead = jest.fn()
    useDaemonState.setState({
      dispatch: {...originalDaemonDispatch, refreshSessionFromDaemon: reRead},
      handshakeState: 'done',
    })
    return reRead
  }

  test('re-reads the session when the network comes back', () => {
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

describe('the session comes from the daemon; notifications only say to read it', () => {
  const status = (over: Partial<T.RPCGen.BootstrapStatus> = {}) =>
    ({
      deviceID: 'd1',
      deviceName: 'testuser-mac',
      fullname: '',
      loggedIn: true,
      registered: true,
      uid: 'u1',
      username: 'testuser',
      ...over,
    }) as unknown as T.RPCGen.BootstrapStatus
  const userA = status()
  const userB = status({deviceID: 'd2', uid: 'u2', username: 'testuser2'})
  const loggedOut = status({deviceID: '', deviceName: '', loggedIn: false, uid: '', username: ''})

  let replies: Array<(bs: T.RPCGen.BootstrapStatus) => void> = []
  const flush = async () => jest.advanceTimersByTimeAsync(0)
  const notify = (type: string, params: unknown) => _onEngineIncoming({payload: {params}, type} as never)
  const readReplying = async (bs: T.RPCGen.BootstrapStatus) => {
    useDaemonState.getState().dispatch.refreshSessionFromDaemon('test')
    await flush()
    replies[replies.length - 1]?.(bs)
    await flush()
  }

  // what resetAllStores clears, standing in for the previous account's state
  const markAccountState = () => useConfigState.setState({justDeletedSelf: 'testuser'})
  const accountStateCleared = () => useConfigState.getState().justDeletedSelf === ''
  const loginChanges = () => {
    const changes: Array<boolean> = []
    const unsub = useConfigState.subscribe((st, prev) => {
      if (st.loggedIn !== prev.loggedIn) {
        changes.push(st.loggedIn)
      }
    })
    return {changes, unsub}
  }

  beforeEach(() => {
    jest.useFakeTimers()
    replies = []
    jest.spyOn(T.RPCGen, 'configGetBootstrapStatusRpcPromise').mockImplementation(
      async () =>
        new Promise<T.RPCGen.BootstrapStatus>(resolve => {
          replies.push(resolve)
        })
    )
    jest.spyOn(T.RPCGen, 'loginGetConfiguredAccountsRpcPromise').mockResolvedValue([])
    useConfigState.getState().dispatch.setUserSwitching(false)
    initSharedSubscriptions()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
    useConfigState.getState().dispatch.setUserSwitching(false)
    resetAllStores()
  })

  test('loggedOut and loggedIn delivered reversed still end with the last reply', async () => {
    // the service logged out and then in; its two notifications reached us the other way round
    notify('keybase.1.NotifySession.loggedIn', {signedUp: false, username: 'testuser'})
    notify('keybase.1.NotifySession.loggedOut', undefined)
    await flush()
    replies[1]?.(userA)
    await flush()
    replies[0]?.(loggedOut)
    await flush()

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('a loggedOut hint logs out once the daemon says so', async () => {
    await readReplying(userA)
    expect(useConfigState.getState().loggedIn).toBe(true)

    notify('keybase.1.NotifySession.loggedOut', undefined)
    expect(useConfigState.getState().loggedIn).toBe(true)
    await flush()
    replies[replies.length - 1]?.(loggedOut)
    await flush()

    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('an http server update applies at once and re-reads the daemon too', async () => {
    const before = replies.length
    notify('keybase.1.NotifyService.HTTPSrvInfoUpdate', {info: {address: '127.0.0.1:2', token: 'token'}})
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
    await flush()
    expect(replies.length).toBe(before + 1)
  })

  test('a reply for another user while logged in logs out first, clearing the old account', async () => {
    await readReplying(userA)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await readReplying(userB)
    unsub()

    expect(changes).toEqual([false, true])
    expect(accountStateCleared()).toBe(true)
    expect(useCurrentUserState.getState().uid).toBe('u2')
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useDaemonState.getState().bootstrapStatus?.uid).toBe('u2')
  })

  test('the same user again is not a switch', async () => {
    await readReplying(userA)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await readReplying({...userA, fullname: 'changed'} as T.RPCGen.BootstrapStatus)
    unsub()

    expect(changes).toEqual([])
    expect(accountStateCleared()).toBe(false)
  })

  test('logged in with no current user yet is not a switch', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await readReplying(userA)
    unsub()

    expect(changes).toEqual([])
    expect(accountStateCleared()).toBe(false)
    expect(useCurrentUserState.getState().uid).toBe('u1')
  })

  test('during an account switch a logged-out reply is ignored, and the new user still replaces the old', async () => {
    await readReplying(userA)
    markAccountState()
    useConfigState.getState().dispatch.setUserSwitching(true)
    const {changes, unsub} = loginChanges()

    await readReplying(loggedOut)
    expect(useConfigState.getState().loggedIn).toBe(true)

    await readReplying(userB)
    unsub()

    expect(changes).toEqual([false, true])
    expect(accountStateCleared()).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useConfigState.getState().userSwitching).toBe(true)
  })

  test('a switch whose login fails ends logged out, no longer switching', async () => {
    await readReplying(userA)
    useConfigState.getState().dispatch.setUserSwitching(true)
    await readReplying(loggedOut)

    useConfigState.getState().dispatch.setLoginError(new Error('bad password') as never)
    await readReplying(loggedOut)

    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().userSwitching).toBe(false)
  })
})
