/** @jest-environment jsdom */
/// <reference types="jest" />
import {cleanup, render, renderHook, screen} from '@testing-library/react'
import * as Message from '@/constants/chat/message'
import * as Meta from '@/constants/chat/meta'
import * as T from '@/constants/types'
import HiddenString from '@/util/hidden-string'
import PinnedMessage, {usePinnedMessageShown} from './pinned-message'

const mockConvID = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))

let mockThreadSearch: {query?: string} | undefined
const mockMeta: T.Chat.ConversationMeta = {
  ...Meta.makeConversationMeta(),
  conversationIDKey: mockConvID,
  pinnedMsg: {
    message: Message.makeMessageText({
      author: 'testuser',
      conversationIDKey: mockConvID,
      id: T.Chat.numberToMessageID(10),
      ordinal: T.Chat.numberToOrdinal(10),
      decoratedText: new HiddenString('the pinned text'),
      text: new HiddenString('the pinned text'),
    }),
    pinnerUsername: 'testuser',
  },
}

jest.mock('./thread-context', () => ({
  useConversationThreadID: () => mockConvID,
  useThreadMeta: (selector: (meta: T.Chat.ConversationMeta) => unknown) => selector(mockMeta),
}))
jest.mock('./team-hooks', () => ({
  useChatTeam: () => ({yourOperations: {}}),
}))
jest.mock('./center-context', () => ({
  useConversationCenterActions: () => ({centerOnMessage: () => {}}),
}))
jest.mock('./thread-search-route', () => ({
  useThreadSearchRoute: () => mockThreadSearch,
}))

afterEach(() => {
  cleanup()
  mockThreadSearch = undefined
})

test('the pinned banner renders the pinned message', () => {
  render(<PinnedMessage />)
  expect(screen.queryByText('Pinned')).not.toBeNull()
})

// both layouts mount the banner only when this says so
test('the pinned banner is shown while thread search is closed', () => {
  expect(renderHook(() => usePinnedMessageShown()).result.current).toBe(true)
})

test('the pinned banner is not shown while thread search is open', () => {
  mockThreadSearch = {}
  expect(renderHook(() => usePinnedMessageShown()).result.current).toBe(false)
})
