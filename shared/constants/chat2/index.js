// @flow
import * as I from 'immutable'
import * as Types from '../types/chat2'
import type {TypedState} from '../reducer'
import {makeConversationMeta} from './meta'

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  beforeSearchSelectedConversation: null,
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
  selectedConversation: Types.stringToConversationIDKey(''),
  typingMap: I.Map(),
  unreadMap: I.Map(),
})

const emptyMeta = makeConversationMeta()
export const getMeta = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.metaMap.get(id, emptyMeta)
export const getMessageOrdinals = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageOrdinals.get(id, I.SortedSet())
export const getMessageMap = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.messageMap.get(id, I.Map())
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getIsSelected = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.selectedConversation === id
export const getSelectedConversation = (state: TypedState) => state.chat2.selectedConversation
export const getEditingOrdinal = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.editingMap.get(id)
export const getTyping = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.typingMap.get(id, I.Set())
export const generateOutboxID = () => Buffer.from([...Array(8)].map(() => Math.floor(Math.random() * 256)))
export const getExistingConversationWithUsers = (
  users: I.Set<string>,
  you: string,
  metaMap: I.Map<Types.ConversationIDKey, Types.ConversationMeta>
) => {
  const toFind = I.Set(users.concat([you]))
  return metaMap.findKey(meta => meta.participants.toSet().equals(toFind)) || ''
}

export {
  getConversationIDKeyMetasToLoad,
  getRowParticipants,
  getRowStyles,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  timestampToString,
  unverifiedInboxUIItemToConversationMeta,
  updateMeta,
} from './meta'

export {
  getClientPrev,
  isOldestOrdinal,
  makeMessageAttachment,
  makeMessageDeleted,
  makePendingTextMessage,
  rpcErrorToString,
  uiMessageToMessage,
} from './message'
