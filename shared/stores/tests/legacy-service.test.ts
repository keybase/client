/// <reference types="jest" />
import type * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {useDaemonState} from '../daemon'
import {applyClientState, onBootstrapStatusChanged} from '@/constants/init/shared'

// Its own file: whether the connected service answers setNotifications with a snapshot is
// module state in the init layer that outlives resetAllStores, and jest gives each file a
// fresh module registry.

const notifySession = (kind: 'loggedIn' | 'loggedOut') =>
  useConfigState.getState().dispatch.onEngineIncoming({
    payload: {params: kind === 'loggedIn' ? {signedUp: false, username: 'testuser'} : {}},
    type: `keybase.1.NotifySession.${kind}`,
  } as never)

const status = (over: Partial<T.RPCGen.BootstrapStatus> = {}) =>
  ({
    deviceID: 'd1',
    deviceName: 'testuser-mac',
    loggedIn: true,
    registered: true,
    uid: 'u1',
    username: 'testuser',
    ...over,
  }) as T.RPCGen.BootstrapStatus

const snapshot = (over: Partial<T.RPCGen.ClientState> = {}): T.RPCGen.ClientState => ({
  deviceID: 'd2',
  deviceName: 'testuser-other',
  loggedIn: true,
  registered: true,
  uid: 'u2',
  username: 'testuser-mac',
  version: {counter: 1, epoch: 1000},
  ...over,
})

beforeEach(() => {
  // httpSrv is process-wide and survives resetAllStores on purpose
  useConfigState.setState(st => {
    st.httpSrv = {address: '', token: ''}
  })
})
afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('a service too old for the snapshot', () => {
  test('has its bootstrap status own the session and the http address', () => {
    applyClientState(undefined)
    onBootstrapStatusChanged(status({httpSrvInfo: {address: '127.0.0.1:1', token: 'token'}}))

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('applies its unversioned notifications in arrival order', () => {
    applyClientState(undefined)
    onBootstrapStatusChanged(status())
    expect(useConfigState.getState().loggedIn).toBe(true)

    notifySession('loggedOut')
    expect(useConfigState.getState().loggedIn).toBe(false)
  })

  test('is applied even when its status landed before we knew the service was old', () => {
    // a status identical to the stored one does not notify again, so learning that the service
    // has no snapshot has to re-apply what is already in the store
    useDaemonState.setState({bootstrapStatus: status()})
    expect(useConfigState.getState().loggedIn).toBe(false)

    applyClientState(undefined)

    expect(useConfigState.getState().loggedIn).toBe(true)
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('stops owning the session the moment a service does answer with a snapshot', () => {
    applyClientState(snapshot({loggedIn: true}))
    expect(useCurrentUserState.getState().username).toBe('testuser-mac')

    onBootstrapStatusChanged(status({httpSrvInfo: {address: '127.0.0.1:9', token: 'token'}}))

    expect(useConfigState.getState().httpSrv.address).toBe('')
    // the identity still comes from the status: it agrees with the session we are in
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('owns the session again after a downgrade under a live client', () => {
    applyClientState(snapshot({loggedIn: true, version: {counter: 9, epoch: 1000}}))
    expect(useConfigState.getState().loggedIn).toBe(true)

    // the service is stopped and an older one starts; the reconnect answers with no snapshot
    applyClientState(undefined)
    onBootstrapStatusChanged(status({httpSrvInfo: {address: '127.0.0.1:9', token: 'token'}, loggedIn: false}))

    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:9')
  })
})
