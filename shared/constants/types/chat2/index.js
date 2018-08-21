// @flow strict
import * as RPCChatTypes from '../rpc-chat-gen'
// $FlowIssue https://github.com/facebook/flow/issues/6628
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

export type _QuoteInfo = {
  // Always positive and monotonically increasing.
  counter: number,
  ordinal: Message.Ordinal,
  sourceConversationIDKey: Common.ConversationIDKey,
  targetConversationIDKey: Common.ConversationIDKey,
}
export type QuoteInfo = I.RecordOf<_QuoteInfo>

// Static config data we use for various things
export type _StaticConfig = {
  deletableByDeleteHistory: I.Set<Message.MessageType>,
}
export type StaticConfig = I.RecordOf<_StaticConfig>

export type _State = {
  badgeMap: I.Map<Common.ConversationIDKey, number>, // id to the badge count
  editingMap: I.Map<Common.ConversationIDKey, Message.Ordinal>, // current message being edited
  inboxFilter: string, // filters 'jump to chat'
  inboxHasLoaded: boolean, // if we've ever loaded
  isExplodingNew: boolean, // controls the new-ness of exploding messages UI
  messageMap: I.Map<Common.ConversationIDKey, I.Map<Message.Ordinal, Message.Message>>, // messages in a thread
  messageOrdinals: I.Map<Common.ConversationIDKey, I.SortedSet<Message.Ordinal>>, // ordered ordinals in a thread
  metaMap: I.Map<Common.ConversationIDKey, Meta.ConversationMeta>, // metadata about a thread, There is a special node for the pending conversation
  moreToLoadMap: I.Map<Common.ConversationIDKey, boolean>, // if we have more data to load
  orangeLineMap: I.Map<Common.ConversationIDKey, number>, // last message we've seen
  explodingModeLocks: I.Map<Common.ConversationIDKey, number>, // locks set on exploding mode while user is inputting text
  explodingModes: I.Map<Common.ConversationIDKey, number>, // seconds to exploding message expiration
  quote: ?QuoteInfo, // last quoted message
  selectedConversation: Common.ConversationIDKey, // the selected conversation, if any
  staticConfig: ?StaticConfig, // static config stuff from the service. only needs to be loaded once. if null, it hasn't been loaded
  typingMap: I.Map<Common.ConversationIDKey, I.Set<string>>, // who's typing currently
  unreadMap: I.Map<Common.ConversationIDKey, number>, // how many unread messages there are
  pendingOutboxToOrdinal: I.Map<Common.ConversationIDKey, I.Map<Message.OutboxID, Message.Ordinal>>, // messages waiting to be sent
  pendingMode: PendingMode, // we're about to talk to people we're searching for or a set of users from somewhere else (folder)
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

export type {ConversationMeta, MetaTrustedState, NotificationsType} from './meta'
export type {
  AttachmentType,
  MentionsAt,
  MentionsChannel,
  MentionsChannelName,
  Message,
  MessageAttachment,
  MessageExplodeDescription,
  MessageID,
  MessageSystemAddedToTeam,
  MessageSystemGitPush,
  MessageSystemInviteAccepted,
  MessageSystemJoined,
  MessageSystemLeft,
  MessageSystemSimpleToComplex,
  MessageSystemText,
  MessageText,
  MessageType,
  Ordinal,
  OutboxID,
  PreviewSpec,
  Reaction,
  Reactions,
} from './message'
export type {ConversationIDKey} from './common'

export {
  messageIDToNumber,
  numberToMessageID,
  numberToOrdinal,
  ordinalToNumber,
  outboxIDToString,
  stringToOutboxID,
} from './message'
export {stringToConversationIDKey, conversationIDKeyToString} from './common'
