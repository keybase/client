// @flow
import * as RPCChatTypes from '../rpc-chat-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'

export type PendingMode = 'none' | 'searchingForUsers' | 'fixedSetOfUsers'

export type _State = {
  badgeMap: I.Map<Common.ConversationIDKey, number>,
  beforeSearchSelectedConversation: ?Common.ConversationIDKey, // to reset after a search cancel
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>, // current message being edited
  inboxFilter: string,
  loadingMap: I.Map<string, number>, // reasons why we're loading
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>,
  messageOrdinals: I.Map<Common.ConversationIDKey, I.SortedSet<Message.Ordinal>>,
  metaMap: I.Map<Common.ConversationIDKey, Meta.ConversationMeta>,
  selectedConversation: Common.ConversationIDKey,
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>,
  unreadMap: I.Map<Common.ConversationIDKey, number>,
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>,
  pendingConversationUsers: I.Set<string>,
  pendingMode: PendingMode,
  pendingSelected: boolean,
}

export type State = I.RecordOf<_State>

export const conversationIDToKey = (conversationID: RPCChatTypes.ConversationID): Common.ConversationIDKey =>
  Common.stringToConversationIDKey(conversationID.toString('hex'))

export const keyToConversationID = (key: Common.ConversationIDKey): RPCChatTypes.ConversationID =>
  Buffer.from(Common.conversationIDKeyToString(key), 'hex')

export const rpcOutboxIDToOutboxID = (outboxID: RPCChatTypes.OutboxID): Message.OutboxID =>
  Message.stringToOutboxID(outboxID.toString('hex'))

export const outboxIDToRpcOutboxID = (outboxID: Message.OutboxID): RPCChatTypes.OutboxID =>
  Buffer.from(Message.outboxIDToString(outboxID), 'hex')

export type {ConversationMeta, MetaTrustedState} from './meta'
export type {
  Message,
  MessageAttachment,
  MessageSystemAddedToTeam,
  MessageSystemGitPush,
  MessageSystemInviteAccepted,
  MessageSystemJoined,
  MessageSystemLeft,
  MessageSystemText,
  MessageSystemSimpleToComplex,
  MessageText,
  Ordinal,
  OutboxID,
} from './message'
export type {ConversationIDKey} from './common'

export {
  outboxIDToString,
  stringToOutboxID,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
