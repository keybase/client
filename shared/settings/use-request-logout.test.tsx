/** @jest-environment jsdom */
/// <reference types="jest" />
import {act, cleanup, renderHook} from '@testing-library/react'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {settingsPasswordTab} from '@/constants/settings'
import {resetAllStores} from '@/util/zustand'
import * as NavTree from '@/constants/nav-tree'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {flush} from '@/test/flush'
import {navigationWrapper} from '@/test/navigation'
import {useRequestLogout} from './use-request-logout'

// The mobile path (push token first, then logout) is in use-request-logout-mobile.test.tsx: the
// push store picks its platform as it loads.

const canLogoutRpc = 'keybase.1.user.canLogout'
const logoutRpc = 'keybase.1.login.logout'

// The hook as the log-out screen runs it on desktop.
const renderOnLogout = () => {
  const fake = installFakeEngine()
  const nav = navigationWrapper({route: 'settingsTabs.logOutTab'})
  const {result} = renderHook(() => useRequestLogout(), {wrapper: nav.wrapper})
  const shown = () => NavTree.visibleScreen(nav.getRootState(), {includeModals: true})
  const selectedTab = () => {
    const tabs = nav.getRootState()?.routes?.[0]?.state
    return tabs?.routes[tabs.index ?? 0]?.name
  }
  const request = async () => {
    act(() => {
      result.current()
    })
    await flush()
  }
  return {fake, nav, request, selectedTab, shown}
}

const methods = (fake: {calls: Array<{method: string}>}) => fake.calls.map(c => c.method)

afterEach(() => {
  cleanup()
  resetAllStores()
})

test('logs out when the service allows it, without navigating', async () => {
  const {fake, nav, request} = renderOnLogout()
  fake.answer(canLogoutRpc, () => ({canLogout: true, reason: ''}))
  const logout = fake.hold(logoutRpc)

  await request()

  expect(methods(fake)).toEqual([canLogoutRpc, logoutRpc])
  expect(logout[0]!.params).toEqual(expect.objectContaining({force: false, keepSecrets: false}))
  logout[0]!.reply(null)
  await flush()
  expect(nav.actions).toEqual([])
})

test('a failing logout rpc is swallowed', async () => {
  const {fake, nav, request} = renderOnLogout()
  fake.answer(canLogoutRpc, () => ({canLogout: true, reason: ''}))
  fake.answer(logoutRpc, () => fakeError(T.RPCGen.StatusCode.scgeneric, 'service down'))

  await request()

  expect(methods(fake)).toEqual([canLogoutRpc, logoutRpc])
  // failures are swallowed: nothing navigates and the caller never sees a rejection
  expect(nav.actions).toEqual([])
})

test('nothing moves until the service says whether the user can log out', async () => {
  const {fake, nav, request} = renderOnLogout()
  const held = fake.hold(canLogoutRpc)

  await request()

  expect(held).toHaveLength(1)
  expect(nav.actions).toEqual([])
  held[0]!.reply({canLogout: false, reason: 'set a password'})
  await flush()
  expect(nav.pushes()).toContainEqual({name: settingsPasswordTab, params: {}})
})

test('desktop routes to the password tab when the user cannot log out yet', async () => {
  const {fake, nav, request, selectedTab, shown} = renderOnLogout()
  fake.answer(canLogoutRpc, () => ({canLogout: false, reason: 'set a password'}))

  await request()

  expect(methods(fake)).toEqual([canLogoutRpc])
  expect(nav.actions).toContainEqual(
    expect.objectContaining({payload: {name: Tabs.settingsTab}, type: 'JUMP_TO'})
  )
  expect(nav.pushes()).toContainEqual({name: settingsPasswordTab, params: {}})
  expect(selectedTab()).toBe(Tabs.settingsTab)
  expect(shown()?.name).toBe(settingsPasswordTab)
})
