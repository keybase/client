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
export const loggedin = 'login:loggedin'
export const loggedout = 'login:loggedout'
export const login = 'login:login'
export const loginError = 'login:loginError'
export const logout = 'login:logout'
export const navBasedOnLoginAndInitialState = 'login:navBasedOnLoginAndInitialState'
export const onFinish = 'login:onFinish'
export const setDeletedSelf = 'login:setDeletedSelf'

// Payload Types
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoggedinPayload = void
type _LoggedoutPayload = void
type _LoginErrorPayload = $ReadOnly<{|error: ?HiddenString|}>
type _LoginPayload = $ReadOnly<{|
  usernameOrEmail: string,
  passphrase: HiddenString,
|}>
type _LogoutPayload = void
type _NavBasedOnLoginAndInitialStatePayload = void
type _OnFinishPayload = void
type _SetDeletedSelfPayload = $ReadOnly<{|deletedUsername: string|}>

// Action Creators
export const createLaunchAccountResetWebPage = (payload: _LaunchAccountResetWebPagePayload) => ({error: false, payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (payload: _LaunchForgotPasswordWebPagePayload) => ({error: false, payload, type: launchForgotPasswordWebPage})
export const createLoggedin = (payload: _LoggedinPayload) => ({error: false, payload, type: loggedin})
export const createLoggedout = (payload: _LoggedoutPayload) => ({error: false, payload, type: loggedout})
export const createLogin = (payload: _LoginPayload) => ({error: false, payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload) => ({error: false, payload, type: loginError})
export const createLogout = (payload: _LogoutPayload) => ({error: false, payload, type: logout})
export const createNavBasedOnLoginAndInitialState = (payload: _NavBasedOnLoginAndInitialStatePayload) => ({error: false, payload, type: navBasedOnLoginAndInitialState})
export const createOnFinish = (payload: _OnFinishPayload) => ({error: false, payload, type: onFinish})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({error: false, payload, type: setDeletedSelf})

// Action Payloads
export type LaunchAccountResetWebPagePayload = $Call<typeof createLaunchAccountResetWebPage, _LaunchAccountResetWebPagePayload>
export type LaunchForgotPasswordWebPagePayload = $Call<typeof createLaunchForgotPasswordWebPage, _LaunchForgotPasswordWebPagePayload>
export type LoggedinPayload = $Call<typeof createLoggedin, _LoggedinPayload>
export type LoggedoutPayload = $Call<typeof createLoggedout, _LoggedoutPayload>
export type LoginErrorPayload = $Call<typeof createLoginError, _LoginErrorPayload>
export type LoginPayload = $Call<typeof createLogin, _LoginPayload>
export type LogoutPayload = $Call<typeof createLogout, _LogoutPayload>
export type NavBasedOnLoginAndInitialStatePayload = $Call<typeof createNavBasedOnLoginAndInitialState, _NavBasedOnLoginAndInitialStatePayload>
export type OnFinishPayload = $Call<typeof createOnFinish, _OnFinishPayload>
export type SetDeletedSelfPayload = $Call<typeof createSetDeletedSelf, _SetDeletedSelfPayload>

// All Actions
// prettier-ignore
export type Actions =
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoggedinPayload
  | LoggedoutPayload
  | LoginErrorPayload
  | LoginPayload
  | LogoutPayload
  | NavBasedOnLoginAndInitialStatePayload
  | OnFinishPayload
  | SetDeletedSelfPayload
  | {type: 'common:resetStore', payload: void}
