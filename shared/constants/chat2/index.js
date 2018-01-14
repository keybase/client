// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import type {TypedState} from '../reducer'
import {makeConversationMeta} from './meta'

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Types.ConversationIDKey =>
  Types.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Types.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(Types.conversationIDKeyToString(key), 'hex')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  editingMap: I.Map(),
  inboxFilter: '',
  isSearching: false,
  loadingMap: I.Map(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  pendingOutboxToOrdinal: I.Map(),
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
  makeMessageDeleted,
  uiMessageToMessage,
  isOldestOrdinal,
  makePendingTextMessage,
  getClientPrev,
} from './message'
