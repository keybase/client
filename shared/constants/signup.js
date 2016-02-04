/* @flow */

import type {TypedAction} from '../constants/types/flux'

export const checkInviteCode = 'signup:checkInviteCode'
export type CheckInviteCode = TypedAction<'signup:checkInviteCode', {inviteCode: string}, {errorText: string}>

export const checkUsernameEmail = 'signup:checkUsernameEmail'
export type CheckUsernameEmail = TypedAction<'signup:checkUsernameEmail', {username: string, email: string}, {emailError: ?string, usernameError: ?string, email: ?string, username: ?string}>

export type SignupActions = CheckInviteCode | CheckUsernameEmail

