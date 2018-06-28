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
export const checkedInviteCode = 'signup:checkedInviteCode'
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestedAutoInvite = 'signup:requestedAutoInvite'
export const requestedInvite = 'signup:requestedInvite'
export const restartSignup = 'signup:restartSignup'
export const signup = 'signup:signup'
export const signupError = 'signup:signupError'
export const submitDevicename = 'signup:submitDevicename'
export const submitDevicenameDone = 'signup:submitDevicenameDone'
export const validatedUsernameEmail = 'signup:validatedUsernameEmail'

// Payload Types
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckPassphrasePayload = $ReadOnly<{|
  pass1: HiddenString,
  pass2: HiddenString,
|}>
type _CheckUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _CheckedInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckedInviteCodePayloadError = $ReadOnly<{|
  inviteCode: string,
  error: string,
|}>
type _RequestAutoInvitePayload = void
type _RequestInvitePayload = $ReadOnly<{|
  email: string,
  name: string,
|}>
type _RequestedAutoInvitePayload = $ReadOnly<{|inviteCode: string|}>
type _RequestedAutoInvitePayloadError = void
type _RequestedInvitePayload = $ReadOnly<{|
  email: string,
  name: string,
|}>
type _RequestedInvitePayloadError = $ReadOnly<{|
  emailError: string,
  nameError: string,
  email: string,
  name: string,
|}>
type _RestartSignupPayload = void
type _SignupErrorPayload = $ReadOnly<{|signupError: HiddenString|}>
type _SignupPayload = void
type _SubmitDevicenameDonePayload = $ReadOnly<{|devicename: string|}>
type _SubmitDevicenameDonePayloadError = $ReadOnly<{|
  devicename: string,
  error: string,
|}>
type _SubmitDevicenamePayload = $ReadOnly<{|devicename: string|}>
type _ValidatedUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _ValidatedUsernameEmailPayloadError = $ReadOnly<{|
  emailError: string,
  usernameError: string,
  email: string,
  username: string,
|}>

// Action Creators
/**
 * We heard back from the server
 */
export const createValidatedUsernameEmail = (payload: _ValidatedUsernameEmailPayload) => ({error: false, payload, type: validatedUsernameEmail})
export const createValidatedUsernameEmailError = (payload: _ValidatedUsernameEmailPayloadError) => ({error: true, payload, type: validatedUsernameEmail})
/**
 * We want to validate a user/email
 */
export const createCheckUsernameEmail = (payload: _CheckUsernameEmailPayload) => ({error: false, payload, type: checkUsernameEmail})
export const createCheckInviteCode = (payload: _CheckInviteCodePayload) => ({error: false, payload, type: checkInviteCode})
export const createCheckPassphrase = (payload: _CheckPassphrasePayload) => ({error: false, payload, type: checkPassphrase})
export const createCheckedInviteCode = (payload: _CheckedInviteCodePayload) => ({error: false, payload, type: checkedInviteCode})
export const createCheckedInviteCodeError = (payload: _CheckedInviteCodePayloadError) => ({error: true, payload, type: checkedInviteCode})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload) => ({error: false, payload, type: requestAutoInvite})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({error: false, payload, type: requestInvite})
export const createRequestedAutoInvite = (payload: _RequestedAutoInvitePayload) => ({error: false, payload, type: requestedAutoInvite})
export const createRequestedAutoInviteError = (payload: _RequestedAutoInvitePayloadError) => ({error: true, payload, type: requestedAutoInvite})
export const createRequestedInvite = (payload: _RequestedInvitePayload) => ({error: false, payload, type: requestedInvite})
export const createRequestedInviteError = (payload: _RequestedInvitePayloadError) => ({error: true, payload, type: requestedInvite})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({error: false, payload, type: restartSignup})
export const createSignup = (payload: _SignupPayload) => ({error: false, payload, type: signup})
export const createSignupError = (payload: _SignupErrorPayload) => ({error: false, payload, type: signupError})
export const createSubmitDevicename = (payload: _SubmitDevicenamePayload) => ({error: false, payload, type: submitDevicename})
export const createSubmitDevicenameDone = (payload: _SubmitDevicenameDonePayload) => ({error: false, payload, type: submitDevicenameDone})
export const createSubmitDevicenameDoneError = (payload: _SubmitDevicenameDonePayloadError) => ({error: true, payload, type: submitDevicenameDone})

// Action Payloads
export type CheckInviteCodePayload = $Call<typeof createCheckInviteCode, _CheckInviteCodePayload>
export type CheckPassphrasePayload = $Call<typeof createCheckPassphrase, _CheckPassphrasePayload>
export type CheckUsernameEmailPayload = $Call<typeof createCheckUsernameEmail, _CheckUsernameEmailPayload>
export type CheckedInviteCodePayload = $Call<typeof createCheckedInviteCode, _CheckedInviteCodePayload>
export type CheckedInviteCodePayloadError = $Call<typeof createCheckedInviteCodeError, _CheckedInviteCodePayloadError>
export type RequestAutoInvitePayload = $Call<typeof createRequestAutoInvite, _RequestAutoInvitePayload>
export type RequestInvitePayload = $Call<typeof createRequestInvite, _RequestInvitePayload>
export type RequestedAutoInvitePayload = $Call<typeof createRequestedAutoInvite, _RequestedAutoInvitePayload>
export type RequestedAutoInvitePayloadError = $Call<typeof createRequestedAutoInviteError, _RequestedAutoInvitePayloadError>
export type RequestedInvitePayload = $Call<typeof createRequestedInvite, _RequestedInvitePayload>
export type RequestedInvitePayloadError = $Call<typeof createRequestedInviteError, _RequestedInvitePayloadError>
export type RestartSignupPayload = $Call<typeof createRestartSignup, _RestartSignupPayload>
export type SignupErrorPayload = $Call<typeof createSignupError, _SignupErrorPayload>
export type SignupPayload = $Call<typeof createSignup, _SignupPayload>
export type SubmitDevicenameDonePayload = $Call<typeof createSubmitDevicenameDone, _SubmitDevicenameDonePayload>
export type SubmitDevicenameDonePayloadError = $Call<typeof createSubmitDevicenameDoneError, _SubmitDevicenameDonePayloadError>
export type SubmitDevicenamePayload = $Call<typeof createSubmitDevicename, _SubmitDevicenamePayload>
export type ValidatedUsernameEmailPayload = $Call<typeof createValidatedUsernameEmail, _ValidatedUsernameEmailPayload>
export type ValidatedUsernameEmailPayloadError = $Call<typeof createValidatedUsernameEmailError, _ValidatedUsernameEmailPayloadError>

// All Actions
// prettier-ignore
export type Actions =
  | CheckInviteCodePayload
  | CheckPassphrasePayload
  | CheckUsernameEmailPayload
  | CheckedInviteCodePayload
  | CheckedInviteCodePayloadError
  | RequestAutoInvitePayload
  | RequestInvitePayload
  | RequestedAutoInvitePayload
  | RequestedAutoInvitePayloadError
  | RequestedInvitePayload
  | RequestedInvitePayloadError
  | RestartSignupPayload
  | SignupErrorPayload
  | SignupPayload
  | SubmitDevicenameDonePayload
  | SubmitDevicenameDonePayloadError
  | SubmitDevicenamePayload
  | ValidatedUsernameEmailPayload
  | ValidatedUsernameEmailPayloadError
  | {type: 'common:resetStore', payload: void}
