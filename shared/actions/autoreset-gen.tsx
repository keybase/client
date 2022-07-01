// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of autoreset but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'autoreset:'
export const cancelReset = 'autoreset:cancelReset'
export const displayProgress = 'autoreset:displayProgress'
export const finishedReset = 'autoreset:finishedReset'
export const resetAccount = 'autoreset:resetAccount'
export const resetCancelled = 'autoreset:resetCancelled'
export const resetError = 'autoreset:resetError'
export const setUsername = 'autoreset:setUsername'
export const showFinalResetScreen = 'autoreset:showFinalResetScreen'
export const startAccountReset = 'autoreset:startAccountReset'
export const submittedReset = 'autoreset:submittedReset'
export const updateAutoresetState = 'autoreset:updateAutoresetState'

// Action Creators
/**
 * Cancel an autoreset for the currently logged-in account. Don't use with a temporary (web) session
 */
export const createCancelReset = (payload?: undefined) => ({payload, type: cancelReset as typeof cancelReset})
/**
 * Cancelled an account reset.
 */
export const createResetCancelled = (payload?: undefined) => ({
  payload,
  type: resetCancelled as typeof resetCancelled,
})
/**
 * Show the screen where the user chooses whether to actually reset their account or cancel out
 */
export const createShowFinalResetScreen = (payload: {readonly hasWallet: boolean}) => ({
  payload,
  type: showFinalResetScreen as typeof showFinalResetScreen,
})
/**
 * Start the account reset process in the GUI.
 */
export const createStartAccountReset = (payload: {
  readonly skipPassword: boolean
  readonly username?: string
}) => ({payload, type: startAccountReset as typeof startAccountReset})
/**
 * Tell the server to put an account into the reset pipeline.
 * If no password is provided, the user will need to click a confirmation link in an email or text.
 */
export const createResetAccount = (payload: {readonly password?: HiddenString} = {}) => ({
  payload,
  type: resetAccount as typeof resetAccount,
})
export const createDisplayProgress = (payload: {readonly endTime: number; readonly needVerify: boolean}) => ({
  payload,
  type: displayProgress as typeof displayProgress,
})
export const createFinishedReset = (payload?: undefined) => ({
  payload,
  type: finishedReset as typeof finishedReset,
})
export const createResetError = (payload: {readonly error: RPCError}) => ({
  payload,
  type: resetError as typeof resetError,
})
export const createSetUsername = (payload: {readonly username: string}) => ({
  payload,
  type: setUsername as typeof setUsername,
})
export const createSubmittedReset = (payload: {readonly checkEmail: boolean}) => ({
  payload,
  type: submittedReset as typeof submittedReset,
})
export const createUpdateAutoresetState = (payload: {
  readonly active: boolean
  readonly endTime: number
}) => ({payload, type: updateAutoresetState as typeof updateAutoresetState})

// Action Payloads
export type CancelResetPayload = ReturnType<typeof createCancelReset>
export type DisplayProgressPayload = ReturnType<typeof createDisplayProgress>
export type FinishedResetPayload = ReturnType<typeof createFinishedReset>
export type ResetAccountPayload = ReturnType<typeof createResetAccount>
export type ResetCancelledPayload = ReturnType<typeof createResetCancelled>
export type ResetErrorPayload = ReturnType<typeof createResetError>
export type SetUsernamePayload = ReturnType<typeof createSetUsername>
export type ShowFinalResetScreenPayload = ReturnType<typeof createShowFinalResetScreen>
export type StartAccountResetPayload = ReturnType<typeof createStartAccountReset>
export type SubmittedResetPayload = ReturnType<typeof createSubmittedReset>
export type UpdateAutoresetStatePayload = ReturnType<typeof createUpdateAutoresetState>

// All Actions
// prettier-ignore
export type Actions =
  | CancelResetPayload
  | DisplayProgressPayload
  | FinishedResetPayload
  | ResetAccountPayload
  | ResetCancelledPayload
  | ResetErrorPayload
  | SetUsernamePayload
  | ShowFinalResetScreenPayload
  | StartAccountResetPayload
  | SubmittedResetPayload
  | UpdateAutoresetStatePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
