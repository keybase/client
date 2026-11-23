/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useDaemonState} from '@/stores/daemon'
import {useSettingsEmailState} from '@/stores/settings-email'
import {useNotifState} from '@/stores/notifications'
import * as Tabs from '@/constants/tabs'
import {
  _onEngineIncoming,
  initSharedSubscriptions,
  loadAccountsStep,
  onEngineConnected,
  onNetworkOnlineChanged,
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
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
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
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser')
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

describe('the session comes from the service', () => {
  const status = (over: Partial<T.RPCGen.BootstrapStatus> = {}) =>
    ({
      deviceID: 'd1',
      deviceName: 'testuser-mac',
      fullname: '',
      httpSrvInfo: null,
      loggedIn: true,
      registered: true,
      sessionSeq: 0,
      uid: 'u1',
      userReacjis: {skinTone: 0, topReacjis: null},
      username: 'testuser',
      ...over,
    }) as T.RPCGen.BootstrapStatus
  const userA = status()
  const userB = status({deviceID: 'd2', uid: 'u2', username: 'testuser2'})
  const loggedOut = status({deviceID: '', deviceName: '', loggedIn: false, uid: '', username: ''})

  let fake: FakeEngine
  let seq = 0
  // The service sends the session it changed to, numbered in the order it sent them
  const send = async (bs: T.RPCGen.BootstrapStatus, sessionSeq = ++seq) => {
    await fake.push('keybase.1.NotifySession.sessionChanged', {status: {...bs, sessionSeq}}, {oneway: true})
    await settle()
  }
  // reads of the session, the handshake's own included
  const sessionReads = () => fake.calls.filter(c => c.method === 'keybase.1.config.getBootstrapStatus').length

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

  // A new connection's handshake: the service has sent nothing on it yet
  beforeEach(async () => {
    seq = 0
    fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
    // the app reads the gregor UI prefs once it knows the signed-in account
    fake.answer('keybase.1.gregor.getUIPrefs', () => ({allowAnimatedEmojis: false, blockButtonsAdders: {}, chosenChannelsTeamnames: [], explodingModes: {}, pinnedConvs: [], teamAccessRequests: {}, unreadableExplodingModes: []}))
    fake.answer('keybase.1.config.getBootstrapStatus', () => loggedOut)
    fake.answer('keybase.1.login.getConfiguredAccounts', () => [])
    useConfigState.getState().dispatch.setUserSwitching(false)
    initSharedSubscriptions()
    useDaemonState.getState().dispatch.initBootstrapSteps([], async () => {})
    useDaemonState.getState().dispatch.startHandshake()
    await settle()
  })
  afterEach(() => {
    uninstallFakeEngine()
    useConfigState.getState().dispatch.setUserSwitching(false)
    resetAllStores()
  })

  // The service leaves its HTTP server token out of the push; the read that asked for it keeps it
  test('a session sent without the HTTP server keeps the one a read got', async () => {
    current = {...userA, httpSrvInfo: {address: '127.0.0.1:1234', token: 'tok'}}
    await useDaemonState.getState().dispatch.readSessionFromDaemon('test')
    await settle()
    expect(useConfigState.getState().httpSrv).toEqual({address: '127.0.0.1:1234', token: 'tok'})

    await send(userB)
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useConfigState.getState().httpSrv).toEqual({address: '127.0.0.1:1234', token: 'tok'})
  })

  test('once the app knows the signed-in account it reads that account\'s gregor prefs', async () => {
    fake.answer('keybase.1.gregor.getUIPrefs', () => ({
      allowAnimatedEmojis: false,
      blockButtonsAdders: {},
      chosenChannelsTeamnames: [],
      explodingModes: {},
      pinnedConvs: [],
      teamAccessRequests: {},
      unreadableExplodingModes: [],
    }))
    expect(useConfigState.getState().gregorUIPrefs.allowAnimatedEmojis).toBe(true)
    await send(userA)
    await settle()
    expect(fake.calls.filter(c => c.method === 'keybase.1.gregor.getUIPrefs')).toHaveLength(1)
    expect(useConfigState.getState().gregorUIPrefs.allowAnimatedEmojis).toBe(false)
  })

  test('a session sent applies without reading the service', async () => {
    await send(userA)

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser')
    expect(sessionReads()).toBe(1)
  })

  test('a logged-out session sent logs out', async () => {
    await send(userA)
    await send(loggedOut)

    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('an older session that reaches us late is dropped', async () => {
    await send(userA, 2)
    await send(loggedOut, 1)

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('an http server update applies at once without reading the service', async () => {
    await fake.push(
      'keybase.1.NotifyService.HTTPSrvInfoUpdate',
      {info: {address: '127.0.0.1:2', token: 'token'}},
      {oneway: true}
    )
    await settle()

    expect(useConfigState.getState().httpSrv).toEqual({address: '127.0.0.1:2', token: 'token'})
    expect(sessionReads()).toBe(1)
  })

  // The service reads the session when it sends it, so the status sent for a logout can already be
  // the next login.
  test('another user while logged in logs out first, clearing the old account', async () => {
    await send(userA)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await send(userB)
    unsub()

    expect(changes).toEqual([false, true])
    expect(accountStateCleared()).toBe(true)
    expect(useCurrentUserState.getState().uid).toBe('u2')
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useDaemonState.getState().bootstrapStatus?.uid).toBe('u2')
  })

  test('the same user again is not a switch', async () => {
    await send(userA)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await send({...userA, fullname: 'changed'})
    unsub()

    expect(changes).toEqual([])
    expect(accountStateCleared()).toBe(false)
  })

  test('logged in with no current user yet is not a switch', async () => {
    useConfigState.getState().dispatch.setLoggedIn(true)
    markAccountState()
    const {changes, unsub} = loginChanges()

    await send(userA)
    unsub()

    expect(changes).toEqual([])
    expect(accountStateCleared()).toBe(false)
    expect(useCurrentUserState.getState().uid).toBe('u1')
  })

  test('starting a switch logs the old account out of our stores', async () => {
    await send(userA)
    markAccountState()
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')

    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(accountStateCleared()).toBe(true)
  })

  // The switch's own logout, then its login: the navigator for the new account ends the switch
  // (endUserSwitchLandedOn), not its session.
  test('a switch applies its target and leaves the switch for its navigator to end', async () => {
    await send(userA)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    const {changes, unsub} = loginChanges()

    await send(loggedOut)
    await send(userB)
    unsub()

    expect(changes).toEqual([true])
    expect(useCurrentUserState.getState().username).toBe('testuser2')
    expect(useConfigState.getState().userSwitching).toBe(true)
  })

  // Sent before the switch's logout, delivered after the switch began
  test("mid-switch, the old account's session is ignored, and the target's still applies", async () => {
    await send(userA)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')

    await send(userA)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useCurrentUserState.getState().uid).toBe('')

    await send(userB)
    expect(useCurrentUserState.getState().username).toBe('testuser2')
  })

  test('a switch whose login fails after the logout ends logged out, no longer switching', async () => {
    await send(userA)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    await send(loggedOut)
    const logins = fake.hold('keybase.1.login.login')
    useConfigState.getState().dispatch.login('testuser2', '')
    await settle()

    logins[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad password'))
    await settle(2)

    expect(useConfigState.getState().userSwitching).toBe(false)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useCurrentUserState.getState().uid).toBe('')
    expect(sessionReads()).toBe(1)
  })

  // The switch-start reset logged A out of our stores, and the service sends nothing: nothing
  // changed there.
  test('a switch whose login fails before the service logs out ends back on the old account', async () => {
    await send(userA)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    expect(useConfigState.getState().loggedIn).toBe(false)
    const logins = fake.hold('keybase.1.login.login')
    useConfigState.getState().dispatch.login('testuser2', '')
    await settle()

    logins[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'network'))
    await settle(2)

    expect(useConfigState.getState().userSwitching).toBe(false)
    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('a switch whose login is cancelled after the logout ends logged out, with no error', async () => {
    await send(userA)
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser2')
    await send(loggedOut)
    const logins = fake.hold('keybase.1.login.login')
    useConfigState.getState().dispatch.login('testuser2', '')
    await settle()

    logins[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'Canceling RPC'))
    await settle(2)

    expect(useConfigState.getState().userSwitching).toBe(false)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().loginError).toBeUndefined()
  })
})

describe('email notifications', () => {
  const notify = (type: string, params: unknown) => _onEngineIncoming({payload: {params}, type} as never)
  const row = (email: string, isVerified: boolean) =>
    ({email, isPrimary: false, isVerified, lastVerifyEmailDate: 0, visibility: 0}) as T.RPCGen.Email
  const isVerified = (email: string) => useSettingsEmailState.getState().emails.get(email)?.isVerified

  beforeEach(() => {
    useCurrentUserState
      .getState()
      .dispatch.setBootstrap({deviceID: 'd1', deviceName: 'testuser-mac', uid: 'u1', username: 'testuser'})
    useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged([row('a@keybase.io', false)])
  })
  afterEach(() => {
    resetAllStores()
  })

  test('a verified notice marks the address verified before the list arrives', () => {
    notify('keybase.1.NotifyEmailAddress.emailAddressVerified', {emailAddress: 'a@keybase.io'})
    expect(isVerified('a@keybase.io')).toBe(true)
  })

  test('a list for the current account replaces the emails', () => {
    notify('keybase.1.NotifyEmailAddress.emailsChanged', {
      category: 'email.verified',
      email: 'a@keybase.io',
      list: [row('a@keybase.io', true)],
      uid: 'u1',
    })
    expect(isVerified('a@keybase.io')).toBe(true)
  })

  test('a list for another account is dropped', () => {
    notify('keybase.1.NotifyEmailAddress.emailsChanged', {
      category: 'email.verified',
      email: 'b@keybase.io',
      list: [row('b@keybase.io', true)],
      uid: 'u2',
    })
    expect([...useSettingsEmailState.getState().emails.keys()]).toEqual(['a@keybase.io'])
  })
})

describe('a new connection', () => {
  const userA = {
    deviceID: 'd1',
    deviceName: 'testuser-mac',
    fullname: '',
    httpSrvInfo: null,
    loggedIn: true,
    registered: true,
    sessionSeq: 0,
    uid: 'u1',
    userReacjis: {skinTone: 0, topReacjis: null},
    username: 'testuser',
  } as T.RPCGen.BootstrapStatus
  const loggedOut = {...userA, deviceID: '', deviceName: '', loggedIn: false, uid: '', username: ''}
  const badges = {
    bigTeamBadgeCount: 0,
    homeTodoItems: 0,
    inboxVers: 1,
    newTeamAccessRequestCount: 0,
    smallTeamBadgeCount: 3,
    unverifiedEmails: 0,
    unverifiedPhones: 0,
  }

  let fake: FakeEngine
  // The service's session, and whether the current connection subscribed to its notifications
  let session: T.RPCGen.BootstrapStatus
  let subscribed = false
  const followerRequests = () =>
    fake.calls.filter(c => c.method === 'keybase.1.config.requestFollowingAndUnverifiedFollowers').length
  const inboxRefreshes = () => fake.calls.filter(c => c.method === 'chat.1.local.requestInboxLayout').length

  // The service as each connection meets it: it sends a notification only to a subscribed
  // connection, and resends the badge state when the identify UI registers
  beforeEach(() => {
    fake = installFakeEngine({onEngineIncoming: _onEngineIncoming})
    // the app reads the gregor UI prefs once it knows the signed-in account
    fake.answer('keybase.1.gregor.getUIPrefs', () => ({allowAnimatedEmojis: false, blockButtonsAdders: {}, chosenChannelsTeamnames: [], explodingModes: {}, pinnedConvs: [], teamAccessRequests: {}, unreadableExplodingModes: []}))
    session = loggedOut
    subscribed = false
    connections = 0
    fake.answer('keybase.1.config.getBootstrapStatus', () => session)
    fake.answer('keybase.1.login.getConfiguredAccounts', () => [])
    fake.answer('keybase.1.notifyCtl.setNotifications', () => {
      subscribed = true
      return null
    })
    fake.answer('keybase.1.delegateUiCtl.registerIdentify3UI', () => {
      if (subscribed) {
        void fake.push('keybase.1.NotifyBadges.badgeState', {badgeState: badges}, {oneway: true})
      }
      return null
    })
    for (const m of [
      'keybase.1.delegateUiCtl.registerChatUI',
      'keybase.1.delegateUiCtl.registerLogUI',
      'keybase.1.delegateUiCtl.registerHomeUI',
      'keybase.1.delegateUiCtl.registerSecretUI',
      'keybase.1.delegateUiCtl.registerRekeyUI',
      'keybase.1.delegateUiCtl.registerGregorUIPrefs',
      'keybase.1.config.helloIAm',
      'keybase.1.config.requestFollowingAndUnverifiedFollowers',
      'chat.1.local.requestInboxLayout',
    ]) {
      fake.answer(m, () => null)
    }
    fake.answer('keybase.1.config.guiGetValue', () => fakeError(1, 'no value'))
    useConfigState.setState({chatBuiltinCommands: {} as any, chatDeletableByDeleteHistory: new Set()})
    initSharedSubscriptions()
  })
  afterEach(() => {
    uninstallFakeEngine()
    resetAllStores()
    // resetAllStores keeps the service's last session, which the next test's fresh service does not have
    useDaemonState.setState({bootstrapStatus: undefined})
  })

  // Until the handshake is done and the last UI is registered
  const connected = async () => {
    for (let i = 0; i < 100; i++) {
      const rekeyRegistrations = fake.calls.filter(c => c.method === 'keybase.1.delegateUiCtl.registerRekeyUI')
      if (useDaemonState.getState().handshakeState === 'done' && rekeyRegistrations.length === connections) {
        return
      }
      await settle()
    }
  }
  let connections = 0
  const connect = async () => {
    connections++
    onEngineConnected()
    await connected()
  }

  // Subscribing is held until the test lets it land
  const holdSubscribe = () => {
    const held = fake.hold('keybase.1.notifyCtl.setNotifications')
    return () =>
      held.forEach(c => {
        subscribed = true
        c.reply(null)
      })
  }

  // A change made after the handshake read the session but before the subscription landed would
  // reach no one
  test('a login between the read and the subscription still reaches the app', async () => {
    const subscribe = holdSubscribe()
    connections++
    onEngineConnected()
    await settle(10)

    session = userA
    if (subscribed) {
      await fake.push('keybase.1.NotifySession.sessionChanged', {status: {...userA, sessionSeq: 1}}, {oneway: true})
    }
    subscribe()
    await connected()

    expect(useDaemonState.getState().handshakeState).toBe('done')
    expect(useConfigState.getState().loggedIn).toBe(true)
  })

  test('the badge state the service resends on connect reaches the app', async () => {
    const subscribe = holdSubscribe()
    connections++
    onEngineConnected()
    await settle(10)
    subscribe()
    await connected()
    await settle()

    expect(useNotifState.getState().navBadges.get(Tabs.chatTab)).toBe(3)
  })

  // Tracking changes made while disconnected were sent to no one, and with the same user still
  // logged in no login reloads them
  test('a reconnect that keeps the user logged in reloads who they follow', async () => {
    session = userA
    await connect()
    expect(useConfigState.getState().loggedIn).toBe(true)
    const before = followerRequests()

    fake.drop()
    await settle()
    fake.restart()
    await settle()
    await connect()

    expect(useDaemonState.getState().handshakeState).toBe('done')
    expect(followerRequests()).toBe(before + 1)
  })

  // Chat changes made while disconnected were sent to no one, and the service's own chat sync runs
  // only when it reaches the server
  test('a reconnect that keeps the user logged in refreshes the inbox', async () => {
    session = userA
    await connect()
    const before = inboxRefreshes()

    fake.drop()
    await settle()
    fake.restart()
    await settle()
    await connect()

    expect(inboxRefreshes()).toBe(before + 1)
  })

  test('the first handshake leaves the follower load to the login', async () => {
    session = userA
    await connect()

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(followerRequests()).toBe(0)
  })
})
