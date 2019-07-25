// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import HiddenString from '../util/hidden-string'
import {RPCError} from '../util/errors'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer. NEVER dispatch this
export const typePrefix = 'login:'
export const launchAccountResetWebPage = 'login:launchAccountResetWebPage'
export const launchForgotPasswordWebPage = 'login:launchForgotPasswordWebPage'
export const loadIsOnline = 'login:loadIsOnline'
export const loadedIsOnline = 'login:loadedIsOnline'
export const login = 'login:login'
export const loginError = 'login:loginError'

// Payload Types
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoadIsOnlinePayload = void
type _LoadedIsOnlinePayload = {readonly result: boolean}
type _LoginErrorPayload = {readonly error: RPCError | null}
type _LoginPayload = {readonly username: string; readonly password: HiddenString}

// Action Creators
export const createLaunchAccountResetWebPage = (
  payload: _LaunchAccountResetWebPagePayload
): LaunchAccountResetWebPagePayload => ({payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (
  payload: _LaunchForgotPasswordWebPagePayload
): LaunchForgotPasswordWebPagePayload => ({payload, type: launchForgotPasswordWebPage})
export const createLoadIsOnline = (payload: _LoadIsOnlinePayload): LoadIsOnlinePayload => ({
  payload,
  type: loadIsOnline,
})
export const createLoadedIsOnline = (payload: _LoadedIsOnlinePayload): LoadedIsOnlinePayload => ({
  payload,
  type: loadedIsOnline,
})
export const createLogin = (payload: _LoginPayload): LoginPayload => ({payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload): LoginErrorPayload => ({
  payload,
  type: loginError,
})

// Action Payloads
export type LaunchAccountResetWebPagePayload = {
  readonly payload: _LaunchAccountResetWebPagePayload
  readonly type: typeof launchAccountResetWebPage
}
export type LaunchForgotPasswordWebPagePayload = {
  readonly payload: _LaunchForgotPasswordWebPagePayload
  readonly type: typeof launchForgotPasswordWebPage
}
export type LoadIsOnlinePayload = {readonly payload: _LoadIsOnlinePayload; readonly type: typeof loadIsOnline}
export type LoadedIsOnlinePayload = {
  readonly payload: _LoadedIsOnlinePayload
  readonly type: typeof loadedIsOnline
}
export type LoginErrorPayload = {readonly payload: _LoginErrorPayload; readonly type: typeof loginError}
export type LoginPayload = {readonly payload: _LoginPayload; readonly type: typeof login}

// All Actions
// prettier-ignore
export type Actions =
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoadIsOnlinePayload
  | LoadedIsOnlinePayload
  | LoginErrorPayload
  | LoginPayload
  | {type: 'common:resetStore', payload: {}}
