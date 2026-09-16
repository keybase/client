/// <reference types="jest" />
jest.mock('@/constants/router', () => ({
  ...jest.requireActual('@/constants/router'),
  navigateAppendOnceRootHas: jest.fn(),
}))

import * as T from '../../constants/types'
import * as Tabs from '../../constants/tabs'
import {navigateAppendOnceRootHas} from '../../constants/router'
import {RPCError} from '../../util/errors'
import {useDaemonState} from '../daemon'
import {noConversationIDKey} from '../../constants/types/chat/common'
import {useConfigState} from '../config'

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
  const mockOnceRootHas = jest.mocked(navigateAppendOnceRootHas)
  const originalDaemonDispatch = useDaemonState.getState().dispatch
  let refresh: jest.Mock
  beforeEach(() => {
    refresh = jest.fn()
    useDaemonState.setState({dispatch: {...originalDaemonDispatch, refreshSessionFromDaemon: refresh}})
  })
  afterEach(() => {
    jest.restoreAllMocks()
    useDaemonState.setState({dispatch: originalDaemonDispatch})
    mockOnceRootHas.mockReset()
  })

  const flush = async () => new Promise(resolve => setImmediate(resolve))

  test('reads the session from the daemon when the login succeeds', async () => {
    jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockResolvedValue(undefined)
    useConfigState.getState().dispatch.login('testuser', 'password')
    await flush()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().loginError).toBeUndefined()
  })

  test('reads the session from the daemon when already logged in', async () => {
    jest
      .spyOn(T.RPCGen, 'loginLoginRpcListener')
      .mockRejectedValue(new RPCError('already logged in', T.RPCGen.StatusCode.scalreadyloggedin))
    useConfigState.getState().dispatch.login('testuser', 'password')
    await flush()

    expect(refresh).toHaveBeenCalledTimes(1)
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().loginError).toBeUndefined()
  })

  test('a failed switch stops switching before it reads the session, so a logged-out reply applies', async () => {
    jest
      .spyOn(T.RPCGen, 'loginLoginRpcListener')
      .mockRejectedValue(new RPCError('bad password', T.RPCGen.StatusCode.scgeneric))
    const switchingWhenRead: Array<boolean> = []
    refresh.mockImplementation(() => switchingWhenRead.push(useConfigState.getState().userSwitching))
    useConfigState.getState().dispatch.setUserSwitching(true)
    useConfigState.getState().dispatch.login('testuser', 'password')
    await flush()

    expect(switchingWhenRead).toEqual([false])
    expect(useConfigState.getState().loginError).toBeDefined()
  })

  const switchWithLoginFailure = async (failure: unknown) => {
    jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockRejectedValue(failure)
    const {dispatch} = useConfigState.getState()
    dispatch.setUserSwitching(true)
    dispatch.login('testuser', '')
    await flush()
  }

  test('an account that needs provisioning ends the switch before handing off to username', async () => {
    let switchingAtHandOff: boolean | undefined
    mockOnceRootHas.mockImplementation(() => {
      switchingAtHandOff = useConfigState.getState().userSwitching
    })
    const cancelled = jest.fn().mockRejectedValue(new RPCError('Canceling RPC', T.RPCGen.StatusCode.scgeneric))
    jest.spyOn(T.RPCGen, 'loginLoginRpcListener').mockImplementation(listener => {
      const prompt = (listener as any).customResponseIncomingCallMap['keybase.1.provisionUi.PromptNewDeviceName']
      prompt({}, {error: jest.fn(), result: jest.fn()})
      return cancelled()
    })
    const {dispatch} = useConfigState.getState()
    dispatch.setUserSwitching(true)
    dispatch.login('testuser', '')
    await flush()

    expect(mockOnceRootHas).toHaveBeenCalledWith('loggedOut', {
      name: 'username',
      params: {autoSubmit: true, username: 'testuser'},
    })
    expect(switchingAtHandOff).toBe(false)
  })

  test('a prompt login cancelled itself clears userSwitching without a login error', async () => {
    await switchWithLoginFailure(new RPCError('Canceling RPC', T.RPCGen.StatusCode.scgeneric))

    const state = useConfigState.getState()
    expect(state.userSwitching).toBe(false)
    expect(state.loginError).toBeUndefined()
  })

  test('a failure that is not an RPCError clears userSwitching', async () => {
    await switchWithLoginFailure(new Error('boom'))

    expect(useConfigState.getState().userSwitching).toBe(false)
  })

  test('an RPC error clears userSwitching and records the login error', async () => {
    await switchWithLoginFailure(new RPCError('bad things', T.RPCGen.StatusCode.scgeneric))

    const state = useConfigState.getState()
    expect(state.userSwitching).toBe(false)
    expect(state.loginError?.desc).toBeTruthy()
  })
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

test('a switch started during another switch keeps the first switch\'s logged-in state and takes the new target', () => {
  const {dispatch} = useConfigState.getState()

  dispatch.setLoggedIn(true)
  dispatch.setUserSwitching(true, 'testuser')
  dispatch.setLoggedIn(false)
  dispatch.setUserSwitching(true, 'testuser-mac')

  const state = useConfigState.getState()
  expect(state.userSwitchingFromLoggedIn).toBe(true)
  expect(state.userSwitchingTo).toBe('testuser-mac')
})
