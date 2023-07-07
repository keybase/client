// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkPassword = 'signup:checkPassword'
export const checkUsername = 'signup:checkUsername'
export const checkedDevicename = 'signup:checkedDevicename'
export const checkedUsername = 'signup:checkedUsername'
export const clearJustSignedUpEmail = 'signup:clearJustSignedUpEmail'
export const setJustSignedUpEmail = 'signup:setJustSignedUpEmail'
export const signedup = 'signup:signedup'

// Action Creators
export const createCheckDevicename = (payload: {readonly devicename: string}) => ({
  payload,
  type: checkDevicename as typeof checkDevicename,
})
export const createCheckPassword = (payload: {
  readonly pass1: HiddenString
  readonly pass2: HiddenString
}) => ({payload, type: checkPassword as typeof checkPassword})
export const createCheckUsername = (payload: {readonly username: string}) => ({
  payload,
  type: checkUsername as typeof checkUsername,
})
export const createCheckedDevicename = (payload: {readonly devicename: string; readonly error?: string}) => ({
  payload,
  type: checkedDevicename as typeof checkedDevicename,
})
export const createCheckedUsername = (payload: {
  readonly username: string
  readonly usernameTaken?: string
  readonly error: string
}) => ({payload, type: checkedUsername as typeof checkedUsername})
export const createClearJustSignedUpEmail = (payload?: undefined) => ({
  payload,
  type: clearJustSignedUpEmail as typeof clearJustSignedUpEmail,
})
export const createSetJustSignedUpEmail = (payload: {readonly email: string}) => ({
  payload,
  type: setJustSignedUpEmail as typeof setJustSignedUpEmail,
})
export const createSignedup = (payload: {readonly error?: RPCError} = {}) => ({
  payload,
  type: signedup as typeof signedup,
})

// Action Payloads
export type CheckDevicenamePayload = ReturnType<typeof createCheckDevicename>
export type CheckPasswordPayload = ReturnType<typeof createCheckPassword>
export type CheckUsernamePayload = ReturnType<typeof createCheckUsername>
export type CheckedDevicenamePayload = ReturnType<typeof createCheckedDevicename>
export type CheckedUsernamePayload = ReturnType<typeof createCheckedUsername>
export type ClearJustSignedUpEmailPayload = ReturnType<typeof createClearJustSignedUpEmail>
export type SetJustSignedUpEmailPayload = ReturnType<typeof createSetJustSignedUpEmail>
export type SignedupPayload = ReturnType<typeof createSignedup>

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckPasswordPayload
  | CheckUsernamePayload
  | CheckedDevicenamePayload
  | CheckedUsernamePayload
  | ClearJustSignedUpEmailPayload
  | SetJustSignedUpEmailPayload
  | SignedupPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
