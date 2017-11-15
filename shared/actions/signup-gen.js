// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/signup'
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
export const showSuccess = 'signup:showSuccess'
export const signup = 'signup:signup'
export const startRequestInvite = 'signup:startRequestInvite'
export const submitDeviceName = 'signup:submitDeviceName'
export const waiting = 'signup:waiting'

// Action Creators
export const createCheckInviteCode = (payload: {|+inviteCode: string|}) => ({error: false, payload, type: checkInviteCode})
export const createCheckInviteCodeError = (payload: {|+errorText: string|}) => ({error: true, payload, type: checkInviteCode})
export const createCheckPassphrase = (payload: {|+passphrase: HiddenString|}) => ({error: false, payload, type: checkPassphrase})
export const createCheckPassphraseError = (payload: {|+passphraseError: HiddenString|}) => ({error: true, payload, type: checkPassphrase})
export const createCheckUsernameEmail = (payload: {|+username: string, +email: string|}) => ({error: false, payload, type: checkUsernameEmail})
export const createCheckUsernameEmailError = (payload: {|+emailError: ?Error, +usernameError: ?Error, +email: ?string, +username: ?string|}) => ({error: true, payload, type: checkUsernameEmail})
export const createClearDeviceNameError = () => ({error: false, payload: undefined, type: clearDeviceNameError})
export const createRequestInvite = (payload: {|+email: string, +name: string|}) => ({error: false, payload, type: requestInvite})
export const createRequestInviteError = (payload: {|+emailError: ?Error, +nameError: ?Error, +email: ?string, +name: ?string|}) => ({error: true, payload, type: requestInvite})
export const createResetSignup = () => ({error: false, payload: undefined, type: resetSignup})
export const createRestartSignup = () => ({error: false, payload: undefined, type: restartSignup})
export const createSetDeviceNameError = (payload: {|+deviceNameError: string|}) => ({error: false, payload, type: setDeviceNameError})
export const createShowPaperKey = (payload: {|+paperkey: HiddenString|}) => ({error: false, payload, type: showPaperKey})
export const createShowSuccess = () => ({error: false, payload: undefined, type: showSuccess})
export const createSignup = () => ({error: false, payload: undefined, type: signup})
export const createSignupError = (payload: {|+signupError: HiddenString|}) => ({error: true, payload, type: signup})
export const createStartRequestInvite = () => ({error: false, payload: undefined, type: startRequestInvite})
export const createSubmitDeviceName = (payload: {|+deviceName: string|}) => ({error: false, payload, type: submitDeviceName})
export const createSubmitDeviceNameError = (payload: {|+deviceNameError: string|}) => ({error: true, payload, type: submitDeviceName})
export const createWaiting = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waiting})

// Action Payloads
export type CheckInviteCodePayload = More.ReturnType<typeof createCheckInviteCode>
export type CheckInviteCodeErrorPayload = More.ReturnType<typeof createCheckInviteCodeError>
export type CheckPassphrasePayload = More.ReturnType<typeof createCheckPassphrase>
export type CheckPassphraseErrorPayload = More.ReturnType<typeof createCheckPassphraseError>
export type CheckUsernameEmailPayload = More.ReturnType<typeof createCheckUsernameEmail>
export type CheckUsernameEmailErrorPayload = More.ReturnType<typeof createCheckUsernameEmailError>
export type ClearDeviceNameErrorPayload = More.ReturnType<typeof createClearDeviceNameError>
export type RequestInvitePayload = More.ReturnType<typeof createRequestInvite>
export type RequestInviteErrorPayload = More.ReturnType<typeof createRequestInviteError>
export type ResetSignupPayload = More.ReturnType<typeof createResetSignup>
export type RestartSignupPayload = More.ReturnType<typeof createRestartSignup>
export type SetDeviceNameErrorPayload = More.ReturnType<typeof createSetDeviceNameError>
export type ShowPaperKeyPayload = More.ReturnType<typeof createShowPaperKey>
export type ShowSuccessPayload = More.ReturnType<typeof createShowSuccess>
export type SignupPayload = More.ReturnType<typeof createSignup>
export type SignupErrorPayload = More.ReturnType<typeof createSignupError>
export type StartRequestInvitePayload = More.ReturnType<typeof createStartRequestInvite>
export type SubmitDeviceNamePayload = More.ReturnType<typeof createSubmitDeviceName>
export type SubmitDeviceNameErrorPayload = More.ReturnType<typeof createSubmitDeviceNameError>
export type WaitingPayload = More.ReturnType<typeof createWaiting>

// Reducer type
// prettier-ignore
export type ReducerMap = {|'common:resetStore': (state: Types.State, action: {type: 'common:resetStore', payload: void}) => Types.State, 'signup:checkInviteCode': (state: Types.State, action: CheckInviteCodePayload|CheckInviteCodeErrorPayload) => Types.State, 'signup:checkPassphrase': (state: Types.State, action: CheckPassphrasePayload|CheckPassphraseErrorPayload) => Types.State, 'signup:checkUsernameEmail': (state: Types.State, action: CheckUsernameEmailPayload|CheckUsernameEmailErrorPayload) => Types.State, 'signup:clearDeviceNameError': (state: Types.State, action: ClearDeviceNameErrorPayload) => Types.State, 'signup:requestInvite': (state: Types.State, action: RequestInvitePayload|RequestInviteErrorPayload) => Types.State, 'signup:resetSignup': (state: Types.State, action: ResetSignupPayload) => Types.State, 'signup:restartSignup': (state: Types.State, action: RestartSignupPayload) => Types.State, 'signup:setDeviceNameError': (state: Types.State, action: SetDeviceNameErrorPayload) => Types.State, 'signup:showPaperKey': (state: Types.State, action: ShowPaperKeyPayload) => Types.State, 'signup:showSuccess': (state: Types.State, action: ShowSuccessPayload) => Types.State, 'signup:signup': (state: Types.State, action: SignupPayload|SignupErrorPayload) => Types.State, 'signup:startRequestInvite': (state: Types.State, action: StartRequestInvitePayload) => Types.State, 'signup:submitDeviceName': (state: Types.State, action: SubmitDeviceNamePayload|SubmitDeviceNameErrorPayload) => Types.State, 'signup:waiting': (state: Types.State, action: WaitingPayload) => Types.State|}

// All Actions
// prettier-ignore
export type Actions = CheckInviteCodePayload
 | CheckInviteCodeErrorPayload | CheckPassphrasePayload
 | CheckPassphraseErrorPayload | CheckUsernameEmailPayload
 | CheckUsernameEmailErrorPayload | ClearDeviceNameErrorPayload | RequestInvitePayload
 | RequestInviteErrorPayload | ResetSignupPayload | RestartSignupPayload | SetDeviceNameErrorPayload | ShowPaperKeyPayload | ShowSuccessPayload | SignupPayload
 | SignupErrorPayload | StartRequestInvitePayload | SubmitDeviceNamePayload
 | SubmitDeviceNameErrorPayload | WaitingPayload | {type: 'common:resetStore', payload: void}
