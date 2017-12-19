// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/chat2'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of chat2 but is handled by every reducer
export const inboxRefresh = 'chat2:inboxRefresh'
export const inboxUtrustedLoaded = 'chat2:inboxUtrustedLoaded'
export const queueUnboxConversations = 'chat2:queueUnboxConversations'
export const unboxConversations = 'chat2:unboxConversations'
export const unboxSomeConversations = 'chat2:unboxSomeConversations'
export const updateConverationLoadingStates = 'chat2:updateConverationLoadingStates'

// Action Creators
export const createInboxRefresh = () => ({error: false, payload: undefined, type: inboxRefresh})
export const createInboxUtrustedLoaded = (payload: {|+untrusted: Array<Types.ConversationMeta>|}) => ({error: false, payload, type: inboxUtrustedLoaded})
export const createQueueUnboxConversations = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>, +reason: string|}) => ({error: false, payload, type: queueUnboxConversations})
export const createUnboxConversations = (payload: {|+conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: unboxConversations})
export const createUnboxSomeConversations = () => ({error: false, payload: undefined, type: unboxSomeConversations})
export const createUpdateConverationLoadingStates = (payload: {|+newState: Types.LoadingState, +conversationIDKeys: Array<Types.ConversationIDKey>|}) => ({error: false, payload, type: updateConverationLoadingStates})

// Action Payloads
export type InboxRefreshPayload = More.ReturnType<typeof createInboxRefresh>
export type InboxUtrustedLoadedPayload = More.ReturnType<typeof createInboxUtrustedLoaded>
export type QueueUnboxConversationsPayload = More.ReturnType<typeof createQueueUnboxConversations>
export type UnboxConversationsPayload = More.ReturnType<typeof createUnboxConversations>
export type UnboxSomeConversationsPayload = More.ReturnType<typeof createUnboxSomeConversations>
export type UpdateConverationLoadingStatesPayload = More.ReturnType<typeof createUpdateConverationLoadingStates>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createInboxRefresh>
  | More.ReturnType<typeof createInboxUtrustedLoaded>
  | More.ReturnType<typeof createQueueUnboxConversations>
  | More.ReturnType<typeof createUnboxConversations>
  | More.ReturnType<typeof createUnboxSomeConversations>
  | More.ReturnType<typeof createUpdateConverationLoadingStates>
  | {type: 'common:resetStore', payload: void}
