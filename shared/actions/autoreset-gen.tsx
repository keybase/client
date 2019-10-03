// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of autoreset but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'autoreset:'
export const cancelReset = 'autoreset:cancelReset'
export const resetAccount = 'autoreset:resetAccount'
export const resetCancelled = 'autoreset:resetCancelled'
export const resetError = 'autoreset:resetError'
export const setUsername = 'autoreset:setUsername'
export const startAccountReset = 'autoreset:startAccountReset'
export const submittedReset = 'autoreset:submittedReset'
export const updateAutoresetState = 'autoreset:updateAutoresetState'

// Payload Types
type _CancelResetPayload = void
type _ResetAccountPayload = {readonly password?: HiddenString}
type _ResetCancelledPayload = void
type _ResetErrorPayload = {readonly error: RPCError}
type _SetUsernamePayload = {readonly username: string}
type _StartAccountResetPayload = {readonly skipPassword: boolean; readonly username?: string}
type _SubmittedResetPayload = {readonly checkEmail: boolean}
type _UpdateAutoresetStatePayload = {readonly active: boolean; readonly endTime: number}

// Action Creators
/**
 * Cancel an autoreset for the currently logged-in account.
 */
export const createCancelReset = (payload: _CancelResetPayload): CancelResetPayload => ({
  payload,
  type: cancelReset,
})
/**
 * Cancelled an account reset.
 */
export const createResetCancelled = (payload: _ResetCancelledPayload): ResetCancelledPayload => ({
  payload,
  type: resetCancelled,
})
export const createResetAccount = (
  payload: _ResetAccountPayload = Object.freeze({})
): ResetAccountPayload => ({payload, type: resetAccount})
export const createResetError = (payload: _ResetErrorPayload): ResetErrorPayload => ({
  payload,
  type: resetError,
})
export const createSetUsername = (payload: _SetUsernamePayload): SetUsernamePayload => ({
  payload,
  type: setUsername,
})
export const createStartAccountReset = (payload: _StartAccountResetPayload): StartAccountResetPayload => ({
  payload,
  type: startAccountReset,
})
export const createSubmittedReset = (payload: _SubmittedResetPayload): SubmittedResetPayload => ({
  payload,
  type: submittedReset,
})
export const createUpdateAutoresetState = (
  payload: _UpdateAutoresetStatePayload
): UpdateAutoresetStatePayload => ({payload, type: updateAutoresetState})

// Action Payloads
export type CancelResetPayload = {readonly payload: _CancelResetPayload; readonly type: typeof cancelReset}
export type ResetAccountPayload = {readonly payload: _ResetAccountPayload; readonly type: typeof resetAccount}
export type ResetCancelledPayload = {
  readonly payload: _ResetCancelledPayload
  readonly type: typeof resetCancelled
}
export type ResetErrorPayload = {readonly payload: _ResetErrorPayload; readonly type: typeof resetError}
export type SetUsernamePayload = {readonly payload: _SetUsernamePayload; readonly type: typeof setUsername}
export type StartAccountResetPayload = {
  readonly payload: _StartAccountResetPayload
  readonly type: typeof startAccountReset
}
export type SubmittedResetPayload = {
  readonly payload: _SubmittedResetPayload
  readonly type: typeof submittedReset
}
export type UpdateAutoresetStatePayload = {
  readonly payload: _UpdateAutoresetStatePayload
  readonly type: typeof updateAutoresetState
}

// All Actions
// prettier-ignore
export type Actions =
  | CancelResetPayload
  | ResetAccountPayload
  | ResetCancelledPayload
  | ResetErrorPayload
  | SetUsernamePayload
  | StartAccountResetPayload
  | SubmittedResetPayload
  | UpdateAutoresetStatePayload
  | {type: 'common:resetStore', payload: {}}
