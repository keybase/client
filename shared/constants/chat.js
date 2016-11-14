// @flow
import HiddenString from '../util/hidden-string'
import {Buffer} from 'buffer'
import {List, Map, Record} from 'immutable'

import type {ConversationID as RPCConversationID, ChatActivity, ConversationInfoLocal} from './types/flow-types-chat'
import type {NoErrorTypedAction} from './types/flux'

export type MessageType = 'Text'
export type FollowState = 'You' | 'Following' | 'Broken' | 'NotFollowing'
export type MessageState = 'pending' | 'sent' | 'failed'

export type Message = {
  type: 'Text',
  message: HiddenString,
  author: string,
  timestamp: number,
  messageID: number,
  followState: FollowState,
  messageState: MessageState,
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
  info: null,
  participants: List(),
  conversationIDKey: '',
  muted: false,
  time: '',
  snippet: '',
})

export type InboxState = Record<{
  info: ConversationInfoLocal,
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
  inbox: List<InboxState>,
  conversationStates: Map<ConversationIDKey, ConversationState>,
  selectedConversation: ?ConversationIDKey,
}>

const maxMessagesToLoadAtATime = 50

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
export const updateMessage = 'chat:updateMessage'

export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationIDKey: ConversationIDKey, messages: Array<Message>}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', void>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {inbox: List<InboxState>}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', void>
export type LoadingMessages = NoErrorTypedAction<'chat:loadingMessages', {conversationIDKey: ConversationIDKey}>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationIDKey: ConversationIDKey, messages: Array<Message>, moreToLoad: boolean, paginationNext: ?Buffer}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationIDKey: ConversationIDKey}>
export type SetupNewChatHandler = NoErrorTypedAction<'chat:setupNewChatHandler', void>
export type IncomingMessage = NoErrorTypedAction<'chat:incomingMessage', {activity: ChatActivity}>
export type PostMessage = NoErrorTypedAction<'chat:postMessage', {conversationIDKey: ConversationIDKey, text: HiddenString}>
export type UpdateMessage = NoErrorTypedAction<'chat:updateMessage', {newMessage: Message}>
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
