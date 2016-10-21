// @flow
import {List, Map} from 'immutable'

import type {NoErrorTypedAction} from './types/flux'

export type MessageType = 'Text'

export type Message = {
  type: 'Text',
  message: string,
  author: string,
  timestamp: Date,
  messageID: string,
}

export type ConversationState = {
  messages: List<Message>,
  moreToLoad: boolean,
}

export type ConversationID = string

export type State = {
  conversationStates: Map<ConversationID, ConversationState>,
  selectedConversation: ?ConversationID,
}

export const appendMessages = 'chat:appendMessages'
export const selectConversation = 'chat:selectConversation'
export const loadInbox = 'chat:loadInbox'
export const loadedInbox = 'chat:loadInbox'
export const loadMoreMessages = 'chat:loadMoreMessages'
export const prependMessages = 'chat:prependMessages'

export type AppendMessages = NoErrorTypedAction<'chat:appendMessages', {conversationID: ConversationID, messages: Array<Message>}>
export type LoadInbox = NoErrorTypedAction<'chat:loadInbox', void>
export type LoadedInbox = NoErrorTypedAction<'chat:loadedInbox', {TODO: any}>
export type LoadMoreMessages = NoErrorTypedAction<'chat:loadMoreMessages', void>
export type PrependMessages = NoErrorTypedAction<'chat:prependMessages', {conversationID: ConversationID, messages: Array<Message>}>
export type SelectConversation = NoErrorTypedAction<'chat:selectConversation', {conversationID: ConversationID}>

export type Actions = AppendMessages | LoadMoreMessages | PrependMessages | SelectConversation | LoadInbox | LoadedInbox
