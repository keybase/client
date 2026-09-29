/** @jest-environment jsdom */
/// <reference types="jest" />
// The chat tab's automatic "select the newest conversation" after an account switch, on the split
// (desktop) layout, driven through the real config, current-user and inbox layout stores and the
// real layout notification path. Two things select automatically: the split shell fills an empty
// selection from the layout, and a layout's reselectInfo replaces the selection the service says
// is gone. Neither may replace a conversation the user picked.
jest.mock('@/chat/conversation/container', () => ({__esModule: true, default: () => null}))
jest.mock('@/chat/conversation/info-panel', () => ({__esModule: true, default: () => null}))

import * as T from '@/constants/types'
import {act, cleanup, render} from '@testing-library/react'
import {getSelectedConversation} from '@/constants/chat/common'
import {navigateToThread} from '@/constants/router'
import {InboxAndConversationShell} from '@/chat/inbox-and-conversation-shared'
import {routeChatNotification, type ChatNotification} from '@/chat/notification-router'
import {useInboxLayoutState} from './layout-state'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {resetAllStores} from '@/util/zustand'
import {installFakeNavigator, restoreNavigator} from '@/test/fake-navigator'

const convKey = (n: number) => T.Chat.stringToConversationIDKey(`0000${n}`.padEnd(64, `${n}`))
// the new account's inbox, newest first
const newest = convKey(1)
const picked = convKey(2)
const inbox = [newest, picked, convKey(3)]
// the conversation the previous account had open
const previousAccountConv = convKey(9)

// The service side of the layout, as chat/uiinboxloader.go builds it: the service remembers the
// conversation the UI last loaded, and a layout carries reselectInfo when that conversation is not
// in the inbox, or when the request asked for a forced reselect.
const service = {
  lastLoaded: '' as string,
  requested: [] as Array<T.RPCChat.InboxLayoutReselectMode>,
}

const deliverLayout = (reselectMode: T.RPCChat.InboxLayoutReselectMode) => {
  const reselect =
    !inbox.includes(service.lastLoaded) || reselectMode === T.RPCChat.InboxLayoutReselectMode.force
  const layout: T.RPCChat.UIInboxLayout = {
    bigTeams: [],
    reselectInfo: reselect ? {newConvID: inbox[0], oldConvID: service.lastLoaded} : undefined,
    smallTeams: inbox.map(convID => ({convID}) as T.RPCChat.UIInboxSmallTeamRow),
    totalSmallTeams: inbox.length,
  }
  act(() => {
    routeChatNotification({
      payload: {params: {layout: JSON.stringify(layout)}},
      type: 'chat.1.chatUi.chatInboxLayout',
    } as ChatNotification)
  })
}

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
// previous account's last-loaded conversation.
const switchAccount = () => {
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
  service.lastLoaded = previousAccountConv
  mountShell()
  // the inbox asks for its first layout as soon as it mounts for the new account
  act(() => {
    void useInboxLayoutState.getState().dispatch.refresh('componentNeverLoaded')
  })
}

beforeEach(() => {
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
  cleanup()
  restoreNavigator()
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
  switchAccount()
  // something reopened the previous account's conversation on the new navigator
  step(() => open(previousAccountConv, 'misc'))
  expect(selected()).toBe(previousAccountConv)

  step(deliverRequestedLayout)

  expect(selected()).toBe(newest)
})
