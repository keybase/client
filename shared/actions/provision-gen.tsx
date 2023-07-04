// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

// Constants
export const resetStore = 'common:resetStore' // not a part of provision but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'provision:'
export const backToDeviceList = 'provision:backToDeviceList'
export const forgotUsername = 'provision:forgotUsername'
export const forgotUsernameResult = 'provision:forgotUsernameResult'
export const provisionDone = 'provision:provisionDone'

// Action Creators
/**
 * We're no longer holding an open provisioning session; it is safe to start another.
 */
export const createProvisionDone = (payload?: undefined) => ({
  payload,
  type: provisionDone as typeof provisionDone,
})
export const createBackToDeviceList = (payload: {readonly username: string}) => ({
  payload,
  type: backToDeviceList as typeof backToDeviceList,
})
export const createForgotUsername = (payload: {readonly email?: string; readonly phone?: string} = {}) => ({
  payload,
  type: forgotUsername as typeof forgotUsername,
})
export const createForgotUsernameResult = (payload: {readonly result: string}) => ({
  payload,
  type: forgotUsernameResult as typeof forgotUsernameResult,
})

// Action Payloads
export type BackToDeviceListPayload = ReturnType<typeof createBackToDeviceList>
export type ForgotUsernamePayload = ReturnType<typeof createForgotUsername>
export type ForgotUsernameResultPayload = ReturnType<typeof createForgotUsernameResult>
export type ProvisionDonePayload = ReturnType<typeof createProvisionDone>

// All Actions
// prettier-ignore
export type Actions =
  | BackToDeviceListPayload
  | ForgotUsernamePayload
  | ForgotUsernameResultPayload
  | ProvisionDonePayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
