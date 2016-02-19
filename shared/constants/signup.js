/* @flow */

import HiddenString from '../util/hidden-string'
import type {TypedAction} from '../constants/types/flux'

export const checkInviteCode = 'signup:checkInviteCode'
export type CheckInviteCode = TypedAction<'signup:checkInviteCode', {inviteCode: string}, {errorText: string}>

export const checkUsernameEmail = 'signup:checkUsernameEmail'
export type CheckUsernameEmail = TypedAction<'signup:checkUsernameEmail', {username: string, email: string}, {emailError: ?string, usernameError: ?string, email: ?string, username: ?string}>

export const checkPassphrase = 'signup:checkPassphrase'
export type CheckPassphrase = TypedAction<'signup:checkPassphrase', {passphrase: HiddenString}, {passphraseError: HiddenString}>

export const submitDeviceName = 'signup:submitDeviceName'
export type SubmitDeviceName = TypedAction<'signup:submitDeviceName', {deviceName: string}, {deviceNameError: string}>

export const signup = 'signup:signup'
export type Signup = TypedAction<'signup:signup', {}, {signupError: HiddenString}>

export const showPaperKey = 'signup:showPaperKey'
export type ShowPaperKey = TypedAction<'signup:showPaperKey', {paperkey: HiddenString}, {}>

export const showSuccess = 'signup:showSuccess'
export type ShowSuccess = TypedAction<'signup:showSuccess', {}, {}>

export type SignupActions = CheckInviteCode | CheckUsernameEmail | CheckPassphrase | SubmitDeviceName | Signup | ShowPaperKey | ShowSuccess

