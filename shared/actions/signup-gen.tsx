// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import type HiddenString from '../util/hidden-string'
import type {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassword = 'signup:checkPassword'
export const checkUsername = 'signup:checkUsername'
export const checkedDevicename = 'signup:checkedDevicename'
export const checkedInviteCode = 'signup:checkedInviteCode'
export const checkedUsername = 'signup:checkedUsername'
export const clearJustSignedUpEmail = 'signup:clearJustSignedUpEmail'
export const goBackAndClearErrors = 'signup:goBackAndClearErrors'
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestedAutoInvite = 'signup:requestedAutoInvite'
export const requestedInvite = 'signup:requestedInvite'
export const restartSignup = 'signup:restartSignup'
export const setJustSignedUpEmail = 'signup:setJustSignedUpEmail'
export const signedup = 'signup:signedup'

// Action Creators
export const createCheckDevicename = (payload: {readonly devicename: string}) => ({
  payload,
  type: checkDevicename as typeof checkDevicename,
})
export const createCheckInviteCode = (payload: {readonly inviteCode: string}) => ({
  payload,
  type: checkInviteCode as typeof checkInviteCode,
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
export const createCheckedInviteCode = (payload: {readonly inviteCode: string; readonly error?: string}) => ({
  payload,
  type: checkedInviteCode as typeof checkedInviteCode,
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
export const createGoBackAndClearErrors = (payload?: undefined) => ({
  payload,
  type: goBackAndClearErrors as typeof goBackAndClearErrors,
})
export const createRequestAutoInvite = (payload: {readonly username?: string} = {}) => ({
  payload,
  type: requestAutoInvite as typeof requestAutoInvite,
})
export const createRequestInvite = (payload: {readonly email: string; readonly name: string}) => ({
  payload,
  type: requestInvite as typeof requestInvite,
})
export const createRequestedAutoInvite = (
  payload: {readonly inviteCode?: string; readonly error?: boolean} = {}
) => ({payload, type: requestedAutoInvite as typeof requestedAutoInvite})
export const createRequestedInvite = (payload: {
  readonly email: string
  readonly name: string
  readonly emailError?: string
  readonly nameError?: string
}) => ({payload, type: requestedInvite as typeof requestedInvite})
export const createRestartSignup = (payload?: undefined) => ({
  payload,
  type: restartSignup as typeof restartSignup,
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
export type CheckInviteCodePayload = ReturnType<typeof createCheckInviteCode>
export type CheckPasswordPayload = ReturnType<typeof createCheckPassword>
export type CheckUsernamePayload = ReturnType<typeof createCheckUsername>
export type CheckedDevicenamePayload = ReturnType<typeof createCheckedDevicename>
export type CheckedInviteCodePayload = ReturnType<typeof createCheckedInviteCode>
export type CheckedUsernamePayload = ReturnType<typeof createCheckedUsername>
export type ClearJustSignedUpEmailPayload = ReturnType<typeof createClearJustSignedUpEmail>
export type GoBackAndClearErrorsPayload = ReturnType<typeof createGoBackAndClearErrors>
export type RequestAutoInvitePayload = ReturnType<typeof createRequestAutoInvite>
export type RequestInvitePayload = ReturnType<typeof createRequestInvite>
export type RequestedAutoInvitePayload = ReturnType<typeof createRequestedAutoInvite>
export type RequestedInvitePayload = ReturnType<typeof createRequestedInvite>
export type RestartSignupPayload = ReturnType<typeof createRestartSignup>
export type SetJustSignedUpEmailPayload = ReturnType<typeof createSetJustSignedUpEmail>
export type SignedupPayload = ReturnType<typeof createSignedup>

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckInviteCodePayload
  | CheckPasswordPayload
  | CheckUsernamePayload
  | CheckedDevicenamePayload
  | CheckedInviteCodePayload
  | CheckedUsernamePayload
  | ClearJustSignedUpEmailPayload
  | GoBackAndClearErrorsPayload
  | RequestAutoInvitePayload
  | RequestInvitePayload
  | RequestedAutoInvitePayload
  | RequestedInvitePayload
  | RestartSignupPayload
  | SetJustSignedUpEmailPayload
  | SignedupPayload
  | {readonly type: 'common:resetStore', readonly payload: undefined}
