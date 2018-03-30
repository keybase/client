// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as More from '../constants/types/more'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of signup but is handled by every reducer
export const checkInviteCode = 'signup:checkInviteCode'
export const checkPassphrase = 'signup:checkPassphrase'
export const checkUsernameEmail = 'signup:checkUsernameEmail'
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

// Action Creators
export const createCheckInviteCode = (payload: $ReadOnly<{|inviteCode: string|}>) => ({error: false, payload, type: checkInviteCode})
export const createCheckInviteCodeError = (payload: $ReadOnly<{|errorText: string|}>) => ({error: true, payload, type: checkInviteCode})
export const createCheckPassphrase = (payload: $ReadOnly<{|passphrase: HiddenString|}>) => ({error: false, payload, type: checkPassphrase})
export const createCheckPassphraseError = (payload: $ReadOnly<{|passphraseError: HiddenString|}>) => ({error: true, payload, type: checkPassphrase})
export const createCheckUsernameEmail = (
  payload: $ReadOnly<{|
    username: string,
    email: string,
  |}>
) => ({error: false, payload, type: checkUsernameEmail})
export const createCheckUsernameEmailError = (
  payload: $ReadOnly<{|
    emailError: ?Error,
    usernameError: ?Error,
    email: ?string,
    username: ?string,
  |}>
) => ({error: true, payload, type: checkUsernameEmail})
export const createClearDeviceNameError = () => ({error: false, payload: undefined, type: clearDeviceNameError})
export const createRequestInvite = (
  payload: $ReadOnly<{|
    email: string,
    name: string,
  |}>
) => ({error: false, payload, type: requestInvite})
export const createRequestInviteError = (
  payload: $ReadOnly<{|
    emailError: ?Error,
    nameError: ?Error,
    email: ?string,
    name: ?string,
  |}>
) => ({error: true, payload, type: requestInvite})
export const createResetSignup = () => ({error: false, payload: undefined, type: resetSignup})
export const createRestartSignup = () => ({error: false, payload: undefined, type: restartSignup})
export const createSetDeviceNameError = (payload: $ReadOnly<{|deviceNameError: string|}>) => ({error: false, payload, type: setDeviceNameError})
export const createShowPaperKey = (payload: $ReadOnly<{|paperkey: HiddenString|}>) => ({error: false, payload, type: showPaperKey})
export const createSignupError = (payload: $ReadOnly<{|signupError: HiddenString|}>) => ({error: false, payload, type: signupError})
export const createStartRequestInvite = () => ({error: false, payload: undefined, type: startRequestInvite})
export const createSubmitDeviceName = (payload: $ReadOnly<{|deviceName: string|}>) => ({error: false, payload, type: submitDeviceName})
export const createSubmitDeviceNameError = (payload: $ReadOnly<{|deviceNameError: string|}>) => ({error: true, payload, type: submitDeviceName})
export const createWaiting = (payload: $ReadOnly<{|waiting: boolean|}>) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckInviteCodePayload = More.ReturnType<typeof createCheckInviteCode>
export type CheckPassphrasePayload = More.ReturnType<typeof createCheckPassphrase>
export type CheckUsernameEmailPayload = More.ReturnType<typeof createCheckUsernameEmail>
export type ClearDeviceNameErrorPayload = More.ReturnType<typeof createClearDeviceNameError>
export type RequestInvitePayload = More.ReturnType<typeof createRequestInvite>
export type ResetSignupPayload = More.ReturnType<typeof createResetSignup>
export type RestartSignupPayload = More.ReturnType<typeof createRestartSignup>
export type SetDeviceNameErrorPayload = More.ReturnType<typeof createSetDeviceNameError>
export type ShowPaperKeyPayload = More.ReturnType<typeof createShowPaperKey>
export type SignupErrorPayload = More.ReturnType<typeof createSignupError>
export type StartRequestInvitePayload = More.ReturnType<typeof createStartRequestInvite>
export type SubmitDeviceNamePayload = More.ReturnType<typeof createSubmitDeviceName>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createCheckInviteCode>
  | More.ReturnType<typeof createCheckInviteCodeError>
  | More.ReturnType<typeof createCheckPassphrase>
  | More.ReturnType<typeof createCheckPassphraseError>
  | More.ReturnType<typeof createCheckUsernameEmail>
  | More.ReturnType<typeof createCheckUsernameEmailError>
  | More.ReturnType<typeof createClearDeviceNameError>
  | More.ReturnType<typeof createRequestInvite>
  | More.ReturnType<typeof createRequestInviteError>
  | More.ReturnType<typeof createResetSignup>
  | More.ReturnType<typeof createRestartSignup>
  | More.ReturnType<typeof createSetDeviceNameError>
  | More.ReturnType<typeof createShowPaperKey>
  | More.ReturnType<typeof createSignupError>
  | More.ReturnType<typeof createStartRequestInvite>
  | More.ReturnType<typeof createSubmitDeviceName>
  | More.ReturnType<typeof createSubmitDeviceNameError>
  | More.ReturnType<typeof createWaiting>
  | {type: 'common:resetStore', payload: void}
