/// <reference types="jest" />
import * as T from '@/constants/types'
import {resetAllStores} from '@/util/zustand'
import {getInboxBadge, syncInboxBadgeState, useInboxBadgeState} from './badge-state'

const convA = T.Chat.conversationIDToKey(new Uint8Array([1, 2, 3, 4]))
const convB = T.Chat.conversationIDToKey(new Uint8Array([5, 6, 7, 8]))

afterEach(() => {
  resetAllStores()
})

test('syncInboxBadgeState applies badge and unread counts', () => {
  syncInboxBadgeState({
    conversations: [
      {badgeCount: 2, convID: T.Chat.keyToConversationID(convA), unreadMessages: 5},
      {badgeCount: 0, convID: T.Chat.keyToConversationID(convB), unreadMessages: 3},
    ],
  } as unknown as T.RPCGen.BadgeState)

  expect(getInboxBadge(convA)).toEqual({badgeCount: 2, unreadCount: 5})
  expect(getInboxBadge(convB)).toEqual({badgeCount: 0, unreadCount: 3})
  expect(useInboxBadgeState.getState().counts.get(convA)?.badgeCount).toBe(2)
})

test('conversations absent from a later sync are zeroed (full-replace)', () => {
  syncInboxBadgeState({
    conversations: [
      {badgeCount: 2, convID: T.Chat.keyToConversationID(convA), unreadMessages: 5},
      {badgeCount: 1, convID: T.Chat.keyToConversationID(convB), unreadMessages: 1},
    ],
  } as unknown as T.RPCGen.BadgeState)

  syncInboxBadgeState({
    conversations: [{badgeCount: 4, convID: T.Chat.keyToConversationID(convA), unreadMessages: 9}],
  } as unknown as T.RPCGen.BadgeState)

  expect(getInboxBadge(convA)).toEqual({badgeCount: 4, unreadCount: 9})
  // convB dropped from payload, so it has no entry and reads as the {0,0} default
  expect(useInboxBadgeState.getState().counts.has(convB)).toBe(false)
  expect(getInboxBadge(convB)).toEqual({badgeCount: 0, unreadCount: 0})
})

test('getInboxBadge defaults to zeroes for an unknown conversation', () => {
  expect(getInboxBadge(convA)).toEqual({badgeCount: 0, unreadCount: 0})
})
