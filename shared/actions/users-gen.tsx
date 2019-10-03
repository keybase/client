// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import * as RPCTypes from '../constants/types/rpc-gen'

// Constants
export const resetStore = 'common:resetStore' // not a part of users but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'users:'
export const blockUser = 'users:blockUser'
export const updateBio = 'users:updateBio'
export const updateBrokenState = 'users:updateBrokenState'
export const updateFullnames = 'users:updateFullnames'

// Payload Types
type _BlockUserPayload = {readonly username: string}
type _UpdateBioPayload = {readonly userCard: RPCTypes.UserCard; readonly username: string}
type _UpdateBrokenStatePayload = {readonly newlyBroken: Array<string>; readonly newlyFixed: Array<string>}
type _UpdateFullnamesPayload = {readonly usernameToFullname: {[username: string]: string}}

// Action Creators
/**
 * Sets user bio for use in one-on-one conversations
 */
export const createUpdateBio = (payload: _UpdateBioPayload): UpdateBioPayload => ({payload, type: updateBio})
export const createBlockUser = (payload: _BlockUserPayload): BlockUserPayload => ({payload, type: blockUser})
export const createUpdateBrokenState = (payload: _UpdateBrokenStatePayload): UpdateBrokenStatePayload => ({
  payload,
  type: updateBrokenState,
})
export const createUpdateFullnames = (payload: _UpdateFullnamesPayload): UpdateFullnamesPayload => ({
  payload,
  type: updateFullnames,
})

// Action Payloads
export type BlockUserPayload = {readonly payload: _BlockUserPayload; readonly type: typeof blockUser}
export type UpdateBioPayload = {readonly payload: _UpdateBioPayload; readonly type: typeof updateBio}
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
  | BlockUserPayload
  | UpdateBioPayload
  | UpdateBrokenStatePayload
  | UpdateFullnamesPayload
  | {type: 'common:resetStore', payload: {}}
