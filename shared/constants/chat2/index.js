// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/rpc-chat-gen'
import * as Types from '../types/chat2'
// import type {TypedState} from '../reducer'

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Types.ConversationIDKey =>
  conversationID.toString('hex')

export const keyToConversationID = (key: Types.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(key, 'hex')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  badgeMap: I.Map(),
  inboxFilter: '',
  messageMap: I.Map(),
  messageOrdinals: I.Map(),
  metaMap: I.Map(),
  unreadMap: I.Map(),
})

export {
  unverifiedInboxUIItemToConversationMeta,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
} from './meta'

export {uiMessageToMessage, getSnippet, makeMessageDeleted} from './message'
