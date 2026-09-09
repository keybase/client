/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'

jest.mock('@/constants/chat/common', () => ({
  ...jest.requireActual('@/constants/chat/common'),
  getSelectedConversation: jest.fn(),
}))

import * as Common from '@/constants/chat/common'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {maybeChangeSelectedConversation} from './metadata'

const newConvID = 'ff00ff00'
const mockedSelected = Common.getSelectedConversation as jest.Mock

const layout = (over: Partial<T.RPCChat.UIInboxReselectInfo>): T.RPCChat.UIInboxLayout =>
  ({reselectInfo: {oldConvID: '', ...over}}) as T.RPCChat.UIInboxLayout

let nav: FakeNavigator

// navigateToInbox defers a tick, so every assertion below has to let that tick run.
const runDeferredNavigation = () => jest.advanceTimersByTime(1)

beforeEach(() => {
  jest.useFakeTimers()
  nav = installFakeNavigator()
  useConfigState.setState({loggedIn: true})
  global.isMobile = true
})

afterEach(() => {
  restoreNavigator()
  jest.useRealTimers()
  jest.clearAllMocks()
  resetAllStores()
  global.isMobile = false
})

// Creating a conversation parks the thread screen on PENDING-WAITING while the RPC runs. The
// service rebuilds the inbox layout as soon as the conv exists, and since it has never been told
// a selected conv (nothing was ever loaded when the inbox was empty) that layout always carries
// reselectInfo. Acting on it pops the screen the create flow is about to fill in.
test('a reselect while a conversation creation is pending does not pop to the inbox', () => {
  mockedSelected.mockReturnValue(T.Chat.pendingWaitingConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expect(nav.actions).toEqual([])
})

test('a reselect while the create error screen is up does not pop to the inbox', () => {
  mockedSelected.mockReturnValue(T.Chat.pendingErrorConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expect(nav.actions).toEqual([])
})

// the real "we are on a dead conversation" case still has to bounce
test('a reselect with nothing selected still goes to the inbox on mobile', () => {
  mockedSelected.mockReturnValue(T.Chat.noConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  // navigateToInbox(false): stay on the chat tab and pop its stack back to the inbox
  expect(nav.types()).toContain('POP_TO')
  expect(nav.lastAction()?.payload).toMatchObject({name: 'chatRoot'})
})

// The bounce is navigateToInbox(false): it must not pull the user off whatever tab they
// are on. Only the chat tab's own stack gets popped.
test('a reselect while another tab is up leaves that tab alone', () => {
  nav = installFakeNavigator({rootState: makeRootState({tab: Tabs.teamsTab})})
  mockedSelected.mockReturnValue(T.Chat.noConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expect(nav.actions).toEqual([])
})
