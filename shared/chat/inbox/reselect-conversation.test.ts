/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'

// a phone: no split layout
jest.mock('@/constants/chat/common', () => ({
  ...jest.requireActual('@/constants/chat/common'),
  getSelectedConversation: jest.fn(),
  isSplit: false,
}))

import * as Common from '@/constants/chat/common'
import {installFakeNavigator, makeRootState, restoreNavigator, type FakeNavigator} from '@/test/fake-navigator'
import {conversationGone, maybeChangeSelectedConversation} from './selection'
import * as Meta from '@/constants/chat/meta'
import RPCError from '@/util/rpcerror'
import {loadConversationThreadMessages} from '@/chat/conversation/thread-load'
import type {ConversationThreadActions, ConversationThreadState} from '@/chat/conversation/thread-context'
import {metasReceived} from './metadata-store'
import {installFakeChatRpc, restoreChatRpc} from '@/test/fake-chat-rpc'

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

// A phone has no auto-selection: the service naming the thread it has open (it names whatever it
// last loaded) or the thread being gone leaves the thread where the user put it.
test('a reselect naming the open thread on a phone leaves it open', () => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  mockedSelected.mockReturnValue(open)

  maybeChangeSelectedConversation(layout({newConvID, oldConvID: open}))

  runDeferredNavigation()
  expect(nav.actions).toEqual([])
})

test('the open thread being gone on a phone leaves it open', () => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  mockedSelected.mockReturnValue(open)

  conversationGone(open, 'left')

  runDeferredNavigation()
  expect(nav.actions).toEqual([])
})

// Kicked from the team, removed from the conversation, or never in it: a phone's open thread stays
// where the user put it and shows what the load could not do.
test.each([
  ['kicked from its team', T.RPCGen.StatusCode.scchatnotinteam, 'active'],
  ['removed from it', T.RPCGen.StatusCode.scchatnotinconv, 'active'],
  ['never in it', T.RPCGen.StatusCode.scchatnotinconv, 'notMember'],
] as const)('a thread load that says the user is not in it, %s, leaves a phone thread open', async (_, code, membershipType) => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  mockedSelected.mockReturnValue(open)
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: open, membershipType}])
  const rpc = installFakeChatRpc()
  rpc.fail('loadThread', new RPCError('not in it', code))
  const actions = {
    claimWindowGate: () => {},
    clearWindowGate: () => {},
    getSnapshot: () => ({clearVersion: 0, liveUpdateVersion: 0, loaded: false}) as ConversationThreadState,
  } as unknown as ConversationThreadActions

  loadConversationThreadMessages(open, {reason: 'focused'}, actions)
  for (let i = 0; i < 20; i++) {
    await Promise.resolve()
  }
  runDeferredNavigation()
  restoreChatRpc()

  expect(nav.actions).toEqual([])
})
