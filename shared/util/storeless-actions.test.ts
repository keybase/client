/** @jest-environment jsdom */
/// <reference types="jest" />
import {setTimeout as realSleep} from 'node:timers/promises'
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {getTab} from '@/constants/router'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installNavigation, stateShowing} from '@/test/navigation'
import {persistRoute} from './storeless-actions'

const g = globalThis as {isMobile?: boolean}
const setUser = (uid: string, username: string) =>
  useCurrentUserState.getState().dispatch.setBootstrap({deviceID: 'd', deviceName: 'dn', uid, username})

beforeEach(() => {
  g.isMobile = true
  jest.useFakeTimers()
})

afterEach(() => {
  g.isMobile = false
  jest.useRealTimers()
  jest.restoreAllMocks()
  resetAllStores()
})

// On a phone, a conversation pushed above the chat tab, on the real navigation tree. persistRoute skips
// a route it already saved, so every test shows a different conversation.
const persistedAfterDelay = async (switchAccount: boolean) => {
  const conversationIDKey = `conv-${String(switchAccount)}`
  installNavigation({layout: 'phone', rootState: stateShowing('chatConversation', {layout: 'phone', params: {conversationIDKey}})})
  // The tab navigator renders on React's next timer: until then the conversation shows above a tree
  // with no tab, and a persist would save the default tab. React's scheduler took the real setTimeout
  // when it loaded, before the fake timers went in, so the fake 1000ms below does not wait for it.
  for (let i = 0; i < 100 && getTab() !== Tabs.chatTab; i++) {
    await realSleep(1)
  }
  expect(getTab()).toBe(Tabs.chatTab)
  const setValue = jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)
  setUser('uid-1', 'testuser')
  persistRoute(false, false, () => true)
  if (switchAccount) {
    setUser('uid-2', 'testuser-mac')
  }
  await jest.advanceTimersByTimeAsync(1000)
  return setValue.mock.calls.map(
    c => JSON.parse(c[0].value.s ?? '') as {param: unknown; routeName: string; uid: string}
  )
}

test('persists the route on screen under the account it belongs to', async () => {
  expect(await persistedAfterDelay(false)).toEqual([
    {param: {selectedConversationIDKey: 'conv-false'}, routeName: 'tabs.chatTab', uid: 'uid-1'},
  ])
})

test('drops a delayed persist when an account switch lands first', async () => {
  expect(await persistedAfterDelay(true)).toEqual([])
})
