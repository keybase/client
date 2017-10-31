// @flow
/* eslint-disable */
import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as I from 'immutable'

// Constants
export const deleteEntity = 'chat:deleteEntity'
export const exitSearch = 'chat:exitSearch'
export const mergeEntity = 'chat:mergeEntity'
export const openFolder = 'chat:openFolder'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const replaceEntity = 'chat:replaceEntity'
export const subtractEntity = 'chat:subtractEntity'
export const unboxMore = 'chat:unboxMore'
export const updateBadging = 'chat:updateBadging'
export const updateLatestMessage = 'chat:updateLatestMessage'

// Action Creators
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: I.List<string>|}) => ({
  type: deleteEntity,
  error: false,
  payload,
})
export const createExitSearch = (payload: {|skipSelectPreviousConversation: boolean|}) => ({
  type: exitSearch,
  error: false,
  payload,
})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({
  type: mergeEntity,
  error: false,
  payload,
})
export const createOpenFolder = () => ({
  type: openFolder,
  error: false,
  payload: undefined,
})
export const createPendingToRealConversation = (payload: {|oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey|}) => ({
  type: pendingToRealConversation,
  error: false,
  payload,
})
export const createReplaceEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({
  type: replaceEntity,
  error: false,
  payload,
})
export const createSubtractEntity = (payload: {|keyPath: Array<string>, entities: I.List<any>|}) => ({
  type: subtractEntity,
  error: false,
  payload,
})
export const createUnboxMore = () => ({
  type: unboxMore,
  error: false,
  payload: undefined,
})
export const createUpdateBadging = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({
  type: updateBadging,
  error: false,
  payload,
})
export const createUpdateLatestMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({
  type: updateLatestMessage,
  error: false,
  payload,
})

// Action Payloads
export type DeleteEntityPayload = ReturnType<typeof createDeleteEntity>
export type ExitSearchPayload = ReturnType<typeof createExitSearch>
export type MergeEntityPayload = ReturnType<typeof createMergeEntity>
export type OpenFolderPayload = ReturnType<typeof createOpenFolder>
export type PendingToRealConversationPayload = ReturnType<typeof createPendingToRealConversation>
export type ReplaceEntityPayload = ReturnType<typeof createReplaceEntity>
export type SubtractEntityPayload = ReturnType<typeof createSubtractEntity>
export type UnboxMorePayload = ReturnType<typeof createUnboxMore>
export type UpdateBadgingPayload = ReturnType<typeof createUpdateBadging>
export type UpdateLatestMessagePayload = ReturnType<typeof createUpdateLatestMessage>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createDeleteEntity>
  | ReturnType<typeof createExitSearch>
  | ReturnType<typeof createMergeEntity>
  | ReturnType<typeof createOpenFolder>
  | ReturnType<typeof createPendingToRealConversation>
  | ReturnType<typeof createReplaceEntity>
  | ReturnType<typeof createSubtractEntity>
  | ReturnType<typeof createUnboxMore>
  | ReturnType<typeof createUpdateBadging>
  | ReturnType<typeof createUpdateLatestMessage>
