import * as T from '@/constants/types'
import * as Z from '@/util/zustand'

export type BadgeCounts = {badgeCount: number; unreadCount: number}

type State = T.Immutable<{
  counts: Map<T.Chat.ConversationIDKey, BadgeCounts>
  dispatch: {
    resetState: () => void
  }
}>

export const useInboxBadgeState = Z.createZustand<State>('inboxBadge', () => ({
  counts: new Map(),
  dispatch: {resetState: Z.defaultReset},
}))

const emptyCounts: BadgeCounts = {badgeCount: 0, unreadCount: 0}

// Full-replace semantics: the map is rebuilt from the payload each sync, so a
// conversation absent from the payload gets no entry (reads default to {0,0}).
export const syncInboxBadgeState = (badgeState?: T.RPCGen.BadgeState) => {
  if (!badgeState) {
    return
  }
  const next = new Map<T.Chat.ConversationIDKey, BadgeCounts>()
  badgeState.conversations?.forEach(conversation => {
    const id = T.Chat.conversationIDToKey(conversation.convID)
    next.set(id, {badgeCount: conversation.badgeCount, unreadCount: conversation.unreadMessages})
  })
  useInboxBadgeState.setState(s => {
    s.counts = next
  })
}

export const getInboxBadge = (id: T.Chat.ConversationIDKey): BadgeCounts =>
  useInboxBadgeState.getState().counts.get(id) ?? emptyCounts
