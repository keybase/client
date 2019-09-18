// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of autoreset but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'autoreset:'
export const cancelReset = 'autoreset:cancelReset'
export const resetCancelled = 'autoreset:resetCancelled'

// Payload Types
type _CancelResetPayload = void
type _ResetCancelledPayload = void

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

// Action Payloads
export type CancelResetPayload = {readonly payload: _CancelResetPayload; readonly type: typeof cancelReset}
export type ResetCancelledPayload = {
  readonly payload: _ResetCancelledPayload
  readonly type: typeof resetCancelled
}

// All Actions
// prettier-ignore
export type Actions =
  | CancelResetPayload
  | ResetCancelledPayload
  | {type: 'common:resetStore', payload: {}}
