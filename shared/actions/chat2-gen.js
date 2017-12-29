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
export const badgesUpdated = 'chat2:badgesUpdated'
export const inboxRefresh = 'chat2:inboxRefresh'
export const messageEdit = 'chat2:messageEdit'
export const messagesAdd = 'chat2:messagesAdd'
export const messagesDelete = 'chat2:messagesDelete'
export const metaHandleQueue = 'chat2:metaHandleQueue'
export const metaNeedsUpdating = 'chat2:metaNeedsUpdating'
export const metaReceivedError = 'chat2:metaReceivedError'
export const metaRequestTrusted = 'chat2:metaRequestTrusted'
export const metaUpdateTrustedState = 'chat2:metaUpdateTrustedState'
export const metasReceived = 'chat2:metasReceived'
export const selectConversation = 'chat2:selectConversation'
export const setInboxFilter = 'chat2:setInboxFilter'
export const setSearching = 'chat2:setSearching'
export const setupChatHandlers = 'chat2:setupChatHandlers'

// Action Creators
export const createBadgesUpdated = (payload: {|+conversations: Array<RPCTypes.BadgeConversationInfo>|}) => ({error: false, payload, type: badgesUpdated})
export const createInboxRefresh = () => ({error: false, payload: undefined, type: inboxRefresh})
export const createMessageEdit = (payload: {|+conversationIDKey: Types.ConversationIDKey, +ordinal: Types.Ordinal, +text: HiddenString|}) => ({error: false, payload, type: messageEdit})
export const createMessagesAdd = (payload: {|+messages: Array<Types.Message>|}) => ({error: false, payload, type: messagesAdd})
export const createMessagesDelete = (payload: {|+conversationIDKey: Types.ConversationIDKey, +ordinals: Array<Types.Ordinal>|}) => ({error: false, payload, type: messagesDelete})
export const createMetaHandleQueue = () => ({error: false, payload: undefined, type: metaHandleQueue})
export const createMetaNeedsUpdating = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>, +reason: string|}) => ({error: false, payload, type: metaNeedsUpdating})
export const createMetaReceivedError = (payload: {|+conversationIDKey: Types.ConversationIDKey, +error: RPCChatTypes.ConversationErrorLocal, +username: string|}) => ({error: false, payload, type: metaReceivedError})
export const createMetaRequestTrusted = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: metaRequestTrusted})
export const createMetaUpdateTrustedState = (payload: {|+newState: Types.MetaTrustedState, +conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: metaUpdateTrustedState})
export const createMetasReceived = (payload: {|+metas: Array<Types.ConversationMeta>|}) => ({error: false, payload, type: metasReceived})
export const createSelectConversation = (payload: {|+conversationIDKey: ?Types.ConversationIDKey, +fromUser?: boolean|}) => ({error: false, payload, type: selectConversation})
export const createSetInboxFilter = (payload: {|+filter: string|}) => ({error: false, payload, type: setInboxFilter})
export const createSetSearching = (payload: {|+searching: boolean|}) => ({error: false, payload, type: setSearching})
export const createSetupChatHandlers = () => ({error: false, payload: undefined, type: setupChatHandlers})

// Action Payloads
export type BadgesUpdatedPayload = More.ReturnType<typeof createBadgesUpdated>
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type MessageEditPayload = More.ReturnType<typeof createMessageEdit>
export type MessagesAddPayload = More.ReturnType<typeof createMessagesAdd>
export type MessagesDeletePayload = More.ReturnType<typeof createMessagesDelete>
export type MetaHandleQueuePayload = More.ReturnType<typeof createMetaHandleQueue>
export type MetaNeedsUpdatingPayload = More.ReturnType<typeof createMetaNeedsUpdating>
export type MetaReceivedErrorPayload = More.ReturnType<typeof createMetaReceivedError>
export type MetaRequestTrustedPayload = More.ReturnType<typeof createMetaRequestTrusted>
export type MetaUpdateTrustedStatePayload = More.ReturnType<typeof createMetaUpdateTrustedState>
export type MetasReceivedPayload = More.ReturnType<typeof createMetasReceived>
export type SelectConversationPayload = More.ReturnType<typeof createSelectConversation>
export type SetInboxFilterPayload = More.ReturnType<typeof createSetInboxFilter>
export type SetSearchingPayload = More.ReturnType<typeof createSetSearching>
export type SetupChatHandlersPayload = More.ReturnType<typeof createSetupChatHandlers>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createBadgesUpdated>
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createMessageEdit>
  | More.ReturnType<typeof createMessagesAdd>
  | More.ReturnType<typeof createMessagesDelete>
  | More.ReturnType<typeof createMetaHandleQueue>
  | More.ReturnType<typeof createMetaNeedsUpdating>
  | More.ReturnType<typeof createMetaReceivedError>
  | More.ReturnType<typeof createMetaRequestTrusted>
  | More.ReturnType<typeof createMetaUpdateTrustedState>
  | More.ReturnType<typeof createMetasReceived>
  | More.ReturnType<typeof createSelectConversation>
  | More.ReturnType<typeof createSetInboxFilter>
  | More.ReturnType<typeof createSetSearching>
  | More.ReturnType<typeof createSetupChatHandlers>
  | {type: 'common:resetStore', payload: void}
