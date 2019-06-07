// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassword = 'signup:checkPassword'
export const checkUsername = 'signup:checkUsername'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
export const checkedDevicename = 'signup:checkedDevicename'
export const checkedInviteCode = 'signup:checkedInviteCode'
export const checkedUsername = 'signup:checkedUsername'
export const checkedUsernameEmail = 'signup:checkedUsernameEmail'
export const goBackAndClearErrors = 'signup:goBackAndClearErrors'
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestedAutoInvite = 'signup:requestedAutoInvite'
export const requestedInvite = 'signup:requestedInvite'
export const restartSignup = 'signup:restartSignup'
export const signedup = 'signup:signedup'

// Payload Types
type _CheckDevicenamePayload = {readonly devicename: string}
type _CheckInviteCodePayload = {readonly inviteCode: string}
type _CheckPasswordPayload = {readonly pass1: HiddenString; readonly pass2: HiddenString}
type _CheckUsernameEmailPayload = {readonly username: string; readonly email: string}
type _CheckUsernamePayload = {readonly username: string}
type _CheckedDevicenamePayload = {readonly devicename: string}
type _CheckedDevicenamePayloadError = {readonly devicename: string; readonly error: string}
type _CheckedInviteCodePayload = {readonly inviteCode: string}
type _CheckedInviteCodePayloadError = {readonly inviteCode: string; readonly error: string}
type _CheckedUsernameEmailPayload = {readonly username: string; readonly email: string}
type _CheckedUsernameEmailPayloadError = {
  readonly emailError: string
  readonly usernameError: string
  readonly email: string
  readonly username: string
}
type _CheckedUsernamePayload = {
  readonly username: string
  readonly usernameTaken?: string
  readonly error: string
}
type _GoBackAndClearErrorsPayload = void
type _RequestAutoInvitePayload = void
type _RequestInvitePayload = {readonly email: string; readonly name: string}
type _RequestedAutoInvitePayload = {readonly inviteCode: string}
type _RequestedAutoInvitePayloadError = void
type _RequestedInvitePayload = {readonly email: string; readonly name: string}
type _RequestedInvitePayloadError = {
  readonly emailError: string
  readonly nameError: string
  readonly email: string
  readonly name: string
}
type _RestartSignupPayload = void
type _SignedupPayload = void
type _SignedupPayloadError = {readonly error: HiddenString}

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
export const createCheckUsernameEmail = (payload: _CheckUsernameEmailPayload): CheckUsernameEmailPayload => ({
  payload,
  type: checkUsernameEmail,
})
export const createCheckedDevicename = (payload: _CheckedDevicenamePayload): CheckedDevicenamePayload => ({
  payload,
  type: checkedDevicename,
})
export const createCheckedDevicenameError = (
  payload: _CheckedDevicenamePayloadError
): CheckedDevicenamePayloadError => ({error: true, payload, type: checkedDevicename})
export const createCheckedInviteCode = (payload: _CheckedInviteCodePayload): CheckedInviteCodePayload => ({
  payload,
  type: checkedInviteCode,
})
export const createCheckedInviteCodeError = (
  payload: _CheckedInviteCodePayloadError
): CheckedInviteCodePayloadError => ({error: true, payload, type: checkedInviteCode})
export const createCheckedUsername = (payload: _CheckedUsernamePayload): CheckedUsernamePayload => ({
  payload,
  type: checkedUsername,
})
export const createCheckedUsernameEmail = (
  payload: _CheckedUsernameEmailPayload
): CheckedUsernameEmailPayload => ({payload, type: checkedUsernameEmail})
export const createCheckedUsernameEmailError = (
  payload: _CheckedUsernameEmailPayloadError
): CheckedUsernameEmailPayloadError => ({error: true, payload, type: checkedUsernameEmail})
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
  payload: _RequestedAutoInvitePayload
): RequestedAutoInvitePayload => ({payload, type: requestedAutoInvite})
export const createRequestedAutoInviteError = (
  payload: _RequestedAutoInvitePayloadError
): RequestedAutoInvitePayloadError => ({error: true, payload, type: requestedAutoInvite})
export const createRequestedInvite = (payload: _RequestedInvitePayload): RequestedInvitePayload => ({
  payload,
  type: requestedInvite,
})
export const createRequestedInviteError = (
  payload: _RequestedInvitePayloadError
): RequestedInvitePayloadError => ({error: true, payload, type: requestedInvite})
export const createRestartSignup = (payload: _RestartSignupPayload): RestartSignupPayload => ({
  payload,
  type: restartSignup,
})
export const createSignedup = (payload: _SignedupPayload): SignedupPayload => ({payload, type: signedup})
export const createSignedupError = (payload: _SignedupPayloadError): SignedupPayloadError => ({
  error: true,
  payload,
  type: signedup,
})

// Action Payloads
export type CheckDevicenamePayload = {
  readonly payload: _CheckDevicenamePayload
  readonly type: 'signup:checkDevicename'
}
export type CheckInviteCodePayload = {
  readonly payload: _CheckInviteCodePayload
  readonly type: 'signup:checkInviteCode'
}
export type CheckPasswordPayload = {
  readonly payload: _CheckPasswordPayload
  readonly type: 'signup:checkPassword'
}
export type CheckUsernameEmailPayload = {
  readonly payload: _CheckUsernameEmailPayload
  readonly type: 'signup:checkUsernameEmail'
}
export type CheckUsernamePayload = {
  readonly payload: _CheckUsernamePayload
  readonly type: 'signup:checkUsername'
}
export type CheckedDevicenamePayload = {
  readonly payload: _CheckedDevicenamePayload
  readonly type: 'signup:checkedDevicename'
}
export type CheckedDevicenamePayloadError = {
  readonly error: true
  readonly payload: _CheckedDevicenamePayloadError
  readonly type: 'signup:checkedDevicename'
}
export type CheckedInviteCodePayload = {
  readonly payload: _CheckedInviteCodePayload
  readonly type: 'signup:checkedInviteCode'
}
export type CheckedInviteCodePayloadError = {
  readonly error: true
  readonly payload: _CheckedInviteCodePayloadError
  readonly type: 'signup:checkedInviteCode'
}
export type CheckedUsernameEmailPayload = {
  readonly payload: _CheckedUsernameEmailPayload
  readonly type: 'signup:checkedUsernameEmail'
}
export type CheckedUsernameEmailPayloadError = {
  readonly error: true
  readonly payload: _CheckedUsernameEmailPayloadError
  readonly type: 'signup:checkedUsernameEmail'
}
export type CheckedUsernamePayload = {
  readonly payload: _CheckedUsernamePayload
  readonly type: 'signup:checkedUsername'
}
export type GoBackAndClearErrorsPayload = {
  readonly payload: _GoBackAndClearErrorsPayload
  readonly type: 'signup:goBackAndClearErrors'
}
export type RequestAutoInvitePayload = {
  readonly payload: _RequestAutoInvitePayload
  readonly type: 'signup:requestAutoInvite'
}
export type RequestInvitePayload = {
  readonly payload: _RequestInvitePayload
  readonly type: 'signup:requestInvite'
}
export type RequestedAutoInvitePayload = {
  readonly payload: _RequestedAutoInvitePayload
  readonly type: 'signup:requestedAutoInvite'
}
export type RequestedAutoInvitePayloadError = {
  readonly error: true
  readonly payload: _RequestedAutoInvitePayloadError
  readonly type: 'signup:requestedAutoInvite'
}
export type RequestedInvitePayload = {
  readonly payload: _RequestedInvitePayload
  readonly type: 'signup:requestedInvite'
}
export type RequestedInvitePayloadError = {
  readonly error: true
  readonly payload: _RequestedInvitePayloadError
  readonly type: 'signup:requestedInvite'
}
export type RestartSignupPayload = {
  readonly payload: _RestartSignupPayload
  readonly type: 'signup:restartSignup'
}
export type SignedupPayload = {readonly payload: _SignedupPayload; readonly type: 'signup:signedup'}
export type SignedupPayloadError = {
  readonly error: true
  readonly payload: _SignedupPayloadError
  readonly type: 'signup:signedup'
}

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckInviteCodePayload
  | CheckPasswordPayload
  | CheckUsernameEmailPayload
  | CheckUsernamePayload
  | CheckedDevicenamePayload
  | CheckedDevicenamePayloadError
  | CheckedInviteCodePayload
  | CheckedInviteCodePayloadError
  | CheckedUsernameEmailPayload
  | CheckedUsernameEmailPayloadError
  | CheckedUsernamePayload
  | GoBackAndClearErrorsPayload
  | RequestAutoInvitePayload
  | RequestInvitePayload
  | RequestedAutoInvitePayload
  | RequestedAutoInvitePayloadError
  | RequestedInvitePayload
  | RequestedInvitePayloadError
  | RestartSignupPayload
  | SignedupPayload
  | SignedupPayloadError
  | {type: 'common:resetStore', payload: null}
