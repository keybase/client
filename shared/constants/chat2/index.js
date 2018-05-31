// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Constants from '../../constants/chat2'
import * as RPCTypes from '../../constants/types/rpc-gen'
import {chatTab} from '../tabs'
import type {TypedState} from '../reducer'
import {getPath} from '../../route-tree'
import {isMobile} from '../platform'
import {
  pendingConversationIDKey,
  noConversationIDKey,
  pendingWaitingConversationIDKey,
} from '../types/chat2/common'
import {makeConversationMeta, getMeta} from './meta'
import {formatTextForQuoting} from '../../util/chat'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  editingMap: I.Map(),
  explodingModes: I.Map(),
  inboxFilter: '',
  isExplodingNew: true,
  loadingMap: I.Map(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map([
    [pendingConversationIDKey, makeConversationMeta({conversationIDKey: noConversationIDKey})],
  ]),
  pendingMode: 'none',
  pendingOutboxToOrdinal: I.Map(),
  quote: null,
  selectedConversation: noConversationIDKey,
  typingMap: I.Map(),
  unreadMap: I.Map(),
})

// We stash the resolved pending conversation idkey into the meta itself
export const getResolvedPendingConversationIDKey = (state: TypedState) =>
  getMeta(state, pendingConversationIDKey).conversationIDKey
export const isValidConversationIDKey = (id: Types.ConversationIDKey) =>
  id &&
  id !== pendingConversationIDKey &&
  id !== noConversationIDKey &&
  id !== pendingWaitingConversationIDKey

export const makeQuoteInfo: I.RecordFactory<Types._QuoteInfo> = I.Record({
  counter: 0,
  ordinal: Types.numberToOrdinal(0),
  sourceConversationIDKey: Constants.noConversationIDKey,
  targetConversationIDKey: Constants.noConversationIDKey,
})

export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.SortedSet())
export const getMessage = (state: TypedState, id: Types.ConversationIDKey, ordinal: Types.Ordinal) =>
  state.chat2.messageMap.getIn([id, ordinal])
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation

export const getEditInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const ordinal = state.chat2.editingMap.get(id)
  if (!ordinal) {
    return null
  }

  const message = getMessage(state, id, ordinal)
  if (!message || message.type !== 'text') {
    return null
  }

  return {text: message.text.stringValue(), ordinal}
}

export const getQuoteInfo = (state: TypedState, id: Types.ConversationIDKey) => {
  const quote = state.chat2.quote
  // Return null if we're not on the target conversation.
  if (!quote || quote.targetConversationIDKey !== id) {
    return null
  }

  const message = getMessage(state, quote.sourceConversationIDKey, quote.ordinal)
  if (!message || message.type !== 'text') {
    return null
  }

  return {counter: quote.counter, text: formatTextForQuoting(message.text.stringValue())}
}

export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id, I.Set())
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const isUserActivelyLookingAtThisThread = (
  state: TypedState,
  conversationIDKey: Types.ConversationIDKey
) => {
  const selectedConversationIDKey = getSelectedConversation(state)
  const appFocused = state.config.appFocused
  const routePath = getPath(state.routeTree.routeState)
  let chatThreadSelected = false
  if (isMobile) {
    chatThreadSelected =
      routePath.size === 2 && routePath.get(0) === chatTab && routePath.get(1) === 'conversation'
  } else {
    chatThreadSelected = routePath.size >= 1 && routePath.get(0) === chatTab
  }

  return (
    appFocused && // app focused?
    chatThreadSelected && // looking at the chat tab?
    conversationIDKey === selectedConversationIDKey // looking at the selected thread?
  )
}
export const isInfoPanelOpen = (state: TypedState) => {
  const routePath = getPath(state.routeTree.routeState, [chatTab])
  return routePath.size === 3 && routePath.get(2) === 'infoPanel'
}

export const creatingLoadingKey = 'creatingConvo'

// When we see that exploding messages are in the app, we set
// seenExplodingGregorKey as well as newExplodingGregorKey.
// newExploding.. is set with a dtime of a couple days.
// seenExploding.. never expires.
// 1. Neither exist: new and user hasn't seen them
// 2. Both exist: new and user has seen them
// 3. One exists (seenExploding...): old; unset tag
export const seenExplodingGregorKey = 'hasSeenExplodingMessages'
export const newExplodingGregorKey = 'explodingMessagesAreNew'
export const getIsExplodingNew = (state: TypedState) => state.chat2.get('isExplodingNew')
export const explodingModeGregorKeyPrefix = 'exploding:'
/**
 * Gregor key for exploding conversations
 * Used as the `category` when setting the exploding mode on a conversation
 * `body` is the number of seconds to exploding message etime
 */
export const explodingModeGregorKey = (c: Types.ConversationIDKey): string =>
  `${explodingModeGregorKeyPrefix}${c}`
export const getConversationExplodingMode = (state: TypedState, c: Types.ConversationIDKey) =>
  state.chat2.getIn(['explodingModes', c], 0)

export const makeInboxQuery = (
  convIDKeys: Array<Types.ConversationIDKey>
): RPCChatTypes.GetInboxLocalQuery => {
  return {
    convIDs: convIDKeys.map(Types.keyToConversationID),
    computeActiveList: true,
    readOnly: false,
    status: Object.keys(RPCChatTypes.commonConversationStatus)
      .filter(k => !['ignored', 'blocked', 'reported'].includes(k))
      .map(k => RPCChatTypes.commonConversationStatus[k]),
    tlfVisibility: RPCTypes.commonTLFVisibility.private,
    topicType: RPCChatTypes.commonTopicType.chat,
    unreadOnly: false,
  }
}

export {
  getConversationIDKeyMetasToLoad,
  getMeta,
  getRowParticipants,
  getRowStyles,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
  updateMetaWithNotificationSettings,
} from './meta'

export {
  getClientPrev,
  getMessageID,
  isSpecialMention,
  makeMessageAttachment,
  makeMessageDeleted,
  makeMessageText,
  makePendingAttachmentMessage,
  makePendingTextMessage,
  messageExplodeDescriptions,
  pathToAttachmentType,
  rpcErrorToString,
  uiMessageEditToMessage,
  uiMessageToMessage,
  upgradeMessage,
} from './message'

export {pendingConversationIDKey, noConversationIDKey, pendingWaitingConversationIDKey}
