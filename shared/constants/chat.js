// @flow
import {List, Map, Record} from 'immutable'
import Buffer from 'buffer'

import type {ConversationID as RPCConversationID} from './types/flow-types-chat'
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
  moreToLoad: true,
})

export type ConversationState = Record<{
  messages: List<Message>,
  moreToLoad: boolean,
}>

export type ConversationID = RPCConversationID

export const StateRecord = Record({
  conversationStates: Map(),
  selectedConversation: null,
})

export type State = Record<{
  conversationStates: Map<ConversationID, ConversationState>,
  selectedConversation: ?ConversationID,
}>

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

function conversationIDToKey (conversationID: ConversationID): string {
  return conversationID.toString('base64')
}

function keyToConversationID (key: string): ConversationID {
  return Buffer.from(key, 'base64')
}

export {
  conversationIDToKey,
  keyToConversationID,
}
