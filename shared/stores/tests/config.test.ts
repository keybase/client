/** @jest-environment jsdom */
/// <reference types="jest" />

import * as T from '../../constants/types'
import * as Tabs from '../../constants/tabs'
import {getAccountGeneration} from '../../engine/account-generation'
import {useDaemonState} from '../daemon'
import {noConversationIDKey} from '../../constants/types/chat/common'
import {useConfigState} from '../config'
import {useWaitingState} from '../waiting'
import {waitingKeyConfigLogin} from '../../constants/strings'
import * as NavTree from '../../constants/nav-tree'
import {fakeError, installFakeEngine, uninstallFakeEngine, type FakeEngine} from '@/test/fake-engine'
import {settle} from '@/test/flush'
import {act} from '@testing-library/react'
import {installNavigation, makeRootState} from '@/test/navigation'

const resetConfigState = () => {
  const {dispatch} = useConfigState.getState()
  useConfigState.setState({
    configuredAccounts: [],
    defaultUsername: '',
    globalError: undefined,
    outOfDate: {
      critical: false,
      message: '',
      outOfDate: false,
      updating: false,
    },
    startup: {
      conversation: noConversationIDKey,
      loaded: false,
    },
    userSwitching: false,
    userSwitchingFromLoggedIn: false,
    userSwitchingTo: '',
  } as any)
  dispatch.resetState()
}

beforeEach(() => {
  resetConfigState()
})

afterEach(() => {
  resetConfigState()
})

test('setStartupDetails only records the first startup payload', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setStartupDetails({
    conversation: 'first-convo' as any,
    tab: Tabs.chatTab,
  })
  dispatch.setStartupDetails({
    conversation: 'second-convo' as any,
    tab: Tabs.peopleTab,
  })

  expect(useConfigState.getState().startup).toEqual({
    conversation: 'first-convo',
    loaded: true,
    tab: Tabs.chatTab,
  })
})

test('setOutOfDate merges fields and setGlobalError normalizes unknown input', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setOutOfDate({critical: true, message: 'upgrade required', outOfDate: true, updating: false})
  dispatch.setUpdating()
  dispatch.setGlobalError('boom')

  const state = useConfigState.getState()
  expect(state.outOfDate).toEqual({
    critical: true,
    message: 'upgrade required',
    outOfDate: true,
    updating: true,
  })
  expect(state.globalError?.message).toBe('Unknown error: "boom"')
})

test('onEngineIncoming owns audit errors and badge state', () => {
  const {dispatch} = useConfigState.getState()
  const badgeState = {inboxVers: 7} as any

  dispatch.onEngineIncoming({
    payload: {params: {badgeState}},
    type: 'keybase.1.NotifyBadges.badgeState',
  } as any)
  expect(useConfigState.getState().badgeState).toEqual(badgeState)

  dispatch.onEngineIncoming({
    payload: {params: {message: 'root bad'}},
    type: 'keybase.1.NotifyAudit.rootAuditError',
  } as any)
  expect(useConfigState.getState().globalError?.message).toBe(
    'Keybase is buggy, please report this: root bad'
  )

  dispatch.onEngineIncoming({
    payload: {params: {message: 'box bad'}},
    type: 'keybase.1.NotifyAudit.boxAuditError',
  } as any)
  expect(useConfigState.getState().globalError?.message).toBe(
    'Keybase had a problem loading a team, please report this with `keybase log send`: box bad'
  )
})

test('custom resetState preserves the fields config intentionally carries across resets', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setAccounts([{hasStoredSecret: true, uid: 'alice-uid', username: 'alice'}])
  dispatch.setDefaultUsername('alice')
  useConfigState.setState({
    globalError: new Error('transient'),
    userSwitching: true,
  } as any)

  dispatch.resetState()

  const state = useConfigState.getState()
  expect(state.configuredAccounts).toEqual([{hasStoredSecret: true, uid: 'alice-uid', username: 'alice'}])
  expect(state.defaultUsername).toBe('alice')
  expect(state.userSwitching).toBe(true)
  expect(state.globalError).toBeUndefined()
})

test('logging out keeps the http server address: it belongs to the process, not the account', () => {
  const {dispatch} = useConfigState.getState()
  dispatch.onEngineIncoming({
    payload: {params: {info: {address: '127.0.0.1:2', token: 'token'}}},
    type: 'keybase.1.NotifyService.HTTPSrvInfoUpdate',
  } as never)

  dispatch.resetState()

  expect(useConfigState.getState().httpSrv).toEqual({address: '127.0.0.1:2', token: 'token'})
})

test('loggedIn and loggedOut notifications do not set the session themselves', () => {
  const {dispatch} = useConfigState.getState()
  dispatch.onEngineIncoming({
    payload: {params: {signedUp: false, username: 'testuser'}},
    type: 'keybase.1.NotifySession.loggedIn',
  } as never)
  expect(useConfigState.getState().loggedIn).toBe(false)

  dispatch.setLoggedIn(true)
  dispatch.onEngineIncoming({payload: {params: undefined}, type: 'keybase.1.NotifySession.loggedOut'} as never)
  expect(useConfigState.getState().loggedIn).toBe(true)
  dispatch.setLoggedIn(false)
})

describe('login', () => {
  const loginRpc = 'keybase.1.login.login'
  const bootstrapRpc = 'keybase.1.config.getBootstrapStatus'
  const originalDaemonDispatch = useDaemonState.getState().dispatch
  // whether the switch was still running each time the session was read
  let switchingWhenRead: Array<boolean>
  beforeEach(() => {
    switchingWhenRead = []
    // the real read, recording when it starts
    useDaemonState.setState({
      dispatch: {
        ...originalDaemonDispatch,
        refreshSessionFromDaemon: reason => {
          switchingWhenRead.push(useConfigState.getState().userSwitching)
          originalDaemonDispatch.refreshSessionFromDaemon(reason)
        },
      },
    })
  })
  afterEach(() => {
    jest.restoreAllMocks()
    useDaemonState.setState({dispatch: originalDaemonDispatch})
  })

  const flush = settle

  // The service: what the session read answers, and every login held for the test to end
  const serve = (): {fake: FakeEngine; logins: ReturnType<FakeEngine['hold']>} => {
    const fake = installFakeEngine()
    fake.answer(bootstrapRpc, () => ({
      deviceID: '',
      deviceName: '',
      fullname: '',
      httpSrvInfo: null,
      loggedIn: false,
      registered: true,
      uid: '',
      userReacjis: {skinTone: 0, topReacjis: null},
      username: '',
    }))
    return {fake, logins: fake.hold(loginRpc)}
  }
  const sessionReads = (fake: FakeEngine) => fake.calls.filter(c => c.method === bootstrapRpc).length

  const loginEnding = async (answer: unknown, switching = false) => {
    const {fake, logins} = serve()
    const {dispatch} = useConfigState.getState()
    if (switching) dispatch.setUserSwitching(true, 'testuser')
    dispatch.login('testuser', switching ? '' : 'password')
    await flush()
    logins[0]!.reply(answer)
    await flush()
    return fake
  }

  test('reads the session from the daemon when the login succeeds', async () => {
    const fake = await loginEnding(null)

    expect(sessionReads(fake)).toBe(1)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().loginError).toBeUndefined()
  })

  test('reads the session from the daemon when already logged in', async () => {
    const fake = await loginEnding(fakeError(T.RPCGen.StatusCode.scalreadyloggedin, 'already logged in'))

    expect(sessionReads(fake)).toBe(1)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().loginError).toBeUndefined()
  })

  test('a failed switch stops switching before it reads the session, so a logged-out reply applies', async () => {
    const fake = await loginEnding(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad password'), true)

    expect(switchingWhenRead).toEqual([false])
    expect(sessionReads(fake)).toBe(1)
    expect(useConfigState.getState().loginError).toBeDefined()
  })

  test('an account that needs provisioning ends the switch, and lands on username once the logged-out stack is up', async () => {
    const nav = installNavigation({rootState: makeRootState()})
    const {fake, logins} = serve()
    const {dispatch} = useConfigState.getState()
    await act(async () => {
      dispatch.setUserSwitching(true, 'testuser')
      dispatch.login('testuser', '')
      await flush()
    })

    const sessionID = fake.calls[0]!.params.sessionID as number
    const answered = await act(async () =>
      fake.push('keybase.1.provisionUi.PromptNewDeviceName', {errorMessage: '', existingDevices: null}, {sessionID})
    )
    // the login cancels the prompt itself and hands off to the provision flow
    expect(answered.error).toEqual(expect.objectContaining({desc: 'Canceling RPC'}))
    expect(useConfigState.getState().userSwitching).toBe(false)
    // the logged-out stack is not up yet, so nothing is pushed
    expect(nav.pushes()).toEqual([])

    // the service's logout brings the logged-out root
    nav.setLoggedIn(false)
    expect(nav.visibleScreen()).toEqual(
      expect.objectContaining({name: 'username', params: {autoSubmit: true, username: 'testuser'}})
    )

    await act(async () => {
      logins[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'Canceling RPC'))
      await flush()
    })
    expect(useConfigState.getState().loginError).toBeUndefined()
  })

  test('a prompt login cancelled itself clears userSwitching without a login error', async () => {
    await loginEnding(fakeError(T.RPCGen.StatusCode.scgeneric, 'Canceling RPC'), true)

    const state = useConfigState.getState()
    expect(state.userSwitching).toBe(false)
    expect(state.loginError).toBeUndefined()
  })

  // Not something the engine produces; the login's own code throwing is what this guards
  test('a failure that is not an RPCError clears userSwitching', async () => {
    jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockRejectedValue(new Error('boom'))
    const {dispatch} = useConfigState.getState()
    dispatch.setUserSwitching(true, 'testuser')
    dispatch.login('testuser', '')
    await flush()

    expect(useConfigState.getState().userSwitching).toBe(false)
  })

  test("a login that fails after a switch started leaves the switch alone, and the newer one's failure still ends it", async () => {
    const {logins} = serve()
    const {dispatch} = useConfigState.getState()
    dispatch.login('testuser', 'password')
    await flush()
    // e.g. a tapped push for another account while a password login is still running
    dispatch.switchToAccount('testuser-mac')
    await flush()
    expect(logins).toHaveLength(2)

    logins[0]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await flush()
    let state = useConfigState.getState()
    expect(state.userSwitching).toBe(true)
    expect(state.userSwitchingTo).toBe('testuser-mac')
    expect(state.loginError).toBeUndefined()

    logins[1]!.reply(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'))
    await flush()
    state = useConfigState.getState()
    expect(state.userSwitching).toBe(false)
    expect(state.loginError?.desc).toBeTruthy()
  })

  test('prompts that arrive for a login after a switch started do not end the switch', async () => {
    const nav = installNavigation({rootState: makeRootState()})
    const {fake, logins} = serve()
    const {dispatch} = useConfigState.getState()
    await act(async () => {
      dispatch.login('testuser', 'password')
      await flush()
      // e.g. a tapped push for another account while a password login is still running
      dispatch.switchToAccount('testuser-mac')
      await flush()

      const staleSession = fake.calls[0]!.params.sessionID as number
      await fake.push(
        'keybase.1.provisionUi.PromptNewDeviceName',
        {errorMessage: '', existingDevices: null},
        {sessionID: staleSession}
      )
      await fake.push(
        'keybase.1.secretUi.getPassphrase',
        {pinentry: {retryLabel: 'Incorrect password.', type: T.RPCGen.PassphraseType.passPhrase}},
        {sessionID: staleSession}
      )
      await flush()
    })

    const state = useConfigState.getState()
    expect(state.userSwitching).toBe(true)
    expect(state.loginError).toBeUndefined()
    // nothing waits to push username when a logged-out stack comes up
    nav.setLoggedIn(false)
    expect(NavTree.visibleScreen(nav.getRootState())?.name).toBe('login')
    expect(nav.pushes()).toEqual([])
    logins.forEach(l => l.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'done')))
  })

  test.each([
    ['keybase.1.loginUi.promptResetAccount', {prompt: {t: T.RPCGen.ResetPromptType.enterNoDevices}}, T.RPCGen.ResetPromptResponse.nothing],
    ['keybase.1.provisionUi.chooseDeviceType', {kind: T.RPCGen.ChooseType.existingDevice}, T.RPCGen.DeviceType.desktop],
    ['keybase.1.provisionUi.switchToGPGSignOK', {importError: '', key: {}}, false],
  ] as const)('login answers %s with the zero value, once', async (method, params, answer) => {
    const fake = installFakeEngine()
    fake.hold(loginRpc)
    useConfigState.getState().dispatch.login('testuser', 'password')
    await flush()
    const sessionID = fake.calls[0]!.params.sessionID as number
    await expect(fake.push(method, params, {sessionID})).resolves.toEqual({result: answer})
    await flush()
    // The fake records a second answer to the seqid, or a prompt the login neither handles nor declares
    expect(() => uninstallFakeEngine()).not.toThrow()
  })

  test('an RPC error clears userSwitching and records the login error', async () => {
    await loginEnding(fakeError(T.RPCGen.StatusCode.scgeneric, 'bad things'), true)

    const state = useConfigState.getState()
    expect(state.userSwitching).toBe(false)
    expect(state.loginError?.desc).toBeTruthy()
  })

  describe('through the engine listener', () => {
    const switchFailingWith = async (code: T.RPCGen.StatusCode, desc: string) =>
      loginEnding(fakeError(code, desc), true)

    test('a service error ends the switch and records the nice error', async () => {
      await switchFailingWith(T.RPCGen.StatusCode.scbadloginpassword, 'bad password')

      const state = useConfigState.getState()
      expect(state.userSwitching).toBe(false)
      expect(state.loginError?.desc).toBe('Looks like a bad password.')
      // the engine's error, which the waiting key also holds, keeps the service's message
      expect(useWaitingState.getState().errors.get(waitingKeyConfigLogin)?.desc).toBe('bad password')
    })

    test('already logged in ends the switch without a login error', async () => {
      const fake = await switchFailingWith(T.RPCGen.StatusCode.scalreadyloggedin, 'already logged in')

      const state = useConfigState.getState()
      expect(state.userSwitching).toBe(false)
      expect(state.loginError).toBeUndefined()
      expect(sessionReads(fake)).toBe(1)
    })

    test.each([
      ['a session cancel', T.RPCGen.StatusCode.sccanceled],
      ['an input cancel', T.RPCGen.StatusCode.scinputcanceled],
    ])('%s from the service ends the switch without a login error', async (_, code) => {
      await switchFailingWith(code, 'canceled by the service')

      const state = useConfigState.getState()
      expect(state.userSwitching).toBe(false)
      expect(state.loginError).toBeUndefined()
    })

    test('a login that cancelled its own prompt ends the switch without a login error', async () => {
      await switchFailingWith(T.RPCGen.StatusCode.scgeneric, 'Canceling RPC')

      const state = useConfigState.getState()
      expect(state.userSwitching).toBe(false)
      expect(state.loginError).toBeUndefined()
    })
  })
})

test('a navigator ready for the switch target ends the switch, one ready for a superseded target does not', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setUserSwitching(true, 'testuser-mac')
  dispatch.endUserSwitchLandedOn('testuser')
  expect(useConfigState.getState().userSwitching).toBe(true)

  dispatch.endUserSwitchLandedOn('testuser-mac')
  expect(useConfigState.getState().userSwitching).toBe(false)
})

test("setUserSwitching records the switch's target, clears it with the flag, and keeps it across resets", () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setUserSwitching(true, 'testuser')
  dispatch.resetState()
  expect(useConfigState.getState().userSwitchingTo).toBe('testuser')

  dispatch.setUserSwitching(false)
  expect(useConfigState.getState().userSwitchingTo).toBe('')
})

test('setUserSwitching records whether the switch started logged in, through the mid-switch reset', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setUserSwitching(true, 'testuser')
  expect(useConfigState.getState().userSwitchingFromLoggedIn).toBe(false)

  dispatch.setLoggedIn(true)
  dispatch.setUserSwitching(true, 'testuser')
  // the service's loggedOut notification during a switch resets every store
  dispatch.setLoggedIn(false)
  expect(useConfigState.getState().userSwitchingFromLoggedIn).toBe(true)

  dispatch.setUserSwitching(false)
  expect(useConfigState.getState().userSwitchingFromLoggedIn).toBe(false)
})

test('switchToAccount starts a switch to its target and logs in, and refuses while one is running', async () => {
  const fake = installFakeEngine()
  const logins = fake.hold('keybase.1.login.login')
  const {dispatch} = useConfigState.getState()

  expect(dispatch.switchToAccount('testuser')).toBe(true)
  expect(useConfigState.getState().userSwitchingTo).toBe('testuser')
  await settle()
  expect(logins.map(l => l.params.username as unknown)).toEqual(['testuser'])

  expect(dispatch.switchToAccount('testuser-mac')).toBe(false)
  expect(useConfigState.getState().userSwitchingTo).toBe('testuser')
  await settle()
  expect(logins).toHaveLength(1)

  dispatch.setUserSwitching(false)
  logins[0]!.reply(fakeError(T.RPCGen.StatusCode.sccanceled, 'done'))
})

test('a logout starts a new account generation before anything reacts to it', () => {
  const {dispatch} = useConfigState.getState()
  dispatch.setLoggedIn(true)
  const before = getAccountGeneration()
  let seenByReaction: number | undefined
  const unsub = useConfigState.subscribe((s, old) => {
    if (old.loggedIn && !s.loggedIn) {
      seenByReaction = getAccountGeneration()
    }
  })

  dispatch.setLoggedIn(false)
  unsub()

  expect(seenByReaction).toBe(before + 1)
})
