/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {useShellState} from '../shell'
import {_onEngineIncoming, applyClientState} from '@/constants/init/shared'

const g = globalThis as unknown as {isMobile: boolean}

const session = (over: Partial<T.RPCGen.ClientSession> = {}): T.RPCGen.ClientSession => ({
  deviceID: 'd1',
  deviceName: 'testuser-mac',
  loggedIn: true,
  uid: 'u1',
  username: 'testuser',
  ...over,
})

const loggedOut = session({deviceID: '', deviceName: '', loggedIn: false, uid: '', username: ''})

const clientState = (over: Partial<T.RPCGen.ClientState> = {}): T.RPCGen.ClientState => ({
  appState: T.RPCGen.MobileAppState.foreground,
  session: session(),
  ...over,
})

const notifyClientState = (state: T.RPCGen.ClientState) =>
  _onEngineIncoming({payload: {params: {state}}, type: 'keybase.1.NotifyApp.clientState'} as never)

const notifyHTTP = (address: string) =>
  useConfigState.getState().dispatch.onEngineIncoming({
    payload: {params: {info: {address, token: 'token'}}},
    type: 'keybase.1.NotifyService.HTTPSrvInfoUpdate',
  } as never)

afterEach(() => {
  g.isMobile = false
  jest.restoreAllMocks()
  resetAllStores()
})

describe('a clientState', () => {
  test('replaces the session, the current user, the http address and the app state', () => {
    g.isMobile = true
    notifyClientState(
      clientState({
        appState: T.RPCGen.MobileAppState.background,
        httpSrvInfo: {address: '127.0.0.1:1', token: 'token'},
      })
    )

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
    expect(useCurrentUserState.getState().username).toBe('testuser')
    expect(useCurrentUserState.getState().deviceID).toBe('d1')
    expect(useShellState.getState().mobileAppState).toBe('background')
  })

  test('is applied in arrival order, with no versions: the last one wins', () => {
    applyClientState(clientState({httpSrvInfo: {address: '127.0.0.1:1', token: 'token'}}))
    notifyHTTP('127.0.0.1:2')
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')

    applyClientState(clientState({httpSrvInfo: {address: '127.0.0.1:3', token: 'token'}, session: loggedOut}))
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3')
    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('with no session leaves the session as it was: the service does not know it yet', () => {
    applyClientState(clientState({session: undefined}))
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useCurrentUserState.getState().username).toBe('')

    applyClientState(clientState())
    expect(useConfigState.getState().loggedIn).toBe(true)

    applyClientState(clientState({session: null}))
    expect(useConfigState.getState().loggedIn).toBe(true)
  })

  test('has the current user in place before anything reacts to the login', () => {
    // setLoggedIn fans out synchronously; every subscriber of a login has always been able to
    // read the current user by the time it runs
    let seen = 'not called'
    const unsub = useConfigState.subscribe((st, prev) => {
      if (st.loggedIn && !prev.loggedIn) {
        seen = useCurrentUserState.getState().username
      }
    })

    applyClientState(clientState())
    unsub()

    expect(seen).toBe('testuser')
  })

  test('logging out keeps the http server address', () => {
    notifyHTTP('127.0.0.1:2')
    useConfigState.getState().dispatch.resetState()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
  })

  test('loggedIn and loggedOut change nothing about the session: clientState owns it', () => {
    useConfigState.getState().dispatch.onEngineIncoming({
      payload: {params: {signedUp: false, username: 'testuser'}},
      type: 'keybase.1.NotifySession.loggedIn',
    } as never)
    expect(useConfigState.getState().loggedIn).toBe(false)

    applyClientState(clientState())
    useConfigState.getState().dispatch.onEngineIncoming({
      payload: {params: undefined},
      type: 'keybase.1.NotifySession.loggedOut',
    } as never)
    expect(useConfigState.getState().loggedIn).toBe(true)
  })
})

describe('an account switch', () => {
  const userB = session({deviceID: 'd2', uid: 'u2', username: 'testuser2'})

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

  test('with both clientStates logs out, clearing the old account, then logs in as the new one', () => {
    applyClientState(clientState())
    markAccountState()
    useConfigState.getState().dispatch.setUserSwitching(true)
    const {changes, unsub} = loginChanges()

    applyClientState(clientState({session: loggedOut}))
    expect(accountStateCleared()).toBe(true)
    applyClientState(clientState({session: userB}))
    unsub()

    expect(changes).toEqual([false, true])
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useConfigState.getState().loggedIn).toBe(true)
  })

  test('whose logged-out clientState never arrived still clears the old account', () => {
    applyClientState(clientState())
    markAccountState()
    useConfigState.getState().dispatch.setUserSwitching(true)
    const {changes, unsub} = loginChanges()

    applyClientState(clientState({session: userB}))
    unsub()

    expect(changes).toEqual([false, true])
    expect(accountStateCleared()).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useCurrentUserState.getState().uid).toBe('u2')
  })

  test('whose login fails after the logout ends logged out, no longer switching', () => {
    applyClientState(clientState())
    useConfigState.getState().dispatch.setUserSwitching(true)

    applyClientState(clientState({session: loggedOut}))
    useConfigState.getState().dispatch.setLoginError(new Error('bad password') as never)

    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().userSwitching).toBe(false)
    expect(useCurrentUserState.getState().username).toBe('')
  })

  test('a logout never shows a logged-in session with no user', () => {
    applyClientState(clientState())
    const seen: Array<{loggedIn: boolean; uid: string}> = []
    const record = () =>
      seen.push({loggedIn: useConfigState.getState().loggedIn, uid: useCurrentUserState.getState().uid})
    const unsubs = [useConfigState.subscribe(record), useCurrentUserState.subscribe(record)]

    applyClientState(clientState({session: loggedOut}))
    unsubs.forEach(u => u())

    expect(seen.length).toBeGreaterThan(0)
    expect(seen.filter(s => s.loggedIn && !s.uid)).toEqual([])
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useCurrentUserState.getState().uid).toBe('')
  })

  test('the same user again is not a switch', () => {
    applyClientState(clientState())
    markAccountState()
    const {changes, unsub} = loginChanges()

    applyClientState(clientState())
    unsub()

    expect(changes).toEqual([])
    expect(accountStateCleared()).toBe(false)
  })
})
