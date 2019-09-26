// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of autoreset but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'autoreset:'
export const resetAccount = 'autoreset:resetAccount'
export const resetError = 'autoreset:resetError'
export const setUsername = 'autoreset:setUsername'
export const startAccountReset = 'autoreset:startAccountReset'
export const submittedReset = 'autoreset:submittedReset'

// Payload Types
type _ResetAccountPayload = {readonly password?: HiddenString; readonly phoneNumberOrEmail?: string}
type _ResetErrorPayload = {readonly error: RPCError}
type _SetUsernamePayload = {readonly username: string}
type _StartAccountResetPayload = {readonly skipPassword: boolean; readonly username?: string}
type _SubmittedResetPayload = {readonly checkEmail: boolean}

// Action Creators
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

// Action Payloads
export type ResetAccountPayload = {readonly payload: _ResetAccountPayload; readonly type: typeof resetAccount}
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

// All Actions
// prettier-ignore
export type Actions =
  | ResetAccountPayload
  | ResetErrorPayload
  | SetUsernamePayload
  | StartAccountResetPayload
  | SubmittedResetPayload
  | {type: 'common:resetStore', payload: {}}
