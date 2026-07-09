/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {useUserSwitchNavKey} from './use-user-switch-nav-key'

const setUsername = (username: string) => {
  act(() => {
    useCurrentUserState
      .getState()
      .dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid: username, username})
  })
}

afterEach(() => {
  cleanup()
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
