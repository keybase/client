// The GUI owns which conversation is selected. The service's idea of it is only the conversation
// it last loaded a thread for, which any popup, picker or preview also moves, and which outlives an
// account switch, so its layout's reselectInfo is a hint, not an instruction.
//
// A selection moves on its own only when it is gone: the user left it or was removed or reset,
// its thread load says the user is not in it, its meta says so, or a layout names it while
// nothing in this account knows it. Every one of those moves a split layout (desktop, tablet) to
// the newest conversation. Phones have no selection to move:
// their open thread stays where the user put it.
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import {navigateToInbox, navigateToThread} from '@/constants/router'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {getBigLayoutChannelRow, getSmallLayoutRow, useInboxLayoutState} from './layout-state'
import {useInboxMetadataState} from './metadata-store'

// The layout's first row, as the service picks for reselectInfo, skipping the conversation that is gone.
const newestOtherThan = (gone: T.Chat.ConversationIDKey) =>
  useInboxLayoutState
    .getState()
    .layout?.smallTeams?.map(row => T.Chat.stringToConversationIDKey(row.convID))
    .find(id => id !== gone) ?? T.Chat.noConversationIDKey

const moveSelectionOff = (from: T.Chat.ConversationIDKey, why: string) => {
  const next = newestOtherThan(from)
  if (next === from) {
    return
  }
  logger.info(`chat selection: ${why}: ${from} -> ${next}`)
  navigateToThread(next, 'findNewestConversation')
}

export const conversationGone = (id: T.Chat.ConversationIDKey, why: string) => {
  if (!Common.isSplit || !T.Chat.isValidConversationIDKey(id) || Common.getSelectedConversation() !== id) {
    return
  }
  moveSelectionOff(id, why)
}

// A notification about the current user's membership; the service sends these to every client.
export const conversationGoneForUser = (uid: string, id: T.Chat.ConversationIDKey, why: string) => {
  if (uid !== useCurrentUserState.getState().uid) {
    return
  }
  conversationGone(id, why)
}

// Whether this account knows the conversation as one it can open: the inbox lists it, or it has
// the conversation's meta. A conversation left over from the previous account has neither, or only
// an error meta; one the user left says so in its meta.
const selectableHere = (id: T.Chat.ConversationIDKey) => {
  const meta = useInboxMetadataState.getState().metas.get(id)
  if (meta?.membershipType === 'youLeft') {
    return false
  }
  const layoutState = useInboxLayoutState.getState()
  if (getSmallLayoutRow(layoutState, id) || getBigLayoutChannelRow(layoutState, id)) {
    return true
  }
  return !!meta && meta.trustedState !== 'error'
}

export const maybeChangeSelectedConversation = (inboxLayout?: T.RPCChat.UIInboxLayout) => {
  const newConvID = inboxLayout?.reselectInfo?.newConvID
  const oldConvID = inboxLayout?.reselectInfo?.oldConvID
  if (!newConvID && !oldConvID) {
    return
  }

  const selected = Common.getSelectedConversation()

  // A pending placeholder means a conversation creation is in flight: that screen belongs to the
  // create flow, which replaces it with the real conv (or the error screen) when the RPC returns.
  // The service rebuilds the layout the moment the conv exists, and while it has never been told a
  // selected conv it tags every layout with reselectInfo.
  if (selected === T.Chat.pendingWaitingConversationIDKey || selected === T.Chat.pendingErrorConversationIDKey) {
    logger.info('maybeChangeSelectedConversation: creation in flight, ignoring reselect')
    return
  }

  if (!Common.isSplit) {
    // a phone's thread screen with no conversation on it goes back to the inbox
    if (!T.Chat.isValidConversationIDKey(selected)) {
      logger.info('maybeChangeSelectedConversation: no conversation selected, so go to inbox')
      navigateToInbox(false)
    }
    return
  }

  // a selection the user can see here stays, whatever the reselect names
  if (T.Chat.isValidConversationIDKey(selected) && selectableHere(selected)) {
    return
  }
  moveSelectionOff(selected, `reselect named ${oldConvID ?? ''}, selection empty or not in this account`)
}

// A meta that turns from a member's to a left or removed one, for the selected conversation.
useInboxMetadataState.subscribe((s, prev) => {
  if (s.metas === prev.metas || !Common.isSplit) {
    return
  }
  const selected = Common.getSelectedConversation()
  const meta = s.metas.get(selected)
  const before = prev.metas.get(selected)
  if (meta?.membershipType === 'youLeft' && before && before.membershipType !== 'youLeft') {
    conversationGone(selected, 'meta says you left')
  }
})
