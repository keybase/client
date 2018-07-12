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
export const chooseGPGMethod = 'login:chooseGPGMethod'
export const configuredAccounts = 'login:configuredAccounts'
export const launchAccountResetWebPage = 'login:launchAccountResetWebPage'
export const launchForgotPasswordWebPage = 'login:launchForgotPasswordWebPage'
export const login = 'login:login'
export const loginError = 'login:loginError'
export const logout = 'login:logout'
export const logoutDone = 'login:logoutDone'
export const navBasedOnLoginAndInitialState = 'login:navBasedOnLoginAndInitialState'
export const onBack = 'login:onBack'
export const onFinish = 'login:onFinish'
export const provisionDeviceSelect = 'login:provisionDeviceSelect'
export const provisionPasswordInsteadOfDevice = 'login:provisionPasswordInsteadOfDevice'
export const provisionTextCodeEntered = 'login:provisionTextCodeEntered'
export const provisioningError = 'login:provisioningError'
export const qrScanned = 'login:qrScanned'
export const setDeletedSelf = 'login:setDeletedSelf'
export const setRevokedSelf = 'login:setRevokedSelf'
export const setTextCode = 'login:setTextCode'
export const showDeviceList = 'login:showDeviceList'
export const showNewDeviceName = 'login:showNewDeviceName'
export const startLogin = 'login:startLogin'
export const submitDeviceName = 'login:submitDeviceName'
export const submitPassphrase = 'login:submitPassphrase'
export const submitUsernameOrEmail = 'login:submitUsernameOrEmail'

// Payload Types
type _AddNewDevicePayload = $ReadOnly<{|otherDeviceType: 'desktop' | 'phone' | 'paperkey'|}>
type _ChooseGPGMethodPayload = $ReadOnly<{|exportKey: boolean|}>
type _ConfiguredAccountsPayload = $ReadOnly<{|accounts: ?Array<{|hasStoredSecret: boolean, username: string|}>|}>
type _ConfiguredAccountsPayloadError = $ReadOnly<{|error: Error|}>
type _LaunchAccountResetWebPagePayload = void
type _LaunchForgotPasswordWebPagePayload = void
type _LoginErrorPayload = $ReadOnly<{|error: string|}>
type _LoginPayload = $ReadOnly<{|
  usernameOrEmail: string,
  passphrase: HiddenString,
|}>
type _LogoutDonePayload = void
type _LogoutPayload = void
type _NavBasedOnLoginAndInitialStatePayload = void
type _OnBackPayload = void
type _OnFinishPayload = void
type _ProvisionDeviceSelectPayload = $ReadOnly<{|name: string|}>
type _ProvisionPasswordInsteadOfDevicePayload = void
type _ProvisionTextCodeEnteredPayload = $ReadOnly<{|phrase: HiddenString|}>
type _ProvisioningErrorPayload = $ReadOnly<{|error: Error|}>
type _QrScannedPayload = $ReadOnly<{|phrase: HiddenString|}>
type _SetDeletedSelfPayload = $ReadOnly<{|deletedUsername: string|}>
type _SetRevokedSelfPayload = $ReadOnly<{|revoked: string|}>
type _SetTextCodePayload = $ReadOnly<{|textCode: HiddenString|}>
type _ShowDeviceListPayload = $ReadOnly<{|
  canSelectNoDevice: boolean,
  devices: Array<Types.Device>,
|}>
type _ShowNewDeviceNamePayload = $ReadOnly<{|
  existingDevices: Array<string>,
  error: string,
|}>
type _StartLoginPayload = void
type _SubmitDeviceNamePayload = $ReadOnly<{|deviceName: string|}>
type _SubmitPassphrasePayload = $ReadOnly<{|passphrase: HiddenString|}>
type _SubmitUsernameOrEmailPayload = $ReadOnly<{|usernameOrEmail: string|}>

// Action Creators
/**
 * Ask the user for a new device name
 */
export const createShowNewDeviceName = (payload: _ShowNewDeviceNamePayload) => ({error: false, payload, type: showNewDeviceName})
/**
 * Show the list of devices the user can use to provision a device
 */
export const createShowDeviceList = (payload: _ShowDeviceListPayload) => ({error: false, payload, type: showDeviceList})
export const createAddNewDevice = (payload: _AddNewDevicePayload) => ({error: false, payload, type: addNewDevice})
export const createChooseGPGMethod = (payload: _ChooseGPGMethodPayload) => ({error: false, payload, type: chooseGPGMethod})
export const createConfiguredAccounts = (payload: _ConfiguredAccountsPayload) => ({error: false, payload, type: configuredAccounts})
export const createConfiguredAccountsError = (payload: _ConfiguredAccountsPayloadError) => ({error: true, payload, type: configuredAccounts})
export const createLaunchAccountResetWebPage = (payload: _LaunchAccountResetWebPagePayload) => ({error: false, payload, type: launchAccountResetWebPage})
export const createLaunchForgotPasswordWebPage = (payload: _LaunchForgotPasswordWebPagePayload) => ({error: false, payload, type: launchForgotPasswordWebPage})
export const createLogin = (payload: _LoginPayload) => ({error: false, payload, type: login})
export const createLoginError = (payload: _LoginErrorPayload) => ({error: false, payload, type: loginError})
export const createLogout = (payload: _LogoutPayload) => ({error: false, payload, type: logout})
export const createLogoutDone = (payload: _LogoutDonePayload) => ({error: false, payload, type: logoutDone})
export const createNavBasedOnLoginAndInitialState = (payload: _NavBasedOnLoginAndInitialStatePayload) => ({error: false, payload, type: navBasedOnLoginAndInitialState})
export const createOnBack = (payload: _OnBackPayload) => ({error: false, payload, type: onBack})
export const createOnFinish = (payload: _OnFinishPayload) => ({error: false, payload, type: onFinish})
export const createProvisionDeviceSelect = (payload: _ProvisionDeviceSelectPayload) => ({error: false, payload, type: provisionDeviceSelect})
export const createProvisionPasswordInsteadOfDevice = (payload: _ProvisionPasswordInsteadOfDevicePayload) => ({error: false, payload, type: provisionPasswordInsteadOfDevice})
export const createProvisionTextCodeEntered = (payload: _ProvisionTextCodeEnteredPayload) => ({error: false, payload, type: provisionTextCodeEntered})
export const createProvisioningError = (payload: _ProvisioningErrorPayload) => ({error: false, payload, type: provisioningError})
export const createQrScanned = (payload: _QrScannedPayload) => ({error: false, payload, type: qrScanned})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({error: false, payload, type: setDeletedSelf})
export const createSetRevokedSelf = (payload: _SetRevokedSelfPayload) => ({error: false, payload, type: setRevokedSelf})
export const createSetTextCode = (payload: _SetTextCodePayload) => ({error: false, payload, type: setTextCode})
export const createStartLogin = (payload: _StartLoginPayload) => ({error: false, payload, type: startLogin})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({error: false, payload, type: submitDeviceName})
export const createSubmitPassphrase = (payload: _SubmitPassphrasePayload) => ({error: false, payload, type: submitPassphrase})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({error: false, payload, type: submitUsernameOrEmail})

// Action Payloads
export type AddNewDevicePayload = $Call<typeof createAddNewDevice, _AddNewDevicePayload>
export type ChooseGPGMethodPayload = $Call<typeof createChooseGPGMethod, _ChooseGPGMethodPayload>
export type ConfiguredAccountsPayload = $Call<typeof createConfiguredAccounts, _ConfiguredAccountsPayload>
export type ConfiguredAccountsPayloadError = $Call<typeof createConfiguredAccountsError, _ConfiguredAccountsPayloadError>
export type LaunchAccountResetWebPagePayload = $Call<typeof createLaunchAccountResetWebPage, _LaunchAccountResetWebPagePayload>
export type LaunchForgotPasswordWebPagePayload = $Call<typeof createLaunchForgotPasswordWebPage, _LaunchForgotPasswordWebPagePayload>
export type LoginErrorPayload = $Call<typeof createLoginError, _LoginErrorPayload>
export type LoginPayload = $Call<typeof createLogin, _LoginPayload>
export type LogoutDonePayload = $Call<typeof createLogoutDone, _LogoutDonePayload>
export type LogoutPayload = $Call<typeof createLogout, _LogoutPayload>
export type NavBasedOnLoginAndInitialStatePayload = $Call<typeof createNavBasedOnLoginAndInitialState, _NavBasedOnLoginAndInitialStatePayload>
export type OnBackPayload = $Call<typeof createOnBack, _OnBackPayload>
export type OnFinishPayload = $Call<typeof createOnFinish, _OnFinishPayload>
export type ProvisionDeviceSelectPayload = $Call<typeof createProvisionDeviceSelect, _ProvisionDeviceSelectPayload>
export type ProvisionPasswordInsteadOfDevicePayload = $Call<typeof createProvisionPasswordInsteadOfDevice, _ProvisionPasswordInsteadOfDevicePayload>
export type ProvisionTextCodeEnteredPayload = $Call<typeof createProvisionTextCodeEntered, _ProvisionTextCodeEnteredPayload>
export type ProvisioningErrorPayload = $Call<typeof createProvisioningError, _ProvisioningErrorPayload>
export type QrScannedPayload = $Call<typeof createQrScanned, _QrScannedPayload>
export type SetDeletedSelfPayload = $Call<typeof createSetDeletedSelf, _SetDeletedSelfPayload>
export type SetRevokedSelfPayload = $Call<typeof createSetRevokedSelf, _SetRevokedSelfPayload>
export type SetTextCodePayload = $Call<typeof createSetTextCode, _SetTextCodePayload>
export type ShowDeviceListPayload = $Call<typeof createShowDeviceList, _ShowDeviceListPayload>
export type ShowNewDeviceNamePayload = $Call<typeof createShowNewDeviceName, _ShowNewDeviceNamePayload>
export type StartLoginPayload = $Call<typeof createStartLogin, _StartLoginPayload>
export type SubmitDeviceNamePayload = $Call<typeof createSubmitDeviceName, _SubmitDeviceNamePayload>
export type SubmitPassphrasePayload = $Call<typeof createSubmitPassphrase, _SubmitPassphrasePayload>
export type SubmitUsernameOrEmailPayload = $Call<typeof createSubmitUsernameOrEmail, _SubmitUsernameOrEmailPayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ChooseGPGMethodPayload
  | ConfiguredAccountsPayload
  | ConfiguredAccountsPayloadError
  | LaunchAccountResetWebPagePayload
  | LaunchForgotPasswordWebPagePayload
  | LoginErrorPayload
  | LoginPayload
  | LogoutDonePayload
  | LogoutPayload
  | NavBasedOnLoginAndInitialStatePayload
  | OnBackPayload
  | OnFinishPayload
  | ProvisionDeviceSelectPayload
  | ProvisionPasswordInsteadOfDevicePayload
  | ProvisionTextCodeEnteredPayload
  | ProvisioningErrorPayload
  | QrScannedPayload
  | SetDeletedSelfPayload
  | SetRevokedSelfPayload
  | SetTextCodePayload
  | ShowDeviceListPayload
  | ShowNewDeviceNamePayload
  | StartLoginPayload
  | SubmitDeviceNamePayload
  | SubmitPassphrasePayload
  | SubmitUsernameOrEmailPayload
  | {type: 'common:resetStore', payload: void}
