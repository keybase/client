// @flow
import * as I from 'immutable'
import * as RPCChatTypes from '../types/flow-types-chat'
import * as Types from '../types/chat2'
// import type {TypedState} from '../reducer'

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Types.ConversationIDKey =>
  conversationID.toString('hex')

export const keyToConversationID = (key: Types.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(key, 'hex')

export const makeState: I.RecordFactory<Types._State> = I.Record({
  messageIDsList: I.Map(),
  messageMap: I.Map(),
  metaMap: I.Map(),
})

export {
  getSnippet,
  unverifiedInboxUIItemToConversationMeta,
  inboxUIItemToConversationMeta,
  makeConversationMeta,
} from './meta'
