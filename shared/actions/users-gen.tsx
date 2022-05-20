// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
import type * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'users:'
export const getBio = 'users:getBio'
export const getBlockState = 'users:getBlockState'
export const reportUser = 'users:reportUser'
export const setUserBlocks = 'users:setUserBlocks'
export const submitRevokeVouch = 'users:submitRevokeVouch'
export const updateBio = 'users:updateBio'
export const updateBlockState = 'users:updateBlockState'
export const updateBrokenState = 'users:updateBrokenState'
export const updateFullnames = 'users:updateFullnames'
export const wotReact = 'users:wotReact'

// Action Creators
/**
 * Call RPC to get block state for usernames
 */
export const createGetBlockState = (payload: {readonly usernames: Array<string>}) => ({
  payload,
  type: getBlockState as typeof getBlockState,
})
/**
 * Call RPC to set the following user blocks
 */
export const createSetUserBlocks = (payload: {readonly blocks: Array<RPCTypes.UserBlockArg>}) => ({
  payload,
  type: setUserBlocks as typeof setUserBlocks,
})
/**
 * Calls RPC to report user
 */
export const createReportUser = (payload: {
  readonly username: string
  readonly reason: string
  readonly comment: string
  readonly includeTranscript: boolean
  readonly convID: string | null
}) => ({payload, type: reportUser as typeof reportUser})
/**
 * Sets the block state for multiple users
 */
export const createUpdateBlockState = (payload: {
  readonly blocks: Array<{username: string; chatBlocked: boolean; followBlocked: boolean}>
}) => ({payload, type: updateBlockState as typeof updateBlockState})
/**
 * Sets user bio for use in one-on-one conversations
 */
export const createUpdateBio = (payload: {
  readonly userCard: RPCTypes.UserCard
  readonly username: string
}) => ({payload, type: updateBio as typeof updateBio})
/**
 * revoke an attestation you previously made
 */
export const createSubmitRevokeVouch = (payload: {
  readonly proofID: string
  readonly voucheeName: string
}) => ({payload, type: submitRevokeVouch as typeof submitRevokeVouch})
export const createGetBio = (payload: {readonly username: string}) => ({
  payload,
  type: getBio as typeof getBio,
})
export const createUpdateBrokenState = (payload: {
  readonly newlyBroken: Array<string>
  readonly newlyFixed: Array<string>
}) => ({payload, type: updateBrokenState as typeof updateBrokenState})
export const createUpdateFullnames = (payload: {
  readonly usernameToFullname: {[username: string]: string}
}) => ({payload, type: updateFullnames as typeof updateFullnames})
export const createWotReact = (payload: {
  readonly reaction: RPCTypes.WotReactionType
  readonly voucher: string
  readonly sigID: string
  readonly fromModal?: boolean
}) => ({payload, type: wotReact as typeof wotReact})

// Action Payloads
export type GetBioPayload = ReturnType<typeof createGetBio>
export type GetBlockStatePayload = ReturnType<typeof createGetBlockState>
export type ReportUserPayload = ReturnType<typeof createReportUser>
export type SetUserBlocksPayload = ReturnType<typeof createSetUserBlocks>
export type SubmitRevokeVouchPayload = ReturnType<typeof createSubmitRevokeVouch>
export type UpdateBioPayload = ReturnType<typeof createUpdateBio>
export type UpdateBlockStatePayload = ReturnType<typeof createUpdateBlockState>
export type UpdateBrokenStatePayload = ReturnType<typeof createUpdateBrokenState>
export type UpdateFullnamesPayload = ReturnType<typeof createUpdateFullnames>
export type WotReactPayload = ReturnType<typeof createWotReact>

// All Actions
// prettier-ignore
export type Actions =
  | GetBioPayload
  | GetBlockStatePayload
  | ReportUserPayload
  | SetUserBlocksPayload
  | SubmitRevokeVouchPayload
  | UpdateBioPayload
  | UpdateBlockStatePayload
  | UpdateBrokenStatePayload
  | UpdateFullnamesPayload
  | WotReactPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
