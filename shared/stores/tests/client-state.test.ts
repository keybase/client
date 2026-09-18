/// <reference types="jest" />
import type * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {applyClientState} from '@/constants/init/shared'

const epoch = 1000
const version = (counter: number, e = epoch): T.RPCGen.StateVersion => ({counter, epoch: e})

const clientState = (over: Partial<T.RPCGen.ClientState> = {}): T.RPCGen.ClientState => ({
  deviceID: 'd1',
  deviceName: 'testuser-mac',
  loggedIn: true,
  registered: true,
  uid: 'u1',
  username: 'testuser',
  version: version(1),
  ...over,
})

const notifyHTTP = (address: string, v?: T.RPCGen.StateVersion) =>
  useConfigState.getState().dispatch.onEngineIncoming({
    payload: {params: {info: {address, token: 'token'}, version: v}},
    type: 'keybase.1.NotifyService.HTTPSrvInfoUpdate',
  } as never)

const notifySession = (kind: 'loggedIn' | 'loggedOut', v?: T.RPCGen.StateVersion) =>
  useConfigState.getState().dispatch.onEngineIncoming({
    payload: {
      params: kind === 'loggedIn' ? {signedUp: false, username: 'testuser', version: v} : {version: v},
    },
    type: `keybase.1.NotifySession.${kind}`,
  } as never)

// The applied versions live outside the store and deliberately survive resetAllStores, so each
// test gets its own epoch instead of relying on a reset that no longer exists.
let testEpoch = epoch
beforeEach(() => {
  testEpoch++
})
afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('the setNotifications snapshot', () => {
  test('applies the session, the current user and the http address', () => {
    applyClientState(
      clientState({
        httpSrvInfo: {address: '127.0.0.1:1', token: 'token'},
        version: version(1, testEpoch),
      })
    )

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
    expect(useCurrentUserState.getState().username).toBe('testuser')
    expect(useCurrentUserState.getState().deviceID).toBe('d1')
  })

  test('loses to a session notification that is already newer', () => {
    notifySession('loggedOut', version(7, testEpoch))
    useConfigState.setState({loggedIn: false})

    applyClientState(clientState({loggedIn: true, version: version(6, testEpoch)}))

    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useCurrentUserState.getState().username).toBe('')
  })

  test('is dropped on a tie, which costs nothing: it is labelled before the state it carries', () => {
    notifySession('loggedOut', version(4, testEpoch))
    useConfigState.setState({loggedIn: false})

    applyClientState(clientState({loggedIn: true, version: version(4, testEpoch)}))

    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('from a restarted service wins although its counter started over', () => {
    notifySession('loggedOut', version(9, testEpoch))
    useConfigState.setState({loggedIn: false})

    applyClientState(clientState({loggedIn: true, version: version(1, testEpoch + 500)}))

    expect(useConfigState.getState().loggedIn).toBe(true)
  })

  test('is ignored during an account switch when it says logged out', () => {
    useConfigState.setState({loggedIn: true, userSwitching: true})

    applyClientState(clientState({loggedIn: false, version: version(1, testEpoch)}))

    expect(useConfigState.getState().loggedIn).toBe(true)
  })
})

describe('notification ordering', () => {
  test('a notification older than the applied one is ignored', () => {
    notifySession('loggedOut', version(5, testEpoch))
    expect(useConfigState.getState().loggedIn).toBe(false)

    useConfigState.setState({loggedIn: false})
    notifySession('loggedIn', version(4, testEpoch))
    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('a notification with the version already applied is ignored', () => {
    notifySession('loggedIn', version(5, testEpoch))
    expect(useConfigState.getState().loggedIn).toBe(true)

    notifySession('loggedOut', version(5, testEpoch))
    expect(useConfigState.getState().loggedIn).toBe(true)
  })

  test('the http address and the session are ordered separately off one counter', () => {
    notifyHTTP('127.0.0.1:2', version(3, testEpoch))
    notifySession('loggedIn', version(5, testEpoch))
    // stamped before the login, so a single applied version would reject it, but it is newer than
    // the address we have and the address is what it describes
    notifyHTTP('127.0.0.1:3', version(4, testEpoch))

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:3')
  })

  test('the applied versions survive an engine reconnect to the same service', () => {
    notifyHTTP('127.0.0.1:2', version(9, testEpoch))
    useConfigState.getState().dispatch.onEngineConnected()
    notifyHTTP('127.0.0.1:3', version(8, testEpoch))
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
  })

  test('logging out keeps the http server address', () => {
    notifyHTTP('127.0.0.1:2', version(1, testEpoch))
    useConfigState.getState().dispatch.resetState()
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:2')
  })
})
