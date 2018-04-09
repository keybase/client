// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import {chatTab} from '../tabs'
import type {TypedState} from '../reducer'
import {getPath} from '../../route-tree'
import {isMobile} from '../platform'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  editingMap: I.Map(),
  inboxFilter: '',
  loadingMap: I.Map(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  pendingConversationUsers: I.Set(),
  pendingMode: 'none',
  pendingOutboxToOrdinal: I.Map(),
  pendingSelected: false,
  pendingStatus: 'none',
  quotedMessage: null,
  selectedConversation: Types.stringToConversationIDKey(''),
  typingMap: I.Map(),
  unreadMap: I.Map(),
})

export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.SortedSet())
export const getMessageMap = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageMap.get(id, I.Map())
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation
export const getEditingOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.editingMap.get(id)
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

export {
  findConversationFromParticipants,
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
  isSpecialMention,
  makeMessageAttachment,
  makeMessageDeleted,
  makePendingAttachmentMessage,
  makePendingTextMessage,
  pathToAttachmentType,
  rpcErrorToString,
  uiMessageEditToMessage,
  uiMessageToMessage,
  upgradeMessage,
} from './message'
