// @flow
/* eslint-disable */
import * as Constants from '../constants/chat'
import * as RPCTypes from '../constants/types/flow-types'
import * as I from 'immutable'

type _ExtractReturn<B, F: (...args: any[]) => B> = B
export type ReturnType<F> = _ExtractReturn<*, F>
export type PayloadType<F> = $PropertyType<ReturnType<F>, 'payload'>

// Constants
export const updateBadging = 'chat:updateBadging'
export const deleteEntity = 'chat:deleteEntity'
export const mergeEntity = 'chat:mergeEntity'
export const replaceEntity = 'chat:replaceEntity'
export const subtractEntity = 'chat:subtractEntity'
export const unboxMore = 'chat:unboxMore'
export const exitSearch = 'chat:exitSearch'
export const pendingToRealConversation = 'chat:pendingToRealConversation'
export const updateLatestMessage = 'chat:updateLatestMessage'
export const openFolder = 'chat:openFolder'

// Action Creators
export const createUpdateBadging = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({
  type: updateBadging,
  error: false,
  payload,
})
export const createDeleteEntity = (payload: {|keyPath: Array<string>, ids: I.List<string>|}) => ({
  type: deleteEntity,
  error: false,
  payload,
})
export const createMergeEntity = (payload: {|keyPath: Array<string>, entities: I.Map<any, any> | I.List<any>|}) => ({
  type: mergeEntity,
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
export const createExitSearch = (payload: {|skipSelectPreviousConversation: boolean|}) => ({
  type: exitSearch,
  error: false,
  payload,
})
export const createPendingToRealConversation = (payload: {|oldKey: Constants.ConversationIDKey, newKey: Constants.ConversationIDKey|}) => ({
  type: pendingToRealConversation,
  error: false,
  payload,
})
export const createUpdateLatestMessage = (payload: {|conversationIDKey: Constants.ConversationIDKey|}) => ({
  type: updateLatestMessage,
  error: false,
  payload,
})
export const createOpenFolder = () => ({
  type: openFolder,
  error: false,
  payload: undefined,
})

// All Actions
export type Actions = ReturnType<typeof createUpdateBadging> | ReturnType<typeof createDeleteEntity> | ReturnType<typeof createMergeEntity> | ReturnType<typeof createReplaceEntity> | ReturnType<typeof createSubtractEntity> | ReturnType<typeof createUnboxMore> | ReturnType<typeof createExitSearch> | ReturnType<typeof createPendingToRealConversation> | ReturnType<typeof createUpdateLatestMessage> | ReturnType<typeof createOpenFolder>
