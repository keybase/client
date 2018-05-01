// @flow
import * as RPCChatTypes from '../rpc-chat-gen'
import * as I from 'immutable'
import * as Common from './common'
import * as Meta from './meta'
import * as Message from './message'

export type PendingMode =
  | 'none' // no pending
  | 'searchingForUsers' // doing a search
  | 'fixedSetOfUsers' // selected a set of users externally
  | 'startingFromAReset' // fixedSet but our intention is to restart a reset conversation

export type PendingStatus =
  | 'none' // no pending
  | 'waiting' // attempting to create conversation
  | 'failed' // creating conversation failed

export type _quotedOrdConv = {
  ordinal: Message.Ordinal,
  sourceConversationIDKey: Common.ConversationIDKey,
}

export type _State = {
  badgeMap: I.Map<Common.ConversationIDKey, number>, // id to the badge count
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>, // current message being edited
  inboxFilter: string, // filters 'jump to chat'
  loadingMap: I.Map<string, number>, // reasons why we're loading
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>, // messages in a thread
  messageOrdinals: I.Map<Common.ConversationIDKey, I.SortedSet<Message.Ordinal>>, // ordered ordinals in a thread
  metaMap: I.Map<Common.ConversationIDKey, Meta.ConversationMeta>, // metadata about a thread
  quotingMap: I.Map<string, _quotedOrdConv>, // current message being quoted
  selectedConversation: Common.ConversationIDKey, // the selected conversation, if any
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>, // who's typing currently
  unreadMap: I.Map<Common.ConversationIDKey, number>, // how many unread messages there are
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>, // messages waiting to be sent
  pendingConversationUsers: I.Set<string>, // users we're trying to start a conversation with
  pendingMode: PendingMode, // we're about to talk to people we're searching for or a set of users from somewhere else (folder)
  pendingSelected: boolean, // did we select the pending conversation or not
  pendingStatus: PendingStatus, // where are we at in submitting the conversation
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

export type {ConversationMeta, MetaTrustedState, NotificationsType, PaginationKey} from './meta'
export type {
  AttachmentType,
  MentionsAt,
  MentionsChannel,
  MentionsChannelName,
  Message,
  MessageAttachment,
  MessageExplodeDescription,
  MessageExplodeText,
  MessageSystemAddedToTeam,
  MessageSystemGitPush,
  MessageSystemInviteAccepted,
  MessageSystemJoined,
  MessageSystemLeft,
  MessageSystemSimpleToComplex,
  MessageSystemText,
  MessageText,
  Ordinal,
  OutboxID,
} from './message'
export type {ConversationIDKey} from './common'

export {
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToPaginationKey} from './meta'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
