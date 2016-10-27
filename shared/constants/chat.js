// @flow
import {List, Map, Record} from 'immutable'
import {Buffer} from 'buffer'

import type {ConversationID as RPCConversationID, ChatActivity} from './types/flow-types-chat'
import type {NoErrorTypedAction} from './types/flux'

export type MessageType = 'Text'
export type FollowState = 'You' | 'Following' | 'Broken' | 'NotFollowing'

export type Message = {
  type: 'Text',
  message: string,
  author: string,
  timestamp: number,
  messageID: number,
  followState: FollowState,
} | {
  type: 'Error',
  reason: string,
  messageID: number,
} | {
  type: 'Unhandled',
  timestamp: number,
  messageID: number,
}

export const ConversationStateRecord = Record({
  messages: List(),
  moreToLoad: false,
  isLoading: true,
  paginationNext: undefined,
  paginationPrevious: undefined,
})

export type ConversationState = Record<{
  messages: List<Message>,
  moreToLoad: boolean,
  isLoading: boolean,
  paginationNext: ?Buffer,
  paginationPrevious: ?Buffer,
}>

export type ConversationID = RPCConversationID
export type ConversationIDKey = string

export const InboxStateRecord = Record({
  participants: List(),
  conversationIDKey: '',
  muted: false,
  time: '',
  snippet: '',
})

export type InboxState = Record<{
  participants: List<string>,
  conversationIDKey: ConversationIDKey,
  muted: boolean,
  time: string,
  snippet: string,
}>

export const StateRecord = Record({
  inbox: List(),
  conversationStates: Map(),
  selectedConversation: null,
})

export type State = Record<{
  inbox: List<InboxStateRecord>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  selectedConversation: ?ConversationIDKey,
}>

const maxMessagesToLoadAtATime = 10

export const appendMessages = 'chat:appendMessages'
export const selectConversation = 'chat:selectConversation'
export const loadInbox = 'chat:loadInbox'
export const loadedInbox = 'chat:loadedInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const loadingMessages = 'chat:loadingMessages'
export const prependMessages = 'chat:prependMessages'
export const setupNewChatHandler = 'chat:setupNewChatHandler'
export const incomingMessage = 'chat:incomingMessage'

// TODO paginationprevious
export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, messages: Array<Message>}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', void>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxStateRecord>}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', void>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<Message>, moreToLoad: boolean, paginationNext: ?Buffer}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ConversationIDKey}>
export type SetupNewChatHandler = NoErrorTypedAction<'chat:setupNewChatHandler', void>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: ChatActivity}>

export type Actions = AppendMessages | LoadMoreMessages | PrependMessages | SelectConversation | LoadInbox | LoadedInbox

function conversationIDToKey (conversationID: ConversationID): ConversationIDKey {
  return conversationID.toString('base64')
}

function keyToConversationID (key: ConversationIDKey): ConversationID {
  return Buffer.from(key, 'base64')
}

export {
  conversationIDToKey,
  keyToConversationID,
  maxMessagesToLoadAtATime,
}
