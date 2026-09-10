/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {navigationRef} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useNavigationIntentsState} from '@/stores/navigation-intents'
import {resetAllStores} from '@/util/zustand'
import {useUserSwitchNavKey} from './use-user-switch-nav-key'

beforeEach(() => {
  // the jest mock's container ref is a plain object, so stub the method the hook reads
  ;(navigationRef as unknown as Record<string, unknown>)['isReady'] = () => true
})

const readiness = () => {
  const {navigationReady, navigationReadyForUid} = useNavigationIntentsState.getState()
  return {navigationReady, navigationReadyForUid}
}

const setUsername = (username: string) => {
  act(() => {
    useCurrentUserState
      .getState()
      .dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid: username, username})
  })
}

const startSwitchTo = (username: string) => {
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(true, username)
  })
}

// setLoggedIn(false) between the service's loggedOut and loggedIn notifications, and a logout,
// both run resetAllStores(), which blanks the current user
const blankCurrentUser = () => {
  act(() => {
    resetAllStores()
  })
}

afterEach(() => {
  cleanup()
  // config's resetState carries the switch across resets, so end it explicitly
  useConfigState.getState().dispatch.setUserSwitching(false)
  resetAllStores()
})

test('initial login does not change the nav key', () => {
  const {result} = renderHook(() => useUserSwitchNavKey())
  expect(result.current).toBe('')

  setUsername('testuser')
  expect(result.current).toBe('')
})

test('switching between two logged in users changes the nav key', () => {
  setUsername('testuser')
  const {result} = renderHook(() => useUserSwitchNavKey())
  expect(result.current).toBe('')

  setUsername('testuser-mac')
  expect(result.current).toBe('testuser-mac')
})

test('an account switch that blanks username mid-flight still changes the nav key', () => {
  setUsername('testuser')
  const {result} = renderHook(() => useUserSwitchNavKey())
  expect(result.current).toBe('')

  // setLoggedIn(false) between the service's loggedOut and loggedIn notifications
  // runs resetAllStores(), which blanks the current user
  act(() => {
    resetAllStores()
  })
  expect(result.current).toBe('')

  setUsername('testuser-mac')
  expect(result.current).toBe('testuser-mac')
})

test('a switch that lands back on the account the navigator shows ends the switch', () => {
  setUsername('testuser')
  const {result} = renderHook(() => useUserSwitchNavKey())
  blankCurrentUser()
  startSwitchTo('testuser')

  setUsername('testuser')

  expect(result.current).toBe('')
  expect(useConfigState.getState().userSwitching).toBe(false)
})

test('a first switch after starting logged out ends when its account arrives', () => {
  const {result} = renderHook(() => useUserSwitchNavKey())
  startSwitchTo('testuser')

  setUsername('testuser')

  expect(result.current).toBe('')
  expect(useConfigState.getState().userSwitching).toBe(false)
})

test('a stale username mid-switch does not end the switch, and the remount leaves it for onReady', () => {
  setUsername('testuser')
  const {result} = renderHook(() => useUserSwitchNavKey())
  startSwitchTo('testuser-mac')
  blankCurrentUser()

  setUsername('testuser')
  expect(result.current).toBe('')
  expect(useConfigState.getState().userSwitching).toBe(true)

  setUsername('testuser-mac')
  expect(result.current).toBe('testuser-mac')
  expect(useConfigState.getState().userSwitching).toBe(true)
})

test('logging back in on the mounted navigator restores navigation readiness for that account', () => {
  setUsername('testuser')
  renderHook(() => useUserSwitchNavKey())
  // a logout's store reset clears readiness
  blankCurrentUser()
  expect(readiness().navigationReady).toBe(false)

  setUsername('testuser')

  expect(readiness()).toEqual({navigationReady: true, navigationReadyForUid: 'testuser'})
})

test('a switch that lands on the mounted navigator ends only after readiness is back', () => {
  setUsername('testuser')
  renderHook(() => useUserSwitchNavKey())
  blankCurrentUser()
  startSwitchTo('testuser')
  let readyWhenSwitchEnded: boolean | undefined
  const unsub = useConfigState.subscribe((s, p) => {
    if (p.userSwitching && !s.userSwitching) {
      readyWhenSwitchEnded = useNavigationIntentsState.getState().navigationReady
    }
  })

  setUsername('testuser')
  unsub()

  expect(readyWhenSwitchEnded).toBe(true)
})

test('the first render leaves navigation readiness to onReady', () => {
  setUsername('testuser')
  renderHook(() => useUserSwitchNavKey())

  expect(readiness().navigationReady).toBe(false)
})
