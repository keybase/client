/// <reference types="jest" />
import type * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '../config'
import {useCurrentUserState} from '../current-user'
import {applyClientState, onBootstrapStatusChanged} from '@/constants/init/shared'

// Its own file: "nothing versioned has landed yet" is process-wide state that outlives
// resetAllStores on purpose, and jest gives each file a fresh module registry. The tests below
// run in declaration order and each one moves that state forward, so they are ordered on purpose.

const notifySession = (kind: 'loggedIn' | 'loggedOut') =>
  useConfigState.getState().dispatch.onEngineIncoming({
    payload: {params: kind === 'loggedIn' ? {signedUp: false, username: 'testuser'} : {}},
    type: `keybase.1.NotifySession.${kind}`,
  } as never)

afterEach(() => {
  jest.restoreAllMocks()
  resetAllStores()
})

describe('a service too old for the snapshot', () => {
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

  test('still owns the address while the snapshot has none: the http server is not up yet', () => {
    applyClientState({
      deviceID: 'd1',
      deviceName: 'testuser-mac',
      loggedIn: false,
      registered: true,
      uid: 'u1',
      username: 'testuser',
      version: {counter: 2, epoch: 1000},
    })
    expect(useConfigState.getState().loggedIn).toBe(false)

    onBootstrapStatusChanged(status({httpSrvInfo: {address: '127.0.0.1:9', token: 'token'}}))

    // the session is versioned now, so the status no longer owns it
    expect(useConfigState.getState().loggedIn).toBe(false)
    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:9')
    // the current user always comes from the status, versioned or not
    expect(useCurrentUserState.getState().username).toBe('testuser')
  })

  test('stops owning the address once a snapshot carries one', () => {
    applyClientState({
      deviceID: 'd1',
      deviceName: 'testuser-mac',
      httpSrvInfo: {address: '127.0.0.1:1', token: 'token'},
      loggedIn: false,
      registered: true,
      uid: 'u1',
      username: 'testuser',
      version: {counter: 3, epoch: 1000},
    })

    onBootstrapStatusChanged(status({httpSrvInfo: {address: '127.0.0.1:9', token: 'token'}}))

    expect(useConfigState.getState().httpSrv.address).toBe('127.0.0.1:1')
  })
})
