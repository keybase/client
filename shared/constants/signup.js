/* @flow */

import SecureString from '../util/secure-string'
import type {TypedAction} from '../constants/types/flux'

export const checkInviteCode = 'signup:checkInviteCode'
export type CheckInviteCode = TypedAction<'signup:checkInviteCode', {inviteCode: string}, {errorText: string}>

export const checkUsernameEmail = 'signup:checkUsernameEmail'
export type CheckUsernameEmail = TypedAction<'signup:checkUsernameEmail', {username: string, email: string}, {emailError: ?string, usernameError: ?string, email: ?string, username: ?string}>

export const checkPassphrase = 'signup:checkPassphrase'
export type CheckPassphrase = TypedAction<'signup:checkPassphrase', {passphrase: SecureString}, {passphraseError: SecureString}>

export type SignupActions = CheckInviteCode | CheckUsernameEmail | CheckPassphrase

