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
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestInviteDone = 'signup:requestInviteDone'
export const restartSignup = 'signup:restartSignup'
export const signup = 'signup:signup'
export const signupError = 'signup:signupError'
export const submitDevicename = 'signup:submitDevicename'
export const submitDevicenameDone = 'signup:submitDevicenameDone'
export const validatedUsernameEmail = 'signup:validatedUsernameEmail'

// Payload Types
type _CheckInviteCodeDonePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckInviteCodeDonePayloadError = $ReadOnly<{|
  inviteCode: string,
  error: string,
|}>
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckPassphrasePayload = $ReadOnly<{|
  pass1: HiddenString,
  pass2: HiddenString,
|}>
type _CheckUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
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
export const createCheckInviteCodeDone = (payload: _CheckInviteCodeDonePayload) => ({error: false, payload, type: checkInviteCodeDone})
export const createCheckInviteCodeDoneError = (payload: _CheckInviteCodeDonePayloadError) => ({error: true, payload, type: checkInviteCodeDone})
export const createCheckPassphrase = (payload: _CheckPassphrasePayload) => ({error: false, payload, type: checkPassphrase})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload) => ({error: false, payload, type: requestAutoInvite})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({error: false, payload, type: requestInvite})
export const createRequestInviteDone = (payload: _RequestInviteDonePayload) => ({error: false, payload, type: requestInviteDone})
export const createRequestInviteDoneError = (payload: _RequestInviteDonePayloadError) => ({error: true, payload, type: requestInviteDone})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({error: false, payload, type: restartSignup})
export const createSignup = (payload: _SignupPayload) => ({error: false, payload, type: signup})
export const createSignupError = (payload: _SignupErrorPayload) => ({error: false, payload, type: signupError})
export const createSubmitDevicename = (payload: _SubmitDevicenamePayload) => ({error: false, payload, type: submitDevicename})
export const createSubmitDevicenameDone = (payload: _SubmitDevicenameDonePayload) => ({error: false, payload, type: submitDevicenameDone})
export const createSubmitDevicenameDoneError = (payload: _SubmitDevicenameDonePayloadError) => ({error: true, payload, type: submitDevicenameDone})

// Action Payloads
export type CheckInviteCodeDonePayload = $Call<typeof createCheckInviteCodeDone, _CheckInviteCodeDonePayload>
export type CheckInviteCodeDonePayloadError = $Call<typeof createCheckInviteCodeDoneError, _CheckInviteCodeDonePayloadError>
export type CheckInviteCodePayload = $Call<typeof createCheckInviteCode, _CheckInviteCodePayload>
export type CheckPassphrasePayload = $Call<typeof createCheckPassphrase, _CheckPassphrasePayload>
export type CheckUsernameEmailPayload = $Call<typeof createCheckUsernameEmail, _CheckUsernameEmailPayload>
export type RequestAutoInvitePayload = $Call<typeof createRequestAutoInvite, _RequestAutoInvitePayload>
export type RequestInviteDonePayload = $Call<typeof createRequestInviteDone, _RequestInviteDonePayload>
export type RequestInviteDonePayloadError = $Call<typeof createRequestInviteDoneError, _RequestInviteDonePayloadError>
export type RequestInvitePayload = $Call<typeof createRequestInvite, _RequestInvitePayload>
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
  | CheckInviteCodeDonePayload
  | CheckInviteCodeDonePayloadError
  | CheckInviteCodePayload
  | CheckPassphrasePayload
  | CheckUsernameEmailPayload
  | RequestAutoInvitePayload
  | RequestInviteDonePayload
  | RequestInviteDonePayloadError
  | RequestInvitePayload
  | RestartSignupPayload
  | SignupErrorPayload
  | SignupPayload
  | SubmitDevicenameDonePayload
  | SubmitDevicenameDonePayloadError
  | SubmitDevicenamePayload
  | ValidatedUsernameEmailPayload
  | ValidatedUsernameEmailPayloadError
  | {type: 'common:resetStore', payload: void}
