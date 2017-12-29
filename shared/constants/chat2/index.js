// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
import type {TypedState} from '../reducer'

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Types.ConversationIDKey =>
  conversationID.toString('hex')

export const keyToConversationID = (key: Types.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(key, 'hex')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  inboxFilter: '',
  isSearching: false,
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  selectedConversation: null,
  unreadMap: I.Map(),
})

export const getMeta = (state: TypedState, id: Types.ConversationIDKey) => state.chat2.metaMap.get(id)
export const getHasBadge = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.badgeMap.get(id, 0) > 0
export const getHasUnread = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.unreadMap.get(id, 0) > 0
export const getIsSelected = (state: TypedState, id: Types.ConversationIDKey) =>
  state.chat2.selectedConversation === id

export {
  getRowColors,
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
