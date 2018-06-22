// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassphrase = 'signup:checkPassphrase'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
export const checkUsernameEmailDone = 'signup:checkUsernameEmailDone'
export const clearDeviceNameError = 'signup:clearDeviceNameError'
export const requestInvite = 'signup:requestInvite'
export const resetSignup = 'signup:resetSignup'
export const restartSignup = 'signup:restartSignup'
export const setDeviceNameError = 'signup:setDeviceNameError'
export const showPaperKey = 'signup:showPaperKey'
export const signupError = 'signup:signupError'
export const startRequestInvite = 'signup:startRequestInvite'
export const submitDeviceName = 'signup:submitDeviceName'
export const waiting = 'signup:waiting'

// Payload Types
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckInviteCodePayloadError = $ReadOnly<{|errorText: string|}>
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
type _RequestInvitePayload = $ReadOnly<{|
  email: string,
  name: string,
|}>
type _RequestInvitePayloadError = $ReadOnly<{|
  emailError: string,
  nameError: string,
  email: string,
  name: string,
|}>
type _ResetSignupPayload = void
type _RestartSignupPayload = void
type _SetDeviceNameErrorPayload = $ReadOnly<{|deviceNameError: string|}>
type _ShowPaperKeyPayload = $ReadOnly<{|paperkey: HiddenString|}>
type _SignupErrorPayload = $ReadOnly<{|signupError: HiddenString|}>
type _StartRequestInvitePayload = void
type _SubmitDeviceNamePayload = $ReadOnly<{|deviceName: string|}>
type _SubmitDeviceNamePayloadError = $ReadOnly<{|deviceNameError: string|}>
type _WaitingPayload = $ReadOnly<{|waiting: boolean|}>

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
export const createCheckInviteCodeError = (payload: _CheckInviteCodePayloadError) => ({error: true, payload, type: checkInviteCode})
export const createCheckPassphrase = (payload: _CheckPassphrasePayload) => ({error: false, payload, type: checkPassphrase})
export const createCheckPassphraseError = (payload: _CheckPassphrasePayloadError) => ({error: true, payload, type: checkPassphrase})
export const createClearDeviceNameError = (payload: _ClearDeviceNameErrorPayload) => ({error: false, payload, type: clearDeviceNameError})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({error: false, payload, type: requestInvite})
export const createRequestInviteError = (payload: _RequestInvitePayloadError) => ({error: true, payload, type: requestInvite})
export const createResetSignup = (payload: _ResetSignupPayload) => ({error: false, payload, type: resetSignup})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({error: false, payload, type: restartSignup})
export const createSetDeviceNameError = (payload: _SetDeviceNameErrorPayload) => ({error: false, payload, type: setDeviceNameError})
export const createShowPaperKey = (payload: _ShowPaperKeyPayload) => ({error: false, payload, type: showPaperKey})
export const createSignupError = (payload: _SignupErrorPayload) => ({error: false, payload, type: signupError})
export const createStartRequestInvite = (payload: _StartRequestInvitePayload) => ({error: false, payload, type: startRequestInvite})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({error: false, payload, type: submitDeviceName})
export const createSubmitDeviceNameError = (payload: _SubmitDeviceNamePayloadError) => ({error: true, payload, type: submitDeviceName})
export const createWaiting = (payload: _WaitingPayload) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckInviteCodePayload = $Call<typeof createCheckInviteCode, _CheckInviteCodePayload>
export type CheckInviteCodePayloadError = $Call<typeof createCheckInviteCodeError, _CheckInviteCodePayloadError>
export type CheckPassphrasePayload = $Call<typeof createCheckPassphrase, _CheckPassphrasePayload>
export type CheckPassphrasePayloadError = $Call<typeof createCheckPassphraseError, _CheckPassphrasePayloadError>
export type CheckUsernameEmailDonePayload = $Call<typeof createCheckUsernameEmailDone, _CheckUsernameEmailDonePayload>
export type CheckUsernameEmailDonePayloadError = $Call<typeof createCheckUsernameEmailDoneError, _CheckUsernameEmailDonePayloadError>
export type CheckUsernameEmailPayload = $Call<typeof createCheckUsernameEmail, _CheckUsernameEmailPayload>
export type ClearDeviceNameErrorPayload = $Call<typeof createClearDeviceNameError, _ClearDeviceNameErrorPayload>
export type RequestInvitePayload = $Call<typeof createRequestInvite, _RequestInvitePayload>
export type RequestInvitePayloadError = $Call<typeof createRequestInviteError, _RequestInvitePayloadError>
export type ResetSignupPayload = $Call<typeof createResetSignup, _ResetSignupPayload>
export type RestartSignupPayload = $Call<typeof createRestartSignup, _RestartSignupPayload>
export type SetDeviceNameErrorPayload = $Call<typeof createSetDeviceNameError, _SetDeviceNameErrorPayload>
export type ShowPaperKeyPayload = $Call<typeof createShowPaperKey, _ShowPaperKeyPayload>
export type SignupErrorPayload = $Call<typeof createSignupError, _SignupErrorPayload>
export type StartRequestInvitePayload = $Call<typeof createStartRequestInvite, _StartRequestInvitePayload>
export type SubmitDeviceNamePayload = $Call<typeof createSubmitDeviceName, _SubmitDeviceNamePayload>
export type SubmitDeviceNamePayloadError = $Call<typeof createSubmitDeviceNameError, _SubmitDeviceNamePayloadError>
export type WaitingPayload = $Call<typeof createWaiting, _WaitingPayload>

// All Actions
// prettier-ignore
export type Actions =
  | CheckInviteCodePayload
  | CheckInviteCodePayloadError
  | CheckPassphrasePayload
  | CheckPassphrasePayloadError
  | CheckUsernameEmailDonePayload
  | CheckUsernameEmailDonePayloadError
  | CheckUsernameEmailPayload
  | ClearDeviceNameErrorPayload
  | RequestInvitePayload
  | RequestInvitePayloadError
  | ResetSignupPayload
  | RestartSignupPayload
  | SetDeviceNameErrorPayload
  | ShowPaperKeyPayload
  | SignupErrorPayload
  | StartRequestInvitePayload
  | SubmitDeviceNamePayload
  | SubmitDeviceNamePayloadError
  | WaitingPayload
  | {type: 'common:resetStore', payload: void}
