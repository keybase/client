/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {useConfigState} from '@/stores/config'

jest.mock('@/constants/router', () => ({
  getModalStack: jest.fn(() => []),
  getVisibleScreen: jest.fn(() => undefined),
  navigateToInbox: jest.fn(),
  navigateToThread: jest.fn(),
}))

jest.mock('@/constants/chat/common', () => ({
  ...jest.requireActual('@/constants/chat/common'),
  getSelectedConversation: jest.fn(),
}))

import * as Common from '@/constants/chat/common'
import {navigateToInbox, navigateToThread} from '@/constants/router'
import {maybeChangeSelectedConversation} from './metadata'

const newConvID = 'ff00ff00'
const mockedSelected = Common.getSelectedConversation as jest.Mock

const layout = (over: Partial<T.RPCChat.UIInboxReselectInfo>): T.RPCChat.UIInboxLayout =>
  ({reselectInfo: {oldConvID: '', ...over}}) as T.RPCChat.UIInboxLayout

beforeEach(() => {
  useConfigState.setState({loggedIn: true})
  global.isMobile = true
})

afterEach(() => {
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

  expect(navigateToInbox).not.toHaveBeenCalled()
  expect(navigateToThread).not.toHaveBeenCalled()
})

test('a reselect while the create error screen is up does not pop to the inbox', () => {
  mockedSelected.mockReturnValue(T.Chat.pendingErrorConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  expect(navigateToInbox).not.toHaveBeenCalled()
})

// the real "we are on a dead conversation" case still has to bounce
test('a reselect with nothing selected still goes to the inbox on mobile', () => {
  mockedSelected.mockReturnValue(T.Chat.noConversationIDKey)

  maybeChangeSelectedConversation(layout({newConvID}))

  expect(navigateToInbox).toHaveBeenCalledWith(false)
})
