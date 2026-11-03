/** @jest-environment jsdom */
/// <reference types="jest" />
import * as T from '@/constants/types'
import * as Tabs from '@/constants/tabs'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'

// a phone: no split layout, so threads open on their own screen. The layout is read from the
// platform when the module loads, before a test can say it is a phone.
jest.mock('@/constants/chat/layout', () => ({
  isSplit: false,
  threadRouteName: 'chatConversation',
}))

import * as Common from '@/constants/chat/common'
import {installNavigation, makeRootState, type InstalledNavigation} from '@/test/navigation'
import {conversationGone, maybeChangeSelectedConversation} from './selection'
import * as Meta from '@/constants/chat/meta'
import {loadConversationThreadMessages} from '@/chat/conversation/thread-load'
import type {ConversationThreadActions, ConversationThreadState} from '@/chat/conversation/thread-context'
import {metasReceived} from './metadata-store'
import {getChatRpc} from '@/chat/conversation/chat-rpc'
import {fakeError, installFakeEngine} from '@/test/fake-engine'
import {answerThreadLoads, getThreadNonblock, paramsOf} from '@/test/fake-thread-load'
import {setImmediate} from 'node:timers'
import {flushSync} from 'react-dom'
import {navigationRef} from '@/constants/navigator'

const newConvID = 'ff00ff00'
// test/flush's tick, without the @testing-library/react import that would make this an act environment
const tick = async () => new Promise<void>(resolve => setImmediate(resolve))

const layout = (over: Partial<T.RPCChat.UIInboxReselectInfo>): T.RPCChat.UIInboxLayout =>
  ({reselectInfo: {oldConvID: '', ...over}}) as T.RPCChat.UIInboxLayout

let nav: InstalledNavigation

// navigateToInbox defers a tick, so every assertion below has to let that tick run.
const runDeferredNavigation = () => jest.advanceTimersByTime(1)

const phoneTree = (rootState: ReturnType<typeof makeRootState>) => installNavigation({layout: 'phone', rootState})

// The phone thread screen sits in the root stack above the tab bar; tab is the one beneath it. The
// thread it shows is the selected conversation; a screen with none shows no conversation. It is
// opened from the tab, as the user does: a tree that starts with the tab already covered pauses the
// tab from its first render, so its navigator never reports which tab it is.
const threadOnTop = (tab: Tabs.AppTab = Tabs.chatTab, conversationIDKey?: T.Chat.ConversationIDKey) => {
  const tree = phoneTree(makeRootState({tab}))
  flushSync(() => {
    navigationRef.navigate('chatConversation', conversationIDKey ? {conversationIDKey} : {})
  })
  tree.clearActions()
  return tree
}

// Nothing was dispatched, and the tree still shows what it showed.
const expectLeftAlone = (screen: string) => {
  expect(nav.actions).toEqual([])
  expect(nav.visibleScreen()?.name).toBe(screen)
}

// Every test starts on the thread screen, the one screen the bounce may leave, so each guard
// below is what decides whether it runs.
beforeEach(() => {
  jest.useFakeTimers()
  nav = threadOnTop()
  useConfigState.setState({loggedIn: true})
  global.isMobile = true
})

afterEach(() => {
  nav.unmount()
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
  nav.unmount()
  nav = threadOnTop(Tabs.chatTab, T.Chat.pendingWaitingConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone(Common.threadRouteName)
})

test('a reselect while the create error screen is up does not pop to the inbox', () => {
  nav.unmount()
  nav = threadOnTop(Tabs.chatTab, T.Chat.pendingErrorConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone(Common.threadRouteName)
})

// the real "we are on a dead conversation" case still has to bounce
test('a reselect while a phone thread screen has no conversation goes to the inbox', () => {

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  // navigateToInbox(false): stay on the chat tab and pop its stack back to the inbox
  expect(nav.visibleScreen()?.name).toBe('chatRoot')
  expect(nav.getRootState()?.routes).toHaveLength(1)
})

// The bounce is navigateToInbox(false): a thread opened from another tab (here Teams) sits above
// that tab, and the bounce must not pull the user off it.
test('a reselect on a thread screen above another tab leaves that tab alone', () => {
  nav = threadOnTop(Tabs.teamsTab)

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone(Common.threadRouteName)
})

// The inbox is already where the bounce would go, and navigateToInbox focusing the chat stack
// pops every screen above the tabs, so it must not run for screens it does not own.
test('a reselect while the inbox is showing does not navigate', () => {
  nav = phoneTree(makeRootState())

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone('chatRoot')
})

// The share picker opens over the chat tab's inbox, where nothing is selected. Inbox layouts keep
// arriving while it is up and must not close it.
test('a reselect while the share picker is over the inbox leaves the picker up', () => {
  nav = phoneTree(makeRootState({above: [{name: 'incomingShareNew'}]}))

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone('incomingShareNew')
})

test('a reselect while a modal is over an empty thread screen leaves the modal up', () => {
  nav = phoneTree(makeRootState({above: [{name: Common.threadRouteName}, {name: 'incomingShareNew'}]}))

  maybeChangeSelectedConversation(layout({newConvID}))

  runDeferredNavigation()
  expectLeftAlone('incomingShareNew')
})

// A phone has no auto-selection: the service naming the thread it has open (it names whatever it
// last loaded) or the thread being gone leaves the thread where the user put it.
test('a reselect naming the open thread on a phone leaves it open', () => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  nav.unmount()
  nav = threadOnTop(Tabs.chatTab, open)

  maybeChangeSelectedConversation(layout({newConvID, oldConvID: open}))

  runDeferredNavigation()
  expectLeftAlone(Common.threadRouteName)
})

test('the open thread being gone on a phone leaves it open', () => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  nav.unmount()
  nav = threadOnTop(Tabs.chatTab, open)

  conversationGone(open, 'left')

  runDeferredNavigation()
  expectLeftAlone(Common.threadRouteName)
})

// Kicked from the team, removed from the conversation, or never in it: a phone's open thread stays
// where the user put it and shows what the load could not do.
test.each([
  ['kicked from its team', T.RPCGen.StatusCode.scchatnotinteam, 'active'],
  ['removed from it', T.RPCGen.StatusCode.scchatnotinconv, 'active'],
  ['never in it', T.RPCGen.StatusCode.scchatnotinconv, 'notMember'],
] as const)('a thread load that says the user is not in it, %s, leaves a phone thread open', async (_, code, membershipType) => {
  const open = T.Chat.stringToConversationIDKey('aa11aa11')
  nav.unmount()
  nav = threadOnTop(Tabs.chatTab, open)
  metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: open, membershipType}])
  const fake = installFakeEngine()
  answerThreadLoads(fake, () => fakeError(code, 'not in it'))
  // not being in it clears the persisted last route, so startup stops reopening it
  fake.answer('keybase.1.config.guiSetValue', () => {})
  const actions = {
    claimWindowGate: () => {},
    clearWindowGate: () => {},
    getSnapshot: () => ({clearVersion: 0, liveUpdateVersion: 0, loaded: false}) as ConversationThreadState,
    rpc: getChatRpc(),
  } as unknown as ConversationThreadActions

  loadConversationThreadMessages(open, {reason: 'focused'}, actions)
  // the call and its error each cross IPC, a turn each way
  for (let i = 0; i < 5; i++) {
    await tick()
  }
  runDeferredNavigation()

  expect(paramsOf(fake, getThreadNonblock)).toHaveLength(1)
  expect(paramsOf(fake, 'keybase.1.config.guiSetValue').map(p => p.path)).toEqual(['ui.routeState2'])
  expectLeftAlone(Common.threadRouteName)
})
