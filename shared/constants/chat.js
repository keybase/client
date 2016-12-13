// @flow
import HiddenString from '../util/hidden-string'
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
  author: string,
  deviceName: string,
  deviceType: string,
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID?: MessageID,
  followState: FollowState,
  messageState: MessageState,
  outboxID?: ?string,
  key: any,
}

export type ErrorMessage = {
  type: 'Error',
  reason: string,
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: any,
}

export type UnhandledMessage = {
  type: 'Unhandled',
  timestamp: number,
  conversationIDKey: ConversationIDKey,
  messageID: MessageID,
  key: any,
}

export type TimestampMessage = {
  type: 'Timestamp',
  timestamp: number,
  key: any,
}

export type MaybeTimestamp = TimestampMessage | null

export const ConversationStateRecord = Record({
  messages: List(),
  seenMessages: Set(),
  moreToLoad: false,
  isLoading: true,
  paginationNext: undefined,
  paginationPrevious: undefined,
  firstNewMessageID: undefined,
})

export type ConversationState = Record<{
  messages: List<Message>,
  seenMessages: Set<MessageID>,
  moreToLoad: boolean,
  isLoading: boolean,
  paginationNext: ?Buffer,
  paginationPrevious: ?Buffer,
  firstNewMessageID: ?MessageID,
}>

export type ConversationBadgeStateRecord = Record<{
  convID: ConversationID,
  UnreadMessages: number,
}>

export const InboxStateRecord = Record({
  info: null,
  participants: List(),
  conversationIDKey: '',
  muted: false,
  time: '',
  snippet: '',
  unreadCount: 0,
  validated: false,
})

export type InboxState = Record<{
  info: ConversationInfoLocal,
  participants: List<ParticipantItem>,
  conversationIDKey: ConversationIDKey,
  muted: boolean,
  time: string,
  snippet: string,
  unreadCount: number,
  validated: boolean,
}>

export type MetaData = Record<{
  fullname: string,
}>

export const MetaDataRecord = Record({
  fullname: 'Unknown',
})

export const StateRecord = Record({
  inbox: List(),
  conversationStates: Map(),
  selectedConversation: null,
  focused: false,
  metaData: Map(),
})

export type State = Record<{
  inbox: List<InboxState>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  selectedConversation: ?ConversationIDKey,
  focused: boolean,
  metaData: Map<string, MetaData>,
}>

export const howLongBetweenTimestampsMs = 1000 * 60 * 15
export const maxMessagesToLoadAtATime = 50

export const appendMessages = 'chat:appendMessages'
export const badgeAppForChat = 'chat:badgeAppForChat'
export const deleteMessage = 'chat:deleteMessage'
export const editMessage = 'chat:editMessage'
export const incomingMessage = 'chat:incomingMessage'
export const loadInbox = 'chat:loadInbox'
export const loadedInbox = 'chat:loadedInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const loadingMessages = 'chat:loadingMessages'
export const newChat = 'chat:newChat'
export const openFolder = 'chat:openFolder'
export const pendingMessageWasSent = 'chat:pendingMessageWasSent'
export const postMessage = 'chat:postMessage'
export const prependMessages = 'chat:prependMessages'
export const selectConversation = 'chat:selectConversation'
export const setupNewChatHandler = 'chat:setupNewChatHandler'
export const startConversation = 'chat:startConversation'
export const updateBadging = 'chat:updateBadging'
export const updateLatestMessage = 'chat:updateLatestMessage'
export const updateMetadata = 'chat:updateMetadata'
export const updatedMetadata = 'chat:updatedMetadata'
export const updateInbox = 'chat:updateInbox'

export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, messages: Array<ServerMessage>}>
export type BadgeAppForChat = NoErrorTypedAction<'chat:badgeAppForChat', Array<ConversationBadgeStateRecord>>
export type DeleteMessage = NoErrorTypedAction<'chat:deleteMessage', {message: Message}>
export type EditMessage = NoErrorTypedAction<'chat:editMessage', {message: Message}>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: ChatActivity}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', void>
export type UpdateInbox = NoErrorTypedAction<'chat:updateInbox', {conversation: InboxState}>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxState>}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', void>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey}>
export type NewChat = NoErrorTypedAction<'chat:newChat', {existingParticipants: Array<string>}>
export type OpenFolder = NoErrorTypedAction<'chat:openFolder', void>
export type PendingMessageWasSent = NoErrorTypedAction<'chat:pendingMessageWasSent', {newMessage: Message}>
export type PostMessage = NoErrorTypedAction<'chat:postMessage', {conversationIDKey: ConversationIDKey, text: HiddenString}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<ServerMessage>, moreToLoad: boolean, paginationNext: ?Buffer}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ConversationIDKey, fromUser: boolean}>
export type SetupNewChatHandler = NoErrorTypedAction<'chat:setupNewChatHandler', void>
export type StartConversation = NoErrorTypedAction<'chat:startConversation', {users: Array<string>}>
export type UpdateBadging = NoErrorTypedAction<'chat:updateBadging', {conversationIDKey: ConversationIDKey}>
export type UpdateLatestMessage = NoErrorTypedAction<'chat:updateLatestMessage', {conversationIDKey: ConversationIDKey}>
export type UpdateMetadata = NoErrorTypedAction<'chat:updateMetadata', {users: Array<string>}>
export type UpdatedMetadata = NoErrorTypedAction<'chat:updatedMetadata', {[key: string]: MetaData}>

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
  | UpdateBadging
  | UpdateInbox
  | UpdateLatestMessage
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
