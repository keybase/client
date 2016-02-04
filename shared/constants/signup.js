/* @flow */

import type {TypedAsyncAction, TypedAction} from '../constants/types/flux'

export const checkInviteCode = 'signup:checkInviteCode'
export type CheckInviteCode = TypedAction<'signup:checkInviteCode', {valid: true}, {errorText: string}>
export type CheckInviteCodeCreator = TypedAsyncAction<CheckInviteCode>

export type SignupActions = CheckInviteCode

