// The GUI owns which conversation is selected. The service's idea of it is only the conversation
// it last loaded a thread for, which any popup, picker or preview also moves, and which outlives an
// account switch, so its layout's reselectInfo is a hint, not an instruction.
//
// A selection moves on its own only when it is gone: the user left it or was removed or reset,
// its thread load says the user is no longer in it, its meta says so, or a layout names it while
// this account cannot open it (see replaceable). An empty selection is filled by any reselect.
// Every one of those moves a split layout (desktop, tablet) to the newest conversation. Phones have no selection to move:
// their open thread stays where the user put it.
import * as Common from '@/constants/chat/common'
import * as T from '@/constants/types'
import {navigateToInbox, navigateToThread} from '@/constants/router'
import logger from '@/logger'
import {useCurrentUserState} from '@/stores/current-user'
import {getBigLayoutChannelRow, getSmallLayoutRow, useInboxLayoutState} from './layout-state'
import {setConversationLeftListener, useInboxMetadataState} from './metadata-store'

// The layout's first small-team row, as the service picks for reselectInfo, skipping the
// conversation that is gone. An inbox with no other small-team row takes its first big-team channel:
// channel rows carry no time, so the layout's order is the only one there is.
const newestOtherThan = (gone: T.Chat.ConversationIDKey) => {
  const layout = useInboxLayoutState.getState().layout
  const small = (layout?.smallTeams ?? []).map(row => row.convID)
  const channels = (layout?.bigTeams ?? []).flatMap(row =>
    row.state === T.RPCChat.UIInboxBigTeamRowTyp.channel ? [row.channel.convID] : []
  )
  return (
    [...small, ...channels].map(id => T.Chat.stringToConversationIDKey(id)).find(id => id !== gone) ??
    T.Chat.noConversationIDKey
  )
}

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

// The conversation selected when the signed-in account last changed. A split layout keeps it
// selected through the switch, but it is the previous account's.
let previousAccountSelection = T.Chat.noConversationIDKey

// App init starts it; the returned function stops it. It records the selection each time an
// account signs out or is switched away from, and moves a selection whose meta turns from a
// member's to a left or removed one.
export const watchChatSelection = () => {
  const stopAccount = useCurrentUserState.subscribe((s, prev) => {
    if (prev.uid && s.uid !== prev.uid) {
      previousAccountSelection = Common.getSelectedConversation()
    }
  })
  setConversationLeftListener(id => conversationGone(id, 'meta says you left'))
  return () => {
    stopAccount()
    setConversationLeftListener()
  }
}

// Whether a reselect may replace this selection: the user left it or was removed (its meta says
// so), this account could not load it (an error meta, and the inbox does not list it), or it is the
// previous account's, unknown here. A conversation this account knows nothing about yet (a channel
// preview, one opened from a link still loading) is not grounds: its meta is on its way.
const replaceable = (id: T.Chat.ConversationIDKey) => {
  const meta = useInboxMetadataState.getState().metas.get(id)
  if (meta?.membershipType === 'youLeft') {
    return true
  }
  const layoutState = useInboxLayoutState.getState()
  if (getSmallLayoutRow(layoutState, id) || getBigLayoutChannelRow(layoutState, id)) {
    return false
  }
  if (meta) {
    return meta.trustedState === 'error'
  }
  return id === previousAccountSelection
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

  if (!T.Chat.isValidConversationIDKey(selected)) {
    moveSelectionOff(selected, 'reselect with nothing selected')
    return
  }
  // The service names whatever it last loaded, which a popup or a picker can have moved, so a
  // reselect speaks only about the selection it names.
  if (!oldConvID || T.Chat.stringToConversationIDKey(oldConvID) !== selected || !replaceable(selected)) {
    return
  }
  moveSelectionOff(selected, `reselect named ${oldConvID}, which is gone from this account`)
}
