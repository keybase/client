// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define,import/no-duplicates */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/login'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'login:'
export const launchAccountResetWebPage = 'login:launchAccountResetWebPage'
export const launchForgotPasswordWebPage = 'login:launchForgotPasswordWebPage'
export const login = 'login:login'
export const loginError = 'login:loginError'

// Payload Types
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoginErrorPayload = {readonly error: HiddenString | null}
type _LoginPayload = {readonly username: string; readonly password: HiddenString}

// Action Creators
export const createLaunchAccountResetWebPage = (
  payload: _LaunchAccountResetWebPagePayload
): LaunchAccountResetWebPagePayload => ({payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (
  payload: _LaunchForgotPasswordWebPagePayload
): LaunchForgotPasswordWebPagePayload => ({payload, type: launchForgotPasswordWebPage})
export const createLogin = (payload: _LoginPayload): LoginPayload => ({payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload): LoginErrorPayload => ({
  payload,
  type: loginError,
})

// Action Payloads
export type LaunchAccountResetWebPagePayload = {
  readonly payload: _LaunchAccountResetWebPagePayload
  readonly type: 'login:launchAccountResetWebPage'
}
export type LaunchForgotPasswordWebPagePayload = {
  readonly payload: _LaunchForgotPasswordWebPagePayload
  readonly type: 'login:launchForgotPasswordWebPage'
}
export type LoginErrorPayload = {readonly payload: _LoginErrorPayload; readonly type: 'login:loginError'}
export type LoginPayload = {readonly payload: _LoginPayload; readonly type: 'login:login'}

// All Actions
// prettier-ignore
export type Actions =
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoginErrorPayload
  | LoginPayload
  | {type: 'common:resetStore', payload: null}
