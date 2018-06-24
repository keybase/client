// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer
export const checkInviteCode = 'signup:checkInviteCode'
export const checkInviteCodeDone = 'signup:checkInviteCodeDone'
export const checkPassphrase = 'signup:checkPassphrase'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
export const checkUsernameEmailDone = 'signup:checkUsernameEmailDone'
export const clearDeviceNameError = 'signup:clearDeviceNameError'
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestInviteDone = 'signup:requestInviteDone'
export const resetSignup = 'signup:resetSignup'
export const restartSignup = 'signup:restartSignup'
export const setDeviceNameError = 'signup:setDeviceNameError'
export const signupError = 'signup:signupError'
export const submitDeviceName = 'signup:submitDeviceName'

// Payload Types
type _CheckInviteCodeDonePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckInviteCodeDonePayloadError = $ReadOnly<{|errorText: string|}>
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _CheckPassphrasePayloadError = $ReadOnly<{|passphraseError: HiddenString|}>
type _CheckUsernameEmailDonePayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _CheckUsernameEmailDonePayloadError = $ReadOnly<{|
  emailError: string,
  usernameError: string,
  email: string,
  username: string,
|}>
type _CheckUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _ClearDeviceNameErrorPayload = void
type _RequestAutoInvitePayload = void
type _RequestInviteDonePayload = $ReadOnly<{|
  email: string,
  name: string,
|}>
type _RequestInviteDonePayloadError = $ReadOnly<{|
  emailError: string,
  nameError: string,
  email: string,
  name: string,
|}>
type _RequestInvitePayload = $ReadOnly<{|
  email: string,
  name: string,
|}>
type _ResetSignupPayload = void
type _RestartSignupPayload = void
type _SetDeviceNameErrorPayload = $ReadOnly<{|deviceNameError: string|}>
type _SignupErrorPayload = $ReadOnly<{|signupError: HiddenString|}>
type _SubmitDeviceNamePayload = $ReadOnly<{|deviceName: string|}>
type _SubmitDeviceNamePayloadError = $ReadOnly<{|deviceNameError: string|}>

// Action Creators
/**
 * We heard back from the server
 */
export const createCheckUsernameEmailDone = (payload: _CheckUsernameEmailDonePayload) => ({error: false, payload, type: checkUsernameEmailDone})
export const createCheckUsernameEmailDoneError = (payload: _CheckUsernameEmailDonePayloadError) => ({error: true, payload, type: checkUsernameEmailDone})
/**
 * We want to valid a user/email
 */
export const createCheckUsernameEmail = (payload: _CheckUsernameEmailPayload) => ({error: false, payload, type: checkUsernameEmail})
export const createCheckInviteCode = (payload: _CheckInviteCodePayload) => ({error: false, payload, type: checkInviteCode})
export const createCheckInviteCodeDone = (payload: _CheckInviteCodeDonePayload) => ({error: false, payload, type: checkInviteCodeDone})
export const createCheckInviteCodeDoneError = (payload: _CheckInviteCodeDonePayloadError) => ({error: true, payload, type: checkInviteCodeDone})
export const createCheckPassphrase = (payload: _CheckPassphrasePayload) => ({error: false, payload, type: checkPassphrase})
export const createCheckPassphraseError = (payload: _CheckPassphrasePayloadError) => ({error: true, payload, type: checkPassphrase})
export const createClearDeviceNameError = (payload: _ClearDeviceNameErrorPayload) => ({error: false, payload, type: clearDeviceNameError})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload) => ({error: false, payload, type: requestAutoInvite})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({error: false, payload, type: requestInvite})
export const createRequestInviteDone = (payload: _RequestInviteDonePayload) => ({error: false, payload, type: requestInviteDone})
export const createRequestInviteDoneError = (payload: _RequestInviteDonePayloadError) => ({error: true, payload, type: requestInviteDone})
export const createResetSignup = (payload: _ResetSignupPayload) => ({error: false, payload, type: resetSignup})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({error: false, payload, type: restartSignup})
export const createSetDeviceNameError = (payload: _SetDeviceNameErrorPayload) => ({error: false, payload, type: setDeviceNameError})
export const createSignupError = (payload: _SignupErrorPayload) => ({error: false, payload, type: signupError})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({error: false, payload, type: submitDeviceName})
export const createSubmitDeviceNameError = (payload: _SubmitDeviceNamePayloadError) => ({error: true, payload, type: submitDeviceName})

// Action Payloads
export type CheckInviteCodeDonePayload = $Call<typeof createCheckInviteCodeDone, _CheckInviteCodeDonePayload>
export type CheckInviteCodeDonePayloadError = $Call<typeof createCheckInviteCodeDoneError, _CheckInviteCodeDonePayloadError>
export type CheckInviteCodePayload = $Call<typeof createCheckInviteCode, _CheckInviteCodePayload>
export type CheckPassphrasePayload = $Call<typeof createCheckPassphrase, _CheckPassphrasePayload>
export type CheckPassphrasePayloadError = $Call<typeof createCheckPassphraseError, _CheckPassphrasePayloadError>
export type CheckUsernameEmailDonePayload = $Call<typeof createCheckUsernameEmailDone, _CheckUsernameEmailDonePayload>
export type CheckUsernameEmailDonePayloadError = $Call<typeof createCheckUsernameEmailDoneError, _CheckUsernameEmailDonePayloadError>
export type CheckUsernameEmailPayload = $Call<typeof createCheckUsernameEmail, _CheckUsernameEmailPayload>
export type ClearDeviceNameErrorPayload = $Call<typeof createClearDeviceNameError, _ClearDeviceNameErrorPayload>
export type RequestAutoInvitePayload = $Call<typeof createRequestAutoInvite, _RequestAutoInvitePayload>
export type RequestInviteDonePayload = $Call<typeof createRequestInviteDone, _RequestInviteDonePayload>
export type RequestInviteDonePayloadError = $Call<typeof createRequestInviteDoneError, _RequestInviteDonePayloadError>
export type RequestInvitePayload = $Call<typeof createRequestInvite, _RequestInvitePayload>
export type ResetSignupPayload = $Call<typeof createResetSignup, _ResetSignupPayload>
export type RestartSignupPayload = $Call<typeof createRestartSignup, _RestartSignupPayload>
export type SetDeviceNameErrorPayload = $Call<typeof createSetDeviceNameError, _SetDeviceNameErrorPayload>
export type SignupErrorPayload = $Call<typeof createSignupError, _SignupErrorPayload>
export type SubmitDeviceNamePayload = $Call<typeof createSubmitDeviceName, _SubmitDeviceNamePayload>
export type SubmitDeviceNamePayloadError = $Call<typeof createSubmitDeviceNameError, _SubmitDeviceNamePayloadError>

// All Actions
// prettier-ignore
export type Actions =
  | CheckInviteCodeDonePayload
  | CheckInviteCodeDonePayloadError
  | CheckInviteCodePayload
  | CheckPassphrasePayload
  | CheckPassphrasePayloadError
  | CheckUsernameEmailDonePayload
  | CheckUsernameEmailDonePayloadError
  | CheckUsernameEmailPayload
  | ClearDeviceNameErrorPayload
  | RequestAutoInvitePayload
  | RequestInviteDonePayload
  | RequestInviteDonePayloadError
  | RequestInvitePayload
  | ResetSignupPayload
  | RestartSignupPayload
  | SetDeviceNameErrorPayload
  | SignupErrorPayload
  | SubmitDeviceNamePayload
  | SubmitDeviceNamePayloadError
  | {type: 'common:resetStore', payload: void}
