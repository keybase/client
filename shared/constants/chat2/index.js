// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import type {TypedState} from '../reducer'
import {makeConversationMeta} from './meta'

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Types.ConversationIDKey =>
  conversationID.toString('hex')

export const keyToConversationID = (key: Types.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(key, 'hex')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  inboxFilter: '',
  isSearching: false,
  loadingSet: I.Set(),
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  selectedConversation: null,
  unreadMap: I.Map(),
})

const emptyMeta = makeConversationMeta()
export const getMeta = (state: TypedState, id: ?Types.ConversationIDKey) =>
  id ? state.chat2.metaMap.get(id, emptyMeta) : emptyMeta
export const getMessageOrdinals = (state: TypedState, id: ?Types.ConversationIDKey) =>
  (id && state.chat2.messageOrdinals.get(id)) || I.List()
export const getMessageMap = (state: TypedState, id: ?Types.ConversationIDKey) =>
  (id && state.chat2.messageMap.get(id)) || I.Map()
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getIsSelected = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.selectedConversation === id

export {
  getRowStyles,
  getRowParticipants,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
  unverifiedInboxUIItemToConversationMeta,
} from './meta'

export {
  getSnippetMessage,
  getSnippetText,
  getSnippetTimestamp,
  makeMessageDeleted,
  uiMessageToMessage,
} from './message'
