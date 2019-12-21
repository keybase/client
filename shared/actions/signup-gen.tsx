// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

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

// Payload Types
type _CheckDevicenamePayload = {readonly devicename: string}
type _CheckInviteCodePayload = {readonly inviteCode: string}
type _CheckPasswordPayload = {readonly pass1: HiddenString; readonly pass2: HiddenString}
type _CheckUsernamePayload = {readonly username: string}
type _CheckedDevicenamePayload = {readonly devicename: string; readonly error?: string}
type _CheckedInviteCodePayload = {readonly inviteCode: string; readonly error?: string}
type _CheckedUsernamePayload = {
  readonly username: string
  readonly usernameTaken?: string
  readonly error: string
}
type _ClearJustSignedUpEmailPayload = void
type _GoBackAndClearErrorsPayload = void
type _RequestAutoInvitePayload = void
type _RequestInvitePayload = {readonly email: string; readonly name: string}
type _RequestedAutoInvitePayload = {readonly inviteCode?: string; readonly error?: boolean}
type _RequestedInvitePayload = {
  readonly email: string
  readonly name: string
  readonly emailError?: string
  readonly nameError?: string
}
type _RestartSignupPayload = void
type _SetJustSignedUpEmailPayload = {readonly email: string}
type _SignedupPayload = {readonly error?: RPCError}

// Action Creators
export const createCheckDevicename = (payload: _CheckDevicenamePayload): CheckDevicenamePayload => ({
  payload,
  type: checkDevicename,
})
export const createCheckInviteCode = (payload: _CheckInviteCodePayload): CheckInviteCodePayload => ({
  payload,
  type: checkInviteCode,
})
export const createCheckPassword = (payload: _CheckPasswordPayload): CheckPasswordPayload => ({
  payload,
  type: checkPassword,
})
export const createCheckUsername = (payload: _CheckUsernamePayload): CheckUsernamePayload => ({
  payload,
  type: checkUsername,
})
export const createCheckedDevicename = (payload: _CheckedDevicenamePayload): CheckedDevicenamePayload => ({
  payload,
  type: checkedDevicename,
})
export const createCheckedInviteCode = (payload: _CheckedInviteCodePayload): CheckedInviteCodePayload => ({
  payload,
  type: checkedInviteCode,
})
export const createCheckedUsername = (payload: _CheckedUsernamePayload): CheckedUsernamePayload => ({
  payload,
  type: checkedUsername,
})
export const createClearJustSignedUpEmail = (
  payload: _ClearJustSignedUpEmailPayload
): ClearJustSignedUpEmailPayload => ({payload, type: clearJustSignedUpEmail})
export const createGoBackAndClearErrors = (
  payload: _GoBackAndClearErrorsPayload
): GoBackAndClearErrorsPayload => ({payload, type: goBackAndClearErrors})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload): RequestAutoInvitePayload => ({
  payload,
  type: requestAutoInvite,
})
export const createRequestInvite = (payload: _RequestInvitePayload): RequestInvitePayload => ({
  payload,
  type: requestInvite,
})
export const createRequestedAutoInvite = (
  payload: _RequestedAutoInvitePayload = Object.freeze({})
): RequestedAutoInvitePayload => ({payload, type: requestedAutoInvite})
export const createRequestedInvite = (payload: _RequestedInvitePayload): RequestedInvitePayload => ({
  payload,
  type: requestedInvite,
})
export const createRestartSignup = (payload: _RestartSignupPayload): RestartSignupPayload => ({
  payload,
  type: restartSignup,
})
export const createSetJustSignedUpEmail = (
  payload: _SetJustSignedUpEmailPayload
): SetJustSignedUpEmailPayload => ({payload, type: setJustSignedUpEmail})
export const createSignedup = (payload: _SignedupPayload = Object.freeze({})): SignedupPayload => ({
  payload,
  type: signedup,
})

// Action Payloads
export type CheckDevicenamePayload = {
  readonly payload: _CheckDevicenamePayload
  readonly type: typeof checkDevicename
}
export type CheckInviteCodePayload = {
  readonly payload: _CheckInviteCodePayload
  readonly type: typeof checkInviteCode
}
export type CheckPasswordPayload = {
  readonly payload: _CheckPasswordPayload
  readonly type: typeof checkPassword
}
export type CheckUsernamePayload = {
  readonly payload: _CheckUsernamePayload
  readonly type: typeof checkUsername
}
export type CheckedDevicenamePayload = {
  readonly payload: _CheckedDevicenamePayload
  readonly type: typeof checkedDevicename
}
export type CheckedInviteCodePayload = {
  readonly payload: _CheckedInviteCodePayload
  readonly type: typeof checkedInviteCode
}
export type CheckedUsernamePayload = {
  readonly payload: _CheckedUsernamePayload
  readonly type: typeof checkedUsername
}
export type ClearJustSignedUpEmailPayload = {
  readonly payload: _ClearJustSignedUpEmailPayload
  readonly type: typeof clearJustSignedUpEmail
}
export type GoBackAndClearErrorsPayload = {
  readonly payload: _GoBackAndClearErrorsPayload
  readonly type: typeof goBackAndClearErrors
}
export type RequestAutoInvitePayload = {
  readonly payload: _RequestAutoInvitePayload
  readonly type: typeof requestAutoInvite
}
export type RequestInvitePayload = {
  readonly payload: _RequestInvitePayload
  readonly type: typeof requestInvite
}
export type RequestedAutoInvitePayload = {
  readonly payload: _RequestedAutoInvitePayload
  readonly type: typeof requestedAutoInvite
}
export type RequestedInvitePayload = {
  readonly payload: _RequestedInvitePayload
  readonly type: typeof requestedInvite
}
export type RestartSignupPayload = {
  readonly payload: _RestartSignupPayload
  readonly type: typeof restartSignup
}
export type SetJustSignedUpEmailPayload = {
  readonly payload: _SetJustSignedUpEmailPayload
  readonly type: typeof setJustSignedUpEmail
}
export type SignedupPayload = {readonly payload: _SignedupPayload; readonly type: typeof signedup}

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
  | {type: 'common:resetStore', payload: {}}
