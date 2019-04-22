// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'signup:'
export const checkDevicename = 'signup:checkDevicename'
export const checkEmail = 'signup:checkEmail'
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassword = 'signup:checkPassword'
export const checkUsername = 'signup:checkUsername'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
export const checkedDevicename = 'signup:checkedDevicename'
export const checkedEmail = 'signup:checkedEmail'
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
type _CheckDevicenamePayload = $ReadOnly<{|devicename: string|}>
type _CheckEmailPayload = $ReadOnly<{|email: string|}>
type _CheckInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckPasswordPayload = $ReadOnly<{|pass1: HiddenString, pass2: HiddenString|}>
type _CheckUsernameEmailPayload = $ReadOnly<{|username: string, email: string|}>
type _CheckUsernamePayload = $ReadOnly<{|username: string|}>
type _CheckedDevicenamePayload = $ReadOnly<{|devicename: string|}>
type _CheckedDevicenamePayloadError = $ReadOnly<{|devicename: string, error: string|}>
type _CheckedEmailPayload = $ReadOnly<{|email: string|}>
type _CheckedEmailPayloadError = $ReadOnly<{|emailError: string, email: string|}>
type _CheckedInviteCodePayload = $ReadOnly<{|inviteCode: string|}>
type _CheckedInviteCodePayloadError = $ReadOnly<{|inviteCode: string, error: string|}>
type _CheckedUsernameEmailPayload = $ReadOnly<{|username: string, email: string|}>
type _CheckedUsernameEmailPayloadError = $ReadOnly<{|emailError: string, usernameError: string, email: string, username: string|}>
type _CheckedUsernamePayload = $ReadOnly<{|username: string|}>
type _CheckedUsernamePayloadError = $ReadOnly<{|username: string, usernameError: string, usernameTaken: boolean|}>
type _GoBackAndClearErrorsPayload = void
type _RequestAutoInvitePayload = void
type _RequestInvitePayload = $ReadOnly<{|email: string, name: string|}>
type _RequestedAutoInvitePayload = $ReadOnly<{|inviteCode: string|}>
type _RequestedAutoInvitePayloadError = void
type _RequestedInvitePayload = $ReadOnly<{|email: string, name: string|}>
type _RequestedInvitePayloadError = $ReadOnly<{|emailError: string, nameError: string, email: string, name: string|}>
type _RestartSignupPayload = void
type _SignedupPayload = void
type _SignedupPayloadError = $ReadOnly<{|error: HiddenString|}>

// Action Creators
export const createCheckDevicename = (payload: _CheckDevicenamePayload) => ({payload, type: checkDevicename})
export const createCheckEmail = (payload: _CheckEmailPayload) => ({payload, type: checkEmail})
export const createCheckInviteCode = (payload: _CheckInviteCodePayload) => ({payload, type: checkInviteCode})
export const createCheckPassword = (payload: _CheckPasswordPayload) => ({payload, type: checkPassword})
export const createCheckUsername = (payload: _CheckUsernamePayload) => ({payload, type: checkUsername})
export const createCheckUsernameEmail = (payload: _CheckUsernameEmailPayload) => ({payload, type: checkUsernameEmail})
export const createCheckedDevicename = (payload: _CheckedDevicenamePayload) => ({payload, type: checkedDevicename})
export const createCheckedDevicenameError = (payload: _CheckedDevicenamePayloadError) => ({error: true, payload, type: checkedDevicename})
export const createCheckedEmail = (payload: _CheckedEmailPayload) => ({payload, type: checkedEmail})
export const createCheckedEmailError = (payload: _CheckedEmailPayloadError) => ({error: true, payload, type: checkedEmail})
export const createCheckedInviteCode = (payload: _CheckedInviteCodePayload) => ({payload, type: checkedInviteCode})
export const createCheckedInviteCodeError = (payload: _CheckedInviteCodePayloadError) => ({error: true, payload, type: checkedInviteCode})
export const createCheckedUsername = (payload: _CheckedUsernamePayload) => ({payload, type: checkedUsername})
export const createCheckedUsernameError = (payload: _CheckedUsernamePayloadError) => ({error: true, payload, type: checkedUsername})
export const createCheckedUsernameEmail = (payload: _CheckedUsernameEmailPayload) => ({payload, type: checkedUsernameEmail})
export const createCheckedUsernameEmailError = (payload: _CheckedUsernameEmailPayloadError) => ({error: true, payload, type: checkedUsernameEmail})
export const createGoBackAndClearErrors = (payload: _GoBackAndClearErrorsPayload) => ({payload, type: goBackAndClearErrors})
export const createRequestAutoInvite = (payload: _RequestAutoInvitePayload) => ({payload, type: requestAutoInvite})
export const createRequestInvite = (payload: _RequestInvitePayload) => ({payload, type: requestInvite})
export const createRequestedAutoInvite = (payload: _RequestedAutoInvitePayload) => ({payload, type: requestedAutoInvite})
export const createRequestedAutoInviteError = (payload: _RequestedAutoInvitePayloadError) => ({error: true, payload, type: requestedAutoInvite})
export const createRequestedInvite = (payload: _RequestedInvitePayload) => ({payload, type: requestedInvite})
export const createRequestedInviteError = (payload: _RequestedInvitePayloadError) => ({error: true, payload, type: requestedInvite})
export const createRestartSignup = (payload: _RestartSignupPayload) => ({payload, type: restartSignup})
export const createSignedup = (payload: _SignedupPayload) => ({payload, type: signedup})
export const createSignedupError = (payload: _SignedupPayloadError) => ({error: true, payload, type: signedup})

// Action Payloads
export type CheckDevicenamePayload = {|+payload: _CheckDevicenamePayload, +type: 'signup:checkDevicename'|}
export type CheckEmailPayload = {|+payload: _CheckEmailPayload, +type: 'signup:checkEmail'|}
export type CheckInviteCodePayload = {|+payload: _CheckInviteCodePayload, +type: 'signup:checkInviteCode'|}
export type CheckPasswordPayload = {|+payload: _CheckPasswordPayload, +type: 'signup:checkPassword'|}
export type CheckUsernameEmailPayload = {|+payload: _CheckUsernameEmailPayload, +type: 'signup:checkUsernameEmail'|}
export type CheckUsernamePayload = {|+payload: _CheckUsernamePayload, +type: 'signup:checkUsername'|}
export type CheckedDevicenamePayload = {|+payload: _CheckedDevicenamePayload, +type: 'signup:checkedDevicename'|}
export type CheckedDevicenamePayloadError = {|+error: true, +payload: _CheckedDevicenamePayloadError, +type: 'signup:checkedDevicename'|}
export type CheckedEmailPayload = {|+payload: _CheckedEmailPayload, +type: 'signup:checkedEmail'|}
export type CheckedEmailPayloadError = {|+error: true, +payload: _CheckedEmailPayloadError, +type: 'signup:checkedEmail'|}
export type CheckedInviteCodePayload = {|+payload: _CheckedInviteCodePayload, +type: 'signup:checkedInviteCode'|}
export type CheckedInviteCodePayloadError = {|+error: true, +payload: _CheckedInviteCodePayloadError, +type: 'signup:checkedInviteCode'|}
export type CheckedUsernameEmailPayload = {|+payload: _CheckedUsernameEmailPayload, +type: 'signup:checkedUsernameEmail'|}
export type CheckedUsernameEmailPayloadError = {|+error: true, +payload: _CheckedUsernameEmailPayloadError, +type: 'signup:checkedUsernameEmail'|}
export type CheckedUsernamePayload = {|+payload: _CheckedUsernamePayload, +type: 'signup:checkedUsername'|}
export type CheckedUsernamePayloadError = {|+error: true, +payload: _CheckedUsernamePayloadError, +type: 'signup:checkedUsername'|}
export type GoBackAndClearErrorsPayload = {|+payload: _GoBackAndClearErrorsPayload, +type: 'signup:goBackAndClearErrors'|}
export type RequestAutoInvitePayload = {|+payload: _RequestAutoInvitePayload, +type: 'signup:requestAutoInvite'|}
export type RequestInvitePayload = {|+payload: _RequestInvitePayload, +type: 'signup:requestInvite'|}
export type RequestedAutoInvitePayload = {|+payload: _RequestedAutoInvitePayload, +type: 'signup:requestedAutoInvite'|}
export type RequestedAutoInvitePayloadError = {|+error: true, +payload: _RequestedAutoInvitePayloadError, +type: 'signup:requestedAutoInvite'|}
export type RequestedInvitePayload = {|+payload: _RequestedInvitePayload, +type: 'signup:requestedInvite'|}
export type RequestedInvitePayloadError = {|+error: true, +payload: _RequestedInvitePayloadError, +type: 'signup:requestedInvite'|}
export type RestartSignupPayload = {|+payload: _RestartSignupPayload, +type: 'signup:restartSignup'|}
export type SignedupPayload = {|+payload: _SignedupPayload, +type: 'signup:signedup'|}
export type SignedupPayloadError = {|+error: true, +payload: _SignedupPayloadError, +type: 'signup:signedup'|}

// All Actions
// prettier-ignore
export type Actions =
  | CheckDevicenamePayload
  | CheckEmailPayload
  | CheckInviteCodePayload
  | CheckPasswordPayload
  | CheckUsernameEmailPayload
  | CheckUsernamePayload
  | CheckedDevicenamePayload
  | CheckedDevicenamePayloadError
  | CheckedEmailPayload
  | CheckedEmailPayloadError
  | CheckedInviteCodePayload
  | CheckedInviteCodePayloadError
  | CheckedUsernameEmailPayload
  | CheckedUsernameEmailPayloadError
  | CheckedUsernamePayload
  | CheckedUsernamePayloadError
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
