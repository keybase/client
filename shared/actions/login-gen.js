// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier,no-use-before-define */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Types from '../constants/types/login'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer
export const addNewDevice = 'login:addNewDevice'
export const configuredAccounts = 'login:configuredAccounts'
export const launchAccountResetWebPage = 'login:launchAccountResetWebPage'
export const launchForgotPasswordWebPage = 'login:launchForgotPasswordWebPage'
export const loggedout = 'login:loggedout'
export const login = 'login:login'
export const loginError = 'login:loginError'
export const logout = 'login:logout'
export const navBasedOnLoginAndInitialState = 'login:navBasedOnLoginAndInitialState'
export const onBack = 'login:onBack'
export const onFinish = 'login:onFinish'
export const setDeletedSelf = 'login:setDeletedSelf'
export const setRevokedSelf = 'login:setRevokedSelf'
export const showCodePage = 'login:showCodePage'
export const showDeviceListPage = 'login:showDeviceListPage'
export const showGPGPage = 'login:showGPGPage'
export const showNewDeviceNamePage = 'login:showNewDeviceNamePage'
export const showPassphrasePage = 'login:showPassphrasePage'
export const startLogin = 'login:startLogin'
export const submitPassphrase = 'login:submitPassphrase'
export const submitProvisionDeviceName = 'login:submitProvisionDeviceName'
export const submitProvisionDeviceSelect = 'login:submitProvisionDeviceSelect'
export const submitProvisionGPGMethod = 'login:submitProvisionGPGMethod'
export const submitProvisionPassphrase = 'login:submitProvisionPassphrase'
export const submitProvisionPasswordInsteadOfDevice = 'login:submitProvisionPasswordInsteadOfDevice'
export const submitProvisionTextCode = 'login:submitProvisionTextCode'
export const submitUsernameOrEmail = 'login:submitUsernameOrEmail'

// Payload Types
type _AddNewDevicePayload = $ReadOnly<{|otherDeviceType: 'desktop' | 'phone' | 'paperkey'|}>
type _ConfiguredAccountsPayload = $ReadOnly<{|accounts: ?Array<{|hasStoredSecret: boolean, username: string|}>|}>
type _ConfiguredAccountsPayloadError = $ReadOnly<{|error: Error|}>
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoggedoutPayload = void
type _LoginErrorPayload = $ReadOnly<{|error: ?HiddenString|}>
type _LoginPayload = $ReadOnly<{|
  usernameOrEmail: string,
  passphrase: HiddenString,
|}>
type _LogoutPayload = void
type _NavBasedOnLoginAndInitialStatePayload = void
type _OnBackPayload = void
type _OnFinishPayload = void
type _SetDeletedSelfPayload = $ReadOnly<{|deletedUsername: string|}>
type _SetRevokedSelfPayload = $ReadOnly<{|revoked: string|}>
type _ShowCodePagePayload = $ReadOnly<{|
  code: HiddenString,
  error: ?HiddenString,
|}>
type _ShowDeviceListPagePayload = $ReadOnly<{|
  canSelectNoDevice: boolean,
  devices: Array<Types.Device>,
|}>
type _ShowGPGPagePayload = void
type _ShowNewDeviceNamePagePayload = $ReadOnly<{|
  existingDevices: Array<string>,
  error: ?HiddenString,
|}>
type _ShowPassphrasePagePayload = $ReadOnly<{|error: ?HiddenString|}>
type _StartLoginPayload = void
type _SubmitPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _SubmitProvisionDeviceNamePayload = $ReadOnly<{|name: string|}>
type _SubmitProvisionDeviceSelectPayload = $ReadOnly<{|name: string|}>
type _SubmitProvisionGPGMethodPayload = $ReadOnly<{|exportKey: boolean|}>
type _SubmitProvisionPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _SubmitProvisionPasswordInsteadOfDevicePayload = void
type _SubmitProvisionTextCodePayload = $ReadOnly<{|phrase: HiddenString|}>
type _SubmitUsernameOrEmailPayload = $ReadOnly<{|usernameOrEmail: string|}>

// Action Creators
/**
 * Ask the user for a new device name
 */
export const createShowNewDeviceNamePage = (payload: _ShowNewDeviceNamePagePayload) => ({error: false, payload, type: showNewDeviceNamePage})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceListPage = (payload: _ShowDeviceListPagePayload) => ({error: false, payload, type: showDeviceListPage})
export const createAddNewDevice = (payload: _AddNewDevicePayload) => ({error: false, payload, type: addNewDevice})
export const createConfiguredAccounts = (payload: _ConfiguredAccountsPayload) => ({error: false, payload, type: configuredAccounts})
export const createConfiguredAccountsError = (payload: _ConfiguredAccountsPayloadError) => ({error: true, payload, type: configuredAccounts})
export const createLaunchAccountResetWebPage = (payload: _LaunchAccountResetWebPagePayload) => ({error: false, payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (payload: _LaunchForgotPasswordWebPagePayload) => ({error: false, payload, type: launchForgotPasswordWebPage})
export const createLoggedout = (payload: _LoggedoutPayload) => ({error: false, payload, type: loggedout})
export const createLogin = (payload: _LoginPayload) => ({error: false, payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload) => ({error: false, payload, type: loginError})
export const createLogout = (payload: _LogoutPayload) => ({error: false, payload, type: logout})
export const createNavBasedOnLoginAndInitialState = (payload: _NavBasedOnLoginAndInitialStatePayload) => ({error: false, payload, type: navBasedOnLoginAndInitialState})
export const createOnBack = (payload: _OnBackPayload) => ({error: false, payload, type: onBack})
export const createOnFinish = (payload: _OnFinishPayload) => ({error: false, payload, type: onFinish})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({error: false, payload, type: setDeletedSelf})
export const createSetRevokedSelf = (payload: _SetRevokedSelfPayload) => ({error: false, payload, type: setRevokedSelf})
export const createShowCodePage = (payload: _ShowCodePagePayload) => ({error: false, payload, type: showCodePage})
export const createShowGPGPage = (payload: _ShowGPGPagePayload) => ({error: false, payload, type: showGPGPage})
export const createShowPassphrasePage = (payload: _ShowPassphrasePagePayload) => ({error: false, payload, type: showPassphrasePage})
export const createStartLogin = (payload: _StartLoginPayload) => ({error: false, payload, type: startLogin})
export const createSubmitPassphrase = (payload: _SubmitPassphrasePayload) => ({error: false, payload, type: submitPassphrase})
export const createSubmitProvisionDeviceName = (payload: _SubmitProvisionDeviceNamePayload) => ({error: false, payload, type: submitProvisionDeviceName})
export const createSubmitProvisionDeviceSelect = (payload: _SubmitProvisionDeviceSelectPayload) => ({error: false, payload, type: submitProvisionDeviceSelect})
export const createSubmitProvisionGPGMethod = (payload: _SubmitProvisionGPGMethodPayload) => ({error: false, payload, type: submitProvisionGPGMethod})
export const createSubmitProvisionPassphrase = (payload: _SubmitProvisionPassphrasePayload) => ({error: false, payload, type: submitProvisionPassphrase})
export const createSubmitProvisionPasswordInsteadOfDevice = (payload: _SubmitProvisionPasswordInsteadOfDevicePayload) => ({error: false, payload, type: submitProvisionPasswordInsteadOfDevice})
export const createSubmitProvisionTextCode = (payload: _SubmitProvisionTextCodePayload) => ({error: false, payload, type: submitProvisionTextCode})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({error: false, payload, type: submitUsernameOrEmail})

// Action Payloads
export type AddNewDevicePayload = $Call<typeof createAddNewDevice, _AddNewDevicePayload>
export type ConfiguredAccountsPayload = $Call<typeof createConfiguredAccounts, _ConfiguredAccountsPayload>
export type ConfiguredAccountsPayloadError = $Call<typeof createConfiguredAccountsError, _ConfiguredAccountsPayloadError>
export type LaunchAccountResetWebPagePayload = $Call<typeof createLaunchAccountResetWebPage, _LaunchAccountResetWebPagePayload>
export type LaunchForgotPasswordWebPagePayload = $Call<typeof createLaunchForgotPasswordWebPage, _LaunchForgotPasswordWebPagePayload>
export type LoggedoutPayload = $Call<typeof createLoggedout, _LoggedoutPayload>
export type LoginErrorPayload = $Call<typeof createLoginError, _LoginErrorPayload>
export type LoginPayload = $Call<typeof createLogin, _LoginPayload>
export type LogoutPayload = $Call<typeof createLogout, _LogoutPayload>
export type NavBasedOnLoginAndInitialStatePayload = $Call<typeof createNavBasedOnLoginAndInitialState, _NavBasedOnLoginAndInitialStatePayload>
export type OnBackPayload = $Call<typeof createOnBack, _OnBackPayload>
export type OnFinishPayload = $Call<typeof createOnFinish, _OnFinishPayload>
export type SetDeletedSelfPayload = $Call<typeof createSetDeletedSelf, _SetDeletedSelfPayload>
export type SetRevokedSelfPayload = $Call<typeof createSetRevokedSelf, _SetRevokedSelfPayload>
export type ShowCodePagePayload = $Call<typeof createShowCodePage, _ShowCodePagePayload>
export type ShowDeviceListPagePayload = $Call<typeof createShowDeviceListPage, _ShowDeviceListPagePayload>
export type ShowGPGPagePayload = $Call<typeof createShowGPGPage, _ShowGPGPagePayload>
export type ShowNewDeviceNamePagePayload = $Call<typeof createShowNewDeviceNamePage, _ShowNewDeviceNamePagePayload>
export type ShowPassphrasePagePayload = $Call<typeof createShowPassphrasePage, _ShowPassphrasePagePayload>
export type StartLoginPayload = $Call<typeof createStartLogin, _StartLoginPayload>
export type SubmitPassphrasePayload = $Call<typeof createSubmitPassphrase, _SubmitPassphrasePayload>
export type SubmitProvisionDeviceNamePayload = $Call<typeof createSubmitProvisionDeviceName, _SubmitProvisionDeviceNamePayload>
export type SubmitProvisionDeviceSelectPayload = $Call<typeof createSubmitProvisionDeviceSelect, _SubmitProvisionDeviceSelectPayload>
export type SubmitProvisionGPGMethodPayload = $Call<typeof createSubmitProvisionGPGMethod, _SubmitProvisionGPGMethodPayload>
export type SubmitProvisionPassphrasePayload = $Call<typeof createSubmitProvisionPassphrase, _SubmitProvisionPassphrasePayload>
export type SubmitProvisionPasswordInsteadOfDevicePayload = $Call<typeof createSubmitProvisionPasswordInsteadOfDevice, _SubmitProvisionPasswordInsteadOfDevicePayload>
export type SubmitProvisionTextCodePayload = $Call<typeof createSubmitProvisionTextCode, _SubmitProvisionTextCodePayload>
export type SubmitUsernameOrEmailPayload = $Call<typeof createSubmitUsernameOrEmail, _SubmitUsernameOrEmailPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ConfiguredAccountsPayload
  | ConfiguredAccountsPayloadError
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoggedoutPayload
  | LoginErrorPayload
  | LoginPayload
  | LogoutPayload
  | NavBasedOnLoginAndInitialStatePayload
  | OnBackPayload
  | OnFinishPayload
  | SetDeletedSelfPayload
  | SetRevokedSelfPayload
  | ShowCodePagePayload
  | ShowDeviceListPagePayload
  | ShowGPGPagePayload
  | ShowNewDeviceNamePagePayload
  | ShowPassphrasePagePayload
  | StartLoginPayload
  | SubmitPassphrasePayload
  | SubmitProvisionDeviceNamePayload
  | SubmitProvisionDeviceSelectPayload
  | SubmitProvisionGPGMethodPayload
  | SubmitProvisionPassphrasePayload
  | SubmitProvisionPasswordInsteadOfDevicePayload
  | SubmitProvisionTextCodePayload
  | SubmitUsernameOrEmailPayload
  | {type: 'common:resetStore', payload: void}
