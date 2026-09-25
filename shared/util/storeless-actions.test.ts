/// <reference types="jest" />
import * as T from '@/constants/types'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {persistRoute} from './storeless-actions'

// persistRoute skips a route it already saved, so every test shows a different conversation
let mockConversation = ''
jest.mock('@/constants/router', () => ({
  getTab: () => 'tabs.chatTab',
  getVisiblePath: () => [{name: 'chatConversation', params: {conversationIDKey: mockConversation}}],
}))

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

const persistedAfterDelay = async (switchAccount: boolean) => {
  mockConversation = `conv-${String(switchAccount)}`
  const setValue = jest.spyOn(T.RPCGen, 'configGuiSetValueRpcPromise').mockResolvedValue(undefined)
  setUser('uid-1', 'testuser')
  persistRoute(false, false, () => true)
  if (switchAccount) {
    setUser('uid-2', 'testuser-mac')
  }
  await jest.advanceTimersByTimeAsync(1000)
  return setValue.mock.calls.map(c => JSON.parse(c[0].value.s ?? '') as {uid: string})
}

test('persists the route on screen under the account it belongs to', async () => {
  expect(await persistedAfterDelay(false)).toEqual([expect.objectContaining({uid: 'uid-1'})])
})

test('drops a delayed persist when an account switch lands first', async () => {
  expect(await persistedAfterDelay(true)).toEqual([])
})
