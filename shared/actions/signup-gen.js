// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassphrase = 'signup:checkPassphrase'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
export const checkedDevicename = 'signup:checkedDevicename'
export const checkedInviteCode = 'signup:checkedInviteCode'
export const checkedUsernameEmail = 'signup:checkedUsernameEmail'
export const goBackAndClearErrors = 'signup:goBackAndClearErrors'
export const requestAutoInvite = 'signup:requestAutoInvite'
export const requestInvite = 'signup:requestInvite'
export const requestedAutoInvite = 'signup:requestedAutoInvite'
export const requestedInvite = 'signup:requestedInvite'
export const restartSignup = 'signup:restartSignup'
export const signedup = 'signup:signedup'

// Payload Types
type _CheckDevicenamePayload = $ReadOnly<{|devicename: string|}>
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckPassphrasePayload = $ReadOnly<{|
  pass1: HiddenString,
  pass2: HiddenString,
|}>
type _CheckUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _CheckedDevicenamePayload = $ReadOnly<{|devicename: string|}>
type _CheckedDevicenamePayloadError = $ReadOnly<{|
  devicename: string,
  error: string,
|}>
type _CheckedInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckedInviteCodePayloadError = $ReadOnly<{|
  inviteCode: string,
  error: string,
|}>
type _CheckedUsernameEmailPayload = $ReadOnly<{|
  username: string,
  email: string,
|}>
type _CheckedUsernameEmailPayloadError = $ReadOnly<{|
  emailError: string,
  usernameError: string,
  email: string,
  username: string,
|}>
type _GoBackAndClearErrorsPayload = void
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
type _SignedupPayload = void
type _SignedupPayloadError = $ReadOnly<{|error: HiddenString|}>

// Action Creators
export const createCheckDevicename = (payload: _CheckDevicenamePayload) => ({error: false, payload, type: checkDevicename})
export const createCheckInviteCode = (payload: _CheckInviteCodePayload) => ({error: false, payload, type: checkInviteCode})
export const createCheckPassphrase = (payload: _CheckPassphrasePayload) => ({error: false, payload, type: checkPassphrase})
export const createCheckUsernameEmail = (payload: _CheckUsernameEmailPayload) => ({error: false, payload, type: checkUsernameEmail})
export const createCheckedDevicename = (payload: _CheckedDevicenamePayload) => ({error: false, payload, type: checkedDevicename})
export const createCheckedDevicenameError = (payload: _CheckedDevicenamePayloadError) => ({error: true, payload, type: checkedDevicename})
export const createCheckedInviteCode = (payload: _CheckedInviteCodePayload) => ({error: false, payload, type: checkedInviteCode})
export const createCheckedInviteCodeError = (payload: _CheckedInviteCodePayloadError) => ({error: true, payload, type: checkedInviteCode})
export const createCheckedUsernameEmail = (payload: _CheckedUsernameEmailPayload) => ({error: false, payload, type: checkedUsernameEmail})
export const createCheckedUsernameEmailError = (payload: _CheckedUsernameEmailPayloadError) => ({error: true, payload, type: checkedUsernameEmail})
export const createGoBackAndClearErrors = (payload: _GoBackAndClearErrorsPayload) => ({error: false, payload, type: goBackAndClearErrors})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload) => ({error: false, payload, type: requestAutoInvite})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({error: false, payload, type: requestInvite})
export const createRequestedAutoInvite = (payload: _RequestedAutoInvitePayload) => ({error: false, payload, type: requestedAutoInvite})
export const createRequestedAutoInviteError = (payload: _RequestedAutoInvitePayloadError) => ({error: true, payload, type: requestedAutoInvite})
export const createRequestedInvite = (payload: _RequestedInvitePayload) => ({error: false, payload, type: requestedInvite})
export const createRequestedInviteError = (payload: _RequestedInvitePayloadError) => ({error: true, payload, type: requestedInvite})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({error: false, payload, type: restartSignup})
export const createSignedup = (payload: _SignedupPayload) => ({error: false, payload, type: signedup})
export const createSignedupError = (payload: _SignedupPayloadError) => ({error: true, payload, type: signedup})

// Action Payloads
export type CheckDevicenamePayload = $Call<typeof createCheckDevicename, _CheckDevicenamePayload>
export type CheckInviteCodePayload = $Call<typeof createCheckInviteCode, _CheckInviteCodePayload>
export type CheckPassphrasePayload = $Call<typeof createCheckPassphrase, _CheckPassphrasePayload>
export type CheckUsernameEmailPayload = $Call<typeof createCheckUsernameEmail, _CheckUsernameEmailPayload>
export type CheckedDevicenamePayload = $Call<typeof createCheckedDevicename, _CheckedDevicenamePayload>
export type CheckedDevicenamePayloadError = $Call<typeof createCheckedDevicenameError, _CheckedDevicenamePayloadError>
export type CheckedInviteCodePayload = $Call<typeof createCheckedInviteCode, _CheckedInviteCodePayload>
export type CheckedInviteCodePayloadError = $Call<typeof createCheckedInviteCodeError, _CheckedInviteCodePayloadError>
export type CheckedUsernameEmailPayload = $Call<typeof createCheckedUsernameEmail, _CheckedUsernameEmailPayload>
export type CheckedUsernameEmailPayloadError = $Call<typeof createCheckedUsernameEmailError, _CheckedUsernameEmailPayloadError>
export type GoBackAndClearErrorsPayload = $Call<typeof createGoBackAndClearErrors, _GoBackAndClearErrorsPayload>
export type RequestAutoInvitePayload = $Call<typeof createRequestAutoInvite, _RequestAutoInvitePayload>
export type RequestInvitePayload = $Call<typeof createRequestInvite, _RequestInvitePayload>
export type RequestedAutoInvitePayload = $Call<typeof createRequestedAutoInvite, _RequestedAutoInvitePayload>
export type RequestedAutoInvitePayloadError = $Call<typeof createRequestedAutoInviteError, _RequestedAutoInvitePayloadError>
export type RequestedInvitePayload = $Call<typeof createRequestedInvite, _RequestedInvitePayload>
export type RequestedInvitePayloadError = $Call<typeof createRequestedInviteError, _RequestedInvitePayloadError>
export type RestartSignupPayload = $Call<typeof createRestartSignup, _RestartSignupPayload>
export type SignedupPayload = $Call<typeof createSignedup, _SignedupPayload>
export type SignedupPayloadError = $Call<typeof createSignedupError, _SignedupPayloadError>

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckInviteCodePayload
  | CheckPassphrasePayload
  | CheckUsernameEmailPayload
  | CheckedDevicenamePayload
  | CheckedDevicenamePayloadError
  | CheckedInviteCodePayload
  | CheckedInviteCodePayloadError
  | CheckedUsernameEmailPayload
  | CheckedUsernameEmailPayloadError
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
  | {type: 'common:resetStore', payload: void}
