// @flow
import HiddenString from '../util/hidden-string'
import type {TypedAction} from '../constants/types/flux'

export type AutoInviteRequestState = 'NotRequested' | 'Requested' | 'Done'

export const checkInviteCode = 'signup:checkInviteCode'
export type CheckInviteCode = TypedAction<
  'signup:checkInviteCode',
  {inviteCode: string},
  {errorText: string}
>

export const startRequestInvite = 'signup:startRequestInvite'
export type StartRequestInvite = TypedAction<
  'signup:startRequestInvite',
  {},
  {}
>

export const requestInvite = 'signup:requestInvite'
export type RequestInvite = TypedAction<
  'signup:requestInvite',
  {email: string, name: string},
  {emailError: ?Error, nameError: ?Error, email: ?string, name: ?string}
>

export const checkUsernameEmail = 'signup:checkUsernameEmail'
export type CheckUsernameEmail = TypedAction<
  'signup:checkUsernameEmail',
  {username: string, email: string},
  {
    emailError: ?Error,
    usernameError: ?Error,
    email: ?string,
    username: ?string,
  }
>

export const checkPassphrase = 'signup:checkPassphrase'
export type CheckPassphrase = TypedAction<
  'signup:checkPassphrase',
  {passphrase: HiddenString},
  {passphraseError: HiddenString}
>

export const submitDeviceName = 'signup:submitDeviceName'
export type SubmitDeviceName = TypedAction<
  'signup:submitDeviceName',
  {deviceName: string},
  {deviceNameError: string}
>

export const signup = 'signup:signup'
export type Signup = TypedAction<
  'signup:signup',
  {},
  {signupError: HiddenString}
>

export const showPaperKey = 'signup:showPaperKey'
export type ShowPaperKey = TypedAction<
  'signup:showPaperKey',
  {paperkey: HiddenString},
  {}
>

export const showSuccess = 'signup:showSuccess'
export type ShowSuccess = TypedAction<'signup:showSuccess', {}, {}>

export const resetSignup = 'signup:resetSignup'
export type ResetSignup = TypedAction<'signup:resetSignup', void, void>

export const restartSignup = 'signup:restartSignup'
export type RestartSignup = TypedAction<'signup:restartSignup', {}, {}>

export const signupWaiting = 'signup:waiting'
export type SignupWaiting = TypedAction<'signup:waiting', boolean, void>

export type Actions =
  | CheckInviteCode
  | CheckUsernameEmail
  | CheckPassphrase
  | SubmitDeviceName
  | Signup
  | ShowPaperKey
  | ShowSuccess
  | RestartSignup
  | SignupWaiting

export type State = {
  deviceName: ?string,
  deviceNameError: ?string,
  email: ?string,
  emailError: ?Error,
  inviteCode: ?string,
  inviteCodeError: ?string,
  nameError: ?string,
  paperkey: ?HiddenString,
  passphrase: ?HiddenString,
  passphraseError: ?HiddenString,
  phase:
    | 'inviteCode'
    | 'usernameAndEmail'
    | 'passphraseSignup'
    | 'deviceName'
    | 'signupLoading'
    | 'success'
    | 'signupError'
    | 'requestInvite'
    | 'requestInviteSuccess',
  signupError: ?HiddenString,
  username: ?string,
  usernameError: ?Error,
  waiting: boolean,
}
