/** @jest-environment jsdom */
/// <reference types="jest" />
// The push store picks its platform as it loads, so the globals are set before anything is
// required, and the modules under test are required after.
import type * as TL from '@testing-library/react'
import type * as Zustand from '@/util/zustand'
import type * as CurrentUser from '@/stores/current-user'
import type * as FakeEngine from '@/test/fake-engine'
import type * as Flush from '@/test/flush'
import type * as Navigation from '@/test/navigation'
import type * as NavTreeModule from '@/constants/nav-tree'
import type * as Tabs from '@/constants/tabs'
import type * as RequestLogout from './use-request-logout'
import type {FakeNativeKbModule} from '@/test/fake-native-kb'

jest.mock('react-native-kb', () => jest.requireActual<FakeNativeKbModule>('@/test/fake-native-kb').realKb())
// The navigation tree draws the app's views, whose theme calls this native-only color API at load
// time under isIOS; react-native-web has no such API.
jest.mock('react-native', () => ({
  ...jest.requireActual<object>('react-native'),
  DynamicColorIOS: (p: {light: string}) => p.light,
}))

const g = globalThis as unknown as {isAndroid: boolean; isIOS: boolean; isMobile: boolean; isPhone: boolean}
const originalGlobals = {isAndroid: g.isAndroid, isIOS: g.isIOS, isMobile: g.isMobile, isPhone: g.isPhone}
g.isMobile = true
g.isIOS = true
g.isAndroid = false
g.isPhone = true

const {act, cleanup, renderHook} = jest.requireActual<typeof TL>('@testing-library/react')
const {resetAllStores} = jest.requireActual<typeof Zustand>('@/util/zustand')
const {useCurrentUserState} = jest.requireActual<typeof CurrentUser>('@/stores/current-user')
const {installFakeEngine} = jest.requireActual<typeof FakeEngine>('@/test/fake-engine')
const {flush} = jest.requireActual<typeof Flush>('@/test/flush')
const {navigationWrapper} = jest.requireActual<typeof Navigation>('@/test/navigation')
const NavTree = jest.requireActual<typeof NavTreeModule>('@/constants/nav-tree')
const {chatTab} = jest.requireActual<typeof Tabs>('@/constants/tabs')
const {settingsPasswordTab} = jest.requireActual<{settingsPasswordTab: string}>('@/constants/settings')
const {useRequestLogout} = jest.requireActual<typeof RequestLogout>('./use-request-logout')

const canLogoutRpc = 'keybase.1.user.canLogout'
const logoutRpc = 'keybase.1.login.logout'
const deleteTokenRpc = 'keybase.1.apiserver.Delete'

const renderOnLogout = () => {
  const fake = installFakeEngine()
  const nav = navigationWrapper({layout: 'phone', route: 'settingsTabs.logOutTab'})
  const {result} = renderHook(() => useRequestLogout(), {wrapper: nav.wrapper})
  const request = async () => {
    act(() => {
      result.current()
    })
    await flush()
  }
  return {fake, nav, request}
}

afterEach(() => {
  cleanup()
  resetAllStores()
})

afterAll(() => {
  Object.assign(g, originalGlobals)
})

test('logs out only after the push token is unregistered', async () => {
  useCurrentUserState.setState({deviceID: 'device-1'})
  const {fake, nav, request} = renderOnLogout()
  fake.answer(canLogoutRpc, () => ({canLogout: true, reason: ''}))
  const deleteToken = fake.hold(deleteTokenRpc)
  fake.answer(logoutRpc, () => null)

  await request()

  // the API call needs the still-logged-in session, so the token has to go first
  expect(fake.calls.map(c => c.method)).toEqual([canLogoutRpc, deleteTokenRpc])
  expect(deleteToken[0]!.params).toEqual(
    expect.objectContaining({
      args: [
        {key: 'device_id', value: 'device-1'},
        {key: 'token_type', value: 'apple'},
      ],
      endpoint: 'device/push_token',
    })
  )

  deleteToken[0]!.reply({body: '', status: 200})
  await flush()
  expect(fake.calls.map(c => c.method)).toEqual([canLogoutRpc, deleteTokenRpc, logoutRpc])
  expect(nav.actions).toEqual([])
})

test('mobile pushes the password tab without switching tabs', async () => {
  const {fake, nav, request} = renderOnLogout()
  fake.answer(canLogoutRpc, () => ({canLogout: false, reason: 'set a password'}))

  await request()

  const root = nav.getRootState()
  const tabs = root?.routes?.[0]?.state
  expect(nav.types()).not.toContain('JUMP_TO')
  expect(nav.pushes()).toContainEqual({name: settingsPasswordTab, params: {}})
  expect(tabs?.routes[tabs.index ?? 0]?.name).toBe(chatTab)
  expect(NavTree.visibleScreen(root, {includeModals: true})?.name).toBe(settingsPasswordTab)
})
