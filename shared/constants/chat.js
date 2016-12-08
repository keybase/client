// @flow
import HiddenString from '../util/hidden-string'
import HiddenThing from '../util/hidden-thing'
import {Buffer} from 'buffer'
import {Set, List, Map, Record} from 'immutable'

import type {UserListItem} from '../common-adapters/usernames'
import type {NoErrorTypedAction} from './types/flux'
import type {ConversationID as RPCConversationID, MessageID as RPCMessageID, ChatActivity, ConversationInfoLocal} from './types/flow-types-chat'

export type MessageType = 'Text'
export type FollowState = 'You' | 'Following' | 'Broken' | 'NotFollowing'
export const followStates: Array<FollowState> = ['You', 'Following', 'Broken', 'NotFollowing']

export type MessageState = 'pending' | 'failed' | 'sent'
export const messageStates: Array<MessageState> = ['pending', 'failed', 'sent']

export type ConversationID = RPCConversationID
export type ConversationIDKey = string
export type ParticipantItem = UserListItem

export type MessageID = RPCMessageID

export type ClientMessage = TimestampMessage
export type ServerMessage = TextMessage | ErrorMessage | UnhandledMessage

export type Message = ClientMessage | ServerMessage

export type TextMessage = {
  type: 'Text',
  message: HiddenString,
  author: HiddenString,
  deviceName: HiddenString,
  // TODO make this use DeviceType instead of string
  deviceType: HiddenThing<string>,
  timestamp: HiddenThing<number>,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  followState: HiddenThing<FollowState>,
  messageState: HiddenThing<MessageState>,
  outboxID?: ?string,
}

export type ErrorMessage = {
  type: 'Error',
  reason: HiddenString,
  timestamp: HiddenThing<number>,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
}

export type UnhandledMessage = {
  type: 'Unhandled',
  timestamp: HiddenThing<number>,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
}

export type TimestampMessage = {
  type: 'Timestamp',
  timestamp: HiddenThing<number>,
}

export type ConversationState = Record<{
  messages: List<Message>,
  seenMessages: Set<MessageID>,
  moreToLoad: HiddenThing<boolean>,
  isLoading: boolean,
  paginationNext: ?Buffer,
  paginationPrevious: ?Buffer,
  firstNewMessageID: ?MessageID,
}>

export const ConversationStateRecord: Class<ConversationState> = Record({
  messages: List(),
  seenMessages: Set(),
  moreToLoad: new HiddenThing(false),
  isLoading: true,
  paginationNext: undefined,
  paginationPrevious: undefined,
  firstNewMessageID: undefined,
})

export type InboxState = Record<{
  info: HiddenThing<?ConversationInfoLocal>,
  participants: HiddenThing<List<ParticipantItem>>,
  conversationIDKey: ConversationIDKey,
  muted: HiddenThing<boolean>,
  time: HiddenThing<number>,
  snippet: HiddenString,
  unreadCount: HiddenThing<number>,
}>

export const InboxStateRecord: Class<InboxState> = Record({
  info: new HiddenThing(null),
  participants: new HiddenThing(List()),
  conversationIDKey: '',
  muted: new HiddenThing(false),
  time: new HiddenString(''),
  snippet: new HiddenString(''),
  unreadCount: new HiddenThing(0),
})

export type MetaData = Record<{
  fullname: HiddenString,
}>

export const MetaDataRecord: Class<MetaData> = Record({
  fullname: new HiddenString('Unknown'),
})

export type State = Record<{
  inbox: List<InboxState>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  selectedConversation: HiddenThing<?ConversationIDKey>,
  focused: boolean,
  metaData: Map<string, MetaData>,
}>

export const StateRecord: Class<State> = Record({
  inbox: List(),
  conversationStates: new Map(),
  selectedConversation: new HiddenThing(null),
  focused: false,
  metaData: Map(),
})

export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50

export const appendMessages = 'chat:appendMessages'
export const selectConversation = 'chat:selectConversation'
export const loadInbox = 'chat:loadInbox'
export const loadedInbox = 'chat:loadedInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const loadingMessages = 'chat:loadingMessages'
export const prependMessages = 'chat:prependMessages'
export const setupNewChatHandler = 'chat:setupNewChatHandler'
export const incomingMessage = 'chat:incomingMessage'
export const postMessage = 'chat:postMessage'
export const updateBadge = 'chat:updateBadge'
export const pendingMessageWasSent = 'chat:pendingMessageWasSent'
export const newChat = 'chat:newChat'
export const startConversation = 'chat:startConversation'
export const openFolder = 'chat:openFolder'
export const updateMetadata = 'chat:updateMetadata'
export const updatedMetadata = 'chat:updatedMetadata'
export const editMessage = 'chat:editMessage'
export const deleteMessage = 'chat:deleteMessage'

export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, messages: Array<ServerMessage>}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', void>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxState>}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', void>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<ServerMessage>, moreToLoad: HiddenThing<boolean>, paginationNext: ?Buffer}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ConversationIDKey, fromUser: boolean}>
export type SetupNewChatHandler = NoErrorTypedAction<'chat:setupNewChatHandler', void>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: HiddenThing<ChatActivity>}>
export type PostMessage = NoErrorTypedAction<'chat:postMessage', {conversationIDKey: ConversationIDKey, text: HiddenString}>
export type PendingMessageWasSent = NoErrorTypedAction<'chat:pendingMessageWasSent', {newMessage: $Shape<Message>}>
export type NewChat = NoErrorTypedAction<'chat:newChat', {existingParticipants: Array<string>}>
export type StartConversation = NoErrorTypedAction<'chat:startConversation', {users: Array<string>}>
export type OpenFolder = NoErrorTypedAction<'chat:openFolder', void>
export type UpdateMetadata = NoErrorTypedAction<'chat:updateMetadata', {users: HiddenThing<Array<string>>}>
export type UpdatedMetadata = NoErrorTypedAction<'chat:updatedMetadata', {[key: string]: MetaData}>
export type EditMessage = NoErrorTypedAction<'chat:editMessage', {message: Message}>
export type DeleteMessage = NoErrorTypedAction<'chat:deleteMessage', {message: Message}>

export type Actions = AppendMessages
  | DeleteMessage
  | EditMessage
  | LoadInbox
  | LoadMoreMessages
  | LoadedInbox
  | NewChat
  | OpenFolder
  | PrependMessages
  | SelectConversation
  | StartConversation
  | UpdateMetadata
  | UpdatedMetadata

function conversationIDToKey (conversationID: ConversationID): ConversationIDKey {
  return conversationID.toString('hex')
}

function keyToConversationID (key: ConversationIDKey): ConversationID {
  return Buffer.from(key, 'hex')
}

// This is emoji aware hence all the weird ... stuff. See https://mathiasbynens.be/notes/javascript-unicode#iterating-over-symbols
function makeSnippet (message: ?string = '', max: number) {
  // $FlowIssue flow doesn't understand spread + strings
  return [...(message.substring(0, max * 4).replace(/\s+/g, ' '))].slice(0, max).join('')
}

// Filters out myself from most of our views of the list, unless the list is just me
function participantFilter (participants: List<ParticipantItem>): List<ParticipantItem> {
  const withoutYou = participants.filter(p => !p.you)
  if (withoutYou.count() === 0) {
    return participants
  }
  return withoutYou
}

export {
  conversationIDToKey,
  keyToConversationID,
  makeSnippet,
  participantFilter,
}
