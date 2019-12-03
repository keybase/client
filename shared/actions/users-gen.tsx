// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'users:'
export const getBio = 'users:getBio'
export const getBlockState = 'users:getBlockState'
export const reportUser = 'users:reportUser'
export const setUserBlocks = 'users:setUserBlocks'
export const updateBio = 'users:updateBio'
export const updateBlockState = 'users:updateBlockState'
export const updateBrokenState = 'users:updateBrokenState'
export const updateFullnames = 'users:updateFullnames'

// Payload Types
type _GetBioPayload = {readonly username: string}
type _GetBlockStatePayload = {readonly usernames: Array<string>}
type _ReportUserPayload = {
  readonly username: string
  readonly reason: string
  readonly comment: string
  readonly includeTranscript: boolean
  readonly convID: string | null
}
type _SetUserBlocksPayload = {readonly blocks: Array<RPCTypes.UserBlockArg>}
type _UpdateBioPayload = {readonly userCard: RPCTypes.UserCard; readonly username: string}
type _UpdateBlockStatePayload = {
  readonly blocks: Array<{username: string; chatBlocked: boolean; followBlocked: boolean}>
}
type _UpdateBrokenStatePayload = {readonly newlyBroken: Array<string>; readonly newlyFixed: Array<string>}
type _UpdateFullnamesPayload = {readonly usernameToFullname: {[username: string]: string}}

// Action Creators
/**
 * Call RPC to get block state for usernames
 */
export const createGetBlockState = (payload: _GetBlockStatePayload): GetBlockStatePayload => ({
  payload,
  type: getBlockState,
})
/**
 * Call RPC to set the following user blocks
 */
export const createSetUserBlocks = (payload: _SetUserBlocksPayload): SetUserBlocksPayload => ({
  payload,
  type: setUserBlocks,
})
/**
 * Calls RPC to report user
 */
export const createReportUser = (payload: _ReportUserPayload): ReportUserPayload => ({
  payload,
  type: reportUser,
})
/**
 * Sets the block state for multiple users
 */
export const createUpdateBlockState = (payload: _UpdateBlockStatePayload): UpdateBlockStatePayload => ({
  payload,
  type: updateBlockState,
})
/**
 * Sets user bio for use in one-on-one conversations
 */
export const createUpdateBio = (payload: _UpdateBioPayload): UpdateBioPayload => ({payload, type: updateBio})
export const createGetBio = (payload: _GetBioPayload): GetBioPayload => ({payload, type: getBio})
export const createUpdateBrokenState = (payload: _UpdateBrokenStatePayload): UpdateBrokenStatePayload => ({
  payload,
  type: updateBrokenState,
})
export const createUpdateFullnames = (payload: _UpdateFullnamesPayload): UpdateFullnamesPayload => ({
  payload,
  type: updateFullnames,
})

// Action Payloads
export type GetBioPayload = {readonly payload: _GetBioPayload; readonly type: typeof getBio}
export type GetBlockStatePayload = {
  readonly payload: _GetBlockStatePayload
  readonly type: typeof getBlockState
}
export type ReportUserPayload = {readonly payload: _ReportUserPayload; readonly type: typeof reportUser}
export type SetUserBlocksPayload = {
  readonly payload: _SetUserBlocksPayload
  readonly type: typeof setUserBlocks
}
export type UpdateBioPayload = {readonly payload: _UpdateBioPayload; readonly type: typeof updateBio}
export type UpdateBlockStatePayload = {
  readonly payload: _UpdateBlockStatePayload
  readonly type: typeof updateBlockState
}
export type UpdateBrokenStatePayload = {
  readonly payload: _UpdateBrokenStatePayload
  readonly type: typeof updateBrokenState
}
export type UpdateFullnamesPayload = {
  readonly payload: _UpdateFullnamesPayload
  readonly type: typeof updateFullnames
}

// All Actions
// prettier-ignore
export type Actions =
  | GetBioPayload
  | GetBlockStatePayload
  | ReportUserPayload
  | SetUserBlocksPayload
  | UpdateBioPayload
  | UpdateBlockStatePayload
  | UpdateBrokenStatePayload
  | UpdateFullnamesPayload
  | {type: 'common:resetStore', payload: {}}
