// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/login'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer
export const launchAccountResetWebPage = 'login:launchAccountResetWebPage'
export const launchForgotPasswordWebPage = 'login:launchForgotPasswordWebPage'
export const login = 'login:login'
export const loginError = 'login:loginError'

// Payload Types
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoginErrorPayload = $ReadOnly<{|error: ?HiddenString|}>
type _LoginPayload = $ReadOnly<{|
  usernameOrEmail: string,
  passphrase: HiddenString,
|}>

// Action Creators
export const createLaunchAccountResetWebPage = (payload: _LaunchAccountResetWebPagePayload) => ({error: false, payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (payload: _LaunchForgotPasswordWebPagePayload) => ({error: false, payload, type: launchForgotPasswordWebPage})
export const createLogin = (payload: _LoginPayload) => ({error: false, payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload) => ({error: false, payload, type: loginError})

// Action Payloads
export type LaunchAccountResetWebPagePayload = $Call<typeof createLaunchAccountResetWebPage, _LaunchAccountResetWebPagePayload>
export type LaunchForgotPasswordWebPagePayload = $Call<typeof createLaunchForgotPasswordWebPage, _LaunchForgotPasswordWebPagePayload>
export type LoginErrorPayload = $Call<typeof createLoginError, _LoginErrorPayload>
export type LoginPayload = $Call<typeof createLogin, _LoginPayload>

// All Actions
// prettier-ignore
export type Actions =
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoginErrorPayload
  | LoginPayload
  | {type: 'common:resetStore', payload: void}
