/** @jest-environment jsdom */
/// <reference types="jest" />
// The chat tab's automatic selection on the split (desktop) layout, driven through the real config,
// current-user, inbox layout and metadata stores, the real chat notification path and the real
// thread load against a fake service. The GUI owns the selection: the split shell fills an empty
// one, a layout's reselectInfo replaces only a selection that is empty or unknown to this account,
// and a selection that is gone (left, removed, reset, not in it, removed from the inbox) moves to
// the newest conversation. None of them may replace a conversation the user picked and can see.
jest.mock('@/chat/conversation/container', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/conversation/info-panel', () => ({__esModule: true, default: () => null}))

import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import RPCError from '@/util/rpcerror'
import {act, cleanup, render} from '@testing-library/react'
import {getSelectedConversation} from '@/constants/chat/common'
import {navigateToThread} from '@/constants/router'
import {InboxAndConversationShell} from '@/chat/inbox-and-conversation-shared'
import {routeChatNotification, type ChatNotification} from '@/chat/notification-router'
import {loadConversationThreadMessages} from '@/chat/conversation/thread-load'
import type {ConversationThreadActions, ConversationThreadState} from '@/chat/conversation/thread-context'
import {useInboxLayoutState} from './layout-state'
import {watchChatSelection} from './selection'
import {metasReceived} from './metadata-store'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeNavigator, restoreNavigator} from '@/test/fake-navigator'
import {getChatRpc} from '@/chat/conversation/chat-rpc'
import {installFakeChatRpc, restoreChatRpc, type FakeChatRpc} from '@/test/fake-chat-rpc'
import {flush} from '@/test/flush'

const convKey = (n: number) => T.Chat.stringToConversationIDKey(`0000${n}`.padEnd(64, `${n}`))
// the new account's inbox, newest first
const newest = convKey(1)
const picked = convKey(2)
const inbox = [newest, picked, convKey(3)]
// the conversation the previous account had open
const previousAccountConv = convKey(9)

// The service side of the layout, as chat/uiinboxloader.go builds it: the service remembers the
// conversation the UI last loaded, and a layout carries reselectInfo when that conversation is not
// in the inbox snapshot it built from, or when the request asked for a forced reselect. A snapshot
// can be partial, so it can leave out a conversation the user can see.
const service = {
  lastLoaded: '' as string,
  requested: [] as Array<T.RPCChat.InboxLayoutReselectMode>,
}

const deliverLayout = (
  reselectMode: T.RPCChat.InboxLayoutReselectMode,
  snapshot: ReadonlyArray<T.Chat.ConversationIDKey> = inbox
) => {
  const reselect =
    !snapshot.includes(service.lastLoaded) || reselectMode === T.RPCChat.InboxLayoutReselectMode.force
  const layout: T.RPCChat.UIInboxLayout = {
    bigTeams: [],
    reselectInfo: reselect ? {newConvID: snapshot[0], oldConvID: service.lastLoaded} : undefined,
    smallTeams: snapshot.map(convID => ({convID}) as T.RPCChat.UIInboxSmallTeamRow),
    totalSmallTeams: snapshot.length,
  }
  notify('chat.1.chatUi.chatInboxLayout', {layout: JSON.stringify(layout)})
}

const notify = (type: ChatNotification['type'], params: object) =>
  act(() => {
    routeChatNotification({payload: {params}, type} as ChatNotification)
  })

// a meta as the service's inbox would send it; a later inbox version replaces an earlier one
const meta = (
  id: T.Chat.ConversationIDKey,
  membershipType: T.Chat.MembershipType,
  inboxVersion = 1,
  trustedState: T.Chat.MetaTrustedState = 'trusted'
) =>
  act(() => {
    metasReceived([{...Meta.makeConversationMeta(), conversationIDKey: id, inboxVersion, membershipType, trustedState}])
  })

// The layout a refresh asked for arrives only after the service's batch delay, so the user can pick
// a conversation in between.
const deliverRequestedLayout = () => {
  const mode = service.requested.shift()
  if (mode === undefined) throw new Error('no layout was requested')
  deliverLayout(mode)
}

const open = (id: T.Chat.ConversationIDKey, reason: Parameters<typeof navigateToThread>[1]) =>
  act(() => navigateToThread(id, reason))

let rerenderShell: () => void
let chatRpc: FakeChatRpc

// The chat tab as the new account's navigator mounts it: the shell reads its selection from the
// chat root's params, as the route does.
const mountShell = () => {
  const shell = () => (
    <InboxAndConversationShell conversationIDKey={getSelectedConversation()} leftPane={null} />
  )
  const {rerender} = render(shell())
  rerenderShell = () => rerender(shell())
}

const selected = () => getSelectedConversation()

// After each step the shell reruns with the chat root's new params, as the route would, and the
// selected conversation's thread loads, which the service records as the one last loaded.
const step = (fn: () => void) => {
  fn()
  rerenderShell()
  if (T.Chat.isValidConversationIDKey(selected())) {
    service.lastLoaded = selected()
  }
}

// setUserSwitching resets every store, including the inbox layout; the navigator remounts for the
// new account, so the chat root starts with nothing selected. The service still remembers the
// previous account's last-loaded conversation. keptSelected: the previous account's selection,
// which a split layout keeps selected through the switch.
const switchAccount = (keptSelected?: T.Chat.ConversationIDKey) => {
  if (keptSelected) {
    installFakeNavigator()
    open(keptSelected, 'misc')
  }
  act(() => {
    useConfigState.getState().dispatch.setUserSwitching(true, 'testuser-mac')
  })
  act(() => {
    useCurrentUserState
      .getState()
      .dispatch.setBootstrap({deviceID: 'device-id', deviceName: 'test-device', uid: 'uid-2', username: 'testuser-mac'})
    useConfigState.getState().dispatch.setLoggedIn(true)
    useConfigState.getState().dispatch.setUserSwitching(false)
  })
  installFakeNavigator()
  chatRpc = installFakeChatRpc()
  service.lastLoaded = previousAccountConv
  if (keptSelected) {
    open(keptSelected, 'misc')
  }
  mountShell()
  // the inbox asks for its first layout as soon as it mounts for the new account
  act(() => {
    void useInboxLayoutState.getState().dispatch.refresh('componentNeverLoaded')
  })
}

let stopWatchingAccount: () => void

beforeEach(() => {
  // as app init starts it
  stopWatchingAccount = watchChatSelection()
  service.lastLoaded = ''
  service.requested = []
  jest.spyOn(T.RPCChat, 'localRequestInboxLayoutRpcPromise').mockImplementation(async ({reselectMode}) => {
    service.requested.push(reselectMode)
    return Promise.resolve()
  })
  useCurrentUserState
    .getState()
    .dispatch.setBootstrap({deviceID: 'device-id', deviceName: 'test-device', uid: 'uid-1', username: 'testuser'})
  useConfigState.setState({loggedIn: true})
})

afterEach(() => {
  stopWatchingAccount()
  cleanup()
  restoreNavigator()
  restoreChatRpc()
  jest.restoreAllMocks()
  resetAllStores()
})

test('after a switch, the newest conversation fills the empty selection', () => {
  switchAccount()
  expect(selected()).toBe(T.Chat.noConversationIDKey)

  // the service pushes the new account's layout on its own right after login
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))

  expect(selected()).toBe(newest)
})

test('a conversation picked right after a switch stays selected when later layouts arrive', () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  expect(selected()).toBe(newest)

  step(() => open(picked, 'inboxSmall'))
  expect(selected()).toBe(picked)

  // the layout the inbox asked for when it mounted, arriving after the batch delay
  step(deliverRequestedLayout)
  expect(selected()).toBe(picked)

  // and any layout after that
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  expect(selected()).toBe(picked)
})

test("a selection left over from the previous account is replaced by the new account's newest", () => {
  switchAccount(previousAccountConv)
  expect(selected()).toBe(previousAccountConv)

  step(deliverRequestedLayout)

  expect(selected()).toBe(newest)
})

test('a leftover selection whose only meta is an error is replaced', () => {
  switchAccount()
  step(() => open(previousAccountConv, 'misc'))
  // the new account's service could not load it
  meta(previousAccountConv, 'active', 1, 'error')

  step(deliverRequestedLayout)

  expect(selected()).toBe(newest)
})

// the new account, with its layout loaded and a conversation the user picked (its row's meta loaded)
const pickAfterSwitch = () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  inbox.forEach(id => meta(id, 'active'))
  step(() => open(picked, 'inboxSmall'))
  expect(selected()).toBe(picked)
}

test("a picked conversation the service's snapshot leaves out stays selected when a layout names it", () => {
  pickAfterSwitch()

  // a partial snapshot: the service names the picked conversation as one to replace
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default, [newest, convKey(3)]))

  expect(selected()).toBe(picked)
})

test('a conversation still loading, or a channel preview, stays selected when a layout names it', () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  // opened from a link or search: not in the inbox, and its meta has not arrived
  const preview = convKey(7)
  step(() => open(preview, 'previewResolved'))
  expect(selected()).toBe(preview)

  // the service last loaded it, and it is in no inbox snapshot
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  expect(selected()).toBe(preview)

  // nor does its preview meta, for a conversation the user never joined
  meta(preview, 'youArePreviewing')
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  expect(selected()).toBe(preview)
})

test('a reselect naming another conversation leaves the selection alone, even one this account cannot load', () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  const unloadable = convKey(7)
  step(() => open(unloadable, 'previewResolved'))
  meta(unloadable, 'active', 1, 'error')
  // a popup loaded another conversation the inbox does not list
  service.lastLoaded = convKey(8)

  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))

  expect(selected()).toBe(unloadable)
})

test('a layout naming a conversation a popup loaded leaves a picked conversation selected', () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  // picked from its row before its meta has loaded
  step(() => open(picked, 'inboxSmall'))
  // a popup (a forward, the emoji picker) loaded a conversation the inbox does not list
  service.lastLoaded = convKey(8)

  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))

  expect(selected()).toBe(picked)
})

test('leaving the selected conversation moves the selection to the newest other one', () => {
  pickAfterSwitch()

  // another account's notification, and one about a conversation not selected, change nothing
  step(() => notify('chat.1.NotifyChat.ChatLeftConversation', {convID: T.Chat.keyToConversationID(newest), uid: 'uid-2'}))
  step(() => notify('chat.1.NotifyChat.ChatLeftConversation', {convID: T.Chat.keyToConversationID(picked), uid: 'uid-1'}))
  expect(selected()).toBe(picked)

  step(() => notify('chat.1.NotifyChat.ChatLeftConversation', {convID: T.Chat.keyToConversationID(picked), uid: 'uid-2'}))

  expect(selected()).toBe(newest)
})

test('being reset out of the selected conversation moves the selection past it', () => {
  pickAfterSwitch()
  step(() => open(newest, 'inboxSmall'))

  step(() => notify('chat.1.NotifyChat.ChatResetConversation', {convID: T.Chat.keyToConversationID(newest), uid: 'uid-2'}))

  // the newest row is the one that is gone, so the next one
  expect(selected()).toBe(picked)
})

test("a thread load that says the user is not in the conversation moves the selection", async () => {
  pickAfterSwitch()
  chatRpc.fail('loadThread', new RPCError('not in conv', T.RPCGen.StatusCode.scchatnotinconv))
  const actions = {
    claimWindowGate: () => {},
    clearWindowGate: () => {},
    getSnapshot: () => ({clearVersion: 0, liveUpdateVersion: 0, loaded: false}) as ConversationThreadState,
    rpc: getChatRpc(),
  } as unknown as ConversationThreadActions

  loadConversationThreadMessages(picked, {reason: 'focused'}, actions)
  await flush()
  rerenderShell()

  expect(selected()).toBe(newest)
})

test('a thread load that says the user was never in the conversation leaves it selected', async () => {
  pickAfterSwitch()
  // opened from a link or search: a conversation this account never joined
  const stranger = convKey(7)
  step(() => open(stranger, 'previewResolved'))
  meta(stranger, 'notMember')
  chatRpc.fail('loadThread', new RPCError('not in conv', T.RPCGen.StatusCode.scchatnotinconv))
  const actions = {
    claimWindowGate: () => {},
    clearWindowGate: () => {},
    getSnapshot: () => ({clearVersion: 0, liveUpdateVersion: 0, loaded: false}) as ConversationThreadState,
    rpc: getChatRpc(),
  } as unknown as ConversationThreadActions

  loadConversationThreadMessages(stranger, {reason: 'focused'}, actions)
  await flush()
  rerenderShell()

  expect(selected()).toBe(stranger)
})

test('a layout naming a selected conversation the user has left moves the selection', () => {
  switchAccount()
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default))
  step(() => open(picked, 'inboxSmall'))
  // its first meta already says so, as for a left channel reopened from a link
  meta(picked, 'youLeft')
  expect(selected()).toBe(picked)

  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default, [newest, convKey(3)]))

  expect(selected()).toBe(newest)
})

test("the selected conversation's meta turning to left moves the selection", () => {
  pickAfterSwitch()

  step(() => meta(picked, 'youLeft', 2))

  expect(selected()).toBe(newest)
})

test('an inbox sync that removes the selected conversation moves the selection', () => {
  pickAfterSwitch()

  step(() =>
    notify('chat.1.NotifyChat.ChatInboxSynced', {
      syncRes: {
        incremental: {items: [], removals: [T.Chat.conversationIDKeyToString(picked)]},
        syncType: T.RPCChat.SyncInboxResType.incremental,
      },
      uid: 'uid-2',
    })
  )

  expect(selected()).toBe(newest)
})

// A big-team-only inbox: no small-team rows, one team's channels.
const deliverBigTeamLayout = (channels: ReadonlyArray<T.Chat.ConversationIDKey>) => {
  const layout: T.RPCChat.UIInboxLayout = {
    bigTeams: [
      {label: {id: 'team-id', name: 'testteam'}, state: T.RPCChat.UIInboxBigTeamRowTyp.label},
      ...channels.map(convID => ({
        channel: {channelname: `channel-${convID}`, convID, isMuted: false, teamname: 'testteam'},
        state: T.RPCChat.UIInboxBigTeamRowTyp.channel as const,
      })),
    ],
    smallTeams: [],
    totalSmallTeams: 0,
  }
  notify('chat.1.chatUi.chatInboxLayout', {layout: JSON.stringify(layout)})
}

test('with only big-team channels, a gone selection moves to the first other channel', () => {
  switchAccount()
  const [general, random] = [convKey(5), convKey(6)]
  step(() => deliverBigTeamLayout([general, random]))
  meta(general, 'active')
  meta(random, 'active')
  step(() => open(general, 'inboxBig'))
  expect(selected()).toBe(general)

  step(() => notify('chat.1.NotifyChat.ChatLeftConversation', {convID: T.Chat.keyToConversationID(general), uid: 'uid-2'}))

  expect(selected()).toBe(random)
})

test('a layout arriving while a conversation is being created leaves the create flow alone', () => {
  pickAfterSwitch()
  const created = convKey(4)

  step(() => open(T.Chat.pendingWaitingConversationIDKey, 'justCreated'))
  // the service has never loaded the new conversation, so its layout names the old one
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default, [created, ...inbox]))
  expect(selected()).toBe(T.Chat.pendingWaitingConversationIDKey)

  // the create RPC returns and the flow opens the new conversation
  step(() => open(created, 'justCreated'))
  step(() => deliverLayout(T.RPCChat.InboxLayoutReselectMode.default, [created, ...inbox]))

  expect(selected()).toBe(created)
})
