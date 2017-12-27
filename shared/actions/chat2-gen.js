// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import * as RPCChatTypes from '../constants/types/rpc-chat-gen'
import * as Types from '../constants/types/chat2'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer
export const inboxRefresh = 'chat2:inboxRefresh'
export const messagesAdd = 'chat2:messagesAdd'
export const metaHandleQueue = 'chat2:metaHandleQueue'
export const metaNeedsUpdating = 'chat2:metaNeedsUpdating'
export const metaReceivedError = 'chat2:metaReceivedError'
export const metaRequestTrusted = 'chat2:metaRequestTrusted'
export const metaUpdateTrustedState = 'chat2:metaUpdateTrustedState'
export const metasReceived = 'chat2:metasReceived'

// Action Creators
export const createInboxRefresh = () => ({error: false, payload: undefined, type: inboxRefresh})
export const createMessagesAdd = (payload: {|+messages: Array<Types.Message>|}) => ({error: false, payload, type: messagesAdd})
export const createMetaHandleQueue = () => ({error: false, payload: undefined, type: metaHandleQueue})
export const createMetaNeedsUpdating = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>, +reason: string|}) => ({error: false, payload, type: metaNeedsUpdating})
export const createMetaReceivedError = (payload: {|+conversationIDKey: Types.ConversationIDKey, +error: RPCChatTypes.ConversationErrorLocal|}) => ({error: false, payload, type: metaReceivedError})
export const createMetaRequestTrusted = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: metaRequestTrusted})
export const createMetaUpdateTrustedState = (payload: {|+newState: Types.MetaTrustedState, +conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: metaUpdateTrustedState})
export const createMetasReceived = (payload: {|+metas: Array<Types.ConversationMeta>|}) => ({error: false, payload, type: metasReceived})

// Action Payloads
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type MessagesAddPayload = More.ReturnType<typeof createMessagesAdd>
export type MetaHandleQueuePayload = More.ReturnType<typeof createMetaHandleQueue>
export type MetaNeedsUpdatingPayload = More.ReturnType<typeof createMetaNeedsUpdating>
export type MetaReceivedErrorPayload = More.ReturnType<typeof createMetaReceivedError>
export type MetaRequestTrustedPayload = More.ReturnType<typeof createMetaRequestTrusted>
export type MetaUpdateTrustedStatePayload = More.ReturnType<typeof createMetaUpdateTrustedState>
export type MetasReceivedPayload = More.ReturnType<typeof createMetasReceived>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createMessagesAdd>
  | More.ReturnType<typeof createMetaHandleQueue>
  | More.ReturnType<typeof createMetaNeedsUpdating>
  | More.ReturnType<typeof createMetaReceivedError>
  | More.ReturnType<typeof createMetaRequestTrusted>
  | More.ReturnType<typeof createMetaUpdateTrustedState>
  | More.ReturnType<typeof createMetasReceived>
  | {type: 'common:resetStore', payload: void}
