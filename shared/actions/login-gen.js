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
export const clearQRCode = 'login:clearQRCode'
export const configuredAccounts = 'login:configuredAccounts'
export const loginError = 'login:loginError'
export const logout = 'login:logout'
export const logoutDone = 'login:logoutDone'
export const navBasedOnLoginAndInitialState = 'login:navBasedOnLoginAndInitialState'
export const onBack = 'login:onBack'
export const onFinish = 'login:onFinish'
export const onWont = 'login:onWont'
export const openAccountResetPage = 'login:openAccountResetPage'
export const provisionTextCodeEntered = 'login:provisionTextCodeEntered'
export const provisioningError = 'login:provisioningError'
export const qrScanned = 'login:qrScanned'
export const relogin = 'login:relogin'
export const resetQRCodeScanned = 'login:resetQRCodeScanned'
export const selectDeviceId = 'login:selectDeviceId'
export const setCameraBrokenMode = 'login:setCameraBrokenMode'
export const setCodePageMode = 'login:setCodePageMode'
export const setDeletedSelf = 'login:setDeletedSelf'
export const setMyDeviceCodeState = 'login:setMyDeviceCodeState'
export const setOtherDeviceCodeState = 'login:setOtherDeviceCodeState'
export const setQRCode = 'login:setQRCode'
export const setRevokedSelf = 'login:setRevokedSelf'
export const setTextCode = 'login:setTextCode'
export const startLogin = 'login:startLogin'
export const submitDeviceName = 'login:submitDeviceName'
export const submitPassphrase = 'login:submitPassphrase'
export const submitUsernameOrEmail = 'login:submitUsernameOrEmail'
export const waitingForResponse = 'login:waitingForResponse'

// Payload Types
type _AddNewDevicePayload = $ReadOnly<{|role: Types.DeviceRole|}>
type _ChooseGPGMethodPayload = $ReadOnly<{|exportKey: boolean|}>
type _ClearQRCodePayload = void
type _ConfiguredAccountsPayload = $ReadOnly<{|accounts: ?Array<{|hasStoredSecret: boolean, username: string|}>|}>
type _ConfiguredAccountsPayloadError = $ReadOnly<{|error: Error|}>
type _LoginErrorPayload = $ReadOnly<{|error: string|}>
type _LogoutDonePayload = void
type _LogoutPayload = void
type _NavBasedOnLoginAndInitialStatePayload = void
type _OnBackPayload = void
type _OnFinishPayload = void
type _OnWontPayload = void
type _OpenAccountResetPagePayload = void
type _ProvisionTextCodeEnteredPayload = $ReadOnly<{|phrase: HiddenString|}>
type _ProvisioningErrorPayload = $ReadOnly<{|error: Error|}>
type _QrScannedPayload = $ReadOnly<{|phrase: HiddenString|}>
type _ReloginPayload = $ReadOnly<{|
  usernameOrEmail: string,
  passphrase: HiddenString,
|}>
type _ResetQRCodeScannedPayload = void
type _SelectDeviceIdPayload = $ReadOnly<{|deviceId: string|}>
type _SetCameraBrokenModePayload = $ReadOnly<{|codePageCameraBrokenMode: boolean|}>
type _SetCodePageModePayload = $ReadOnly<{|codePageMode: Types.Mode|}>
type _SetDeletedSelfPayload = $ReadOnly<{|deletedUsername: string|}>
type _SetMyDeviceCodeStatePayload = $ReadOnly<{|codePageMyDeviceRole: Types.DeviceRole|}>
type _SetOtherDeviceCodeStatePayload = $ReadOnly<{|codePageOtherDeviceRole: Types.DeviceRole|}>
type _SetQRCodePayload = $ReadOnly<{|codePageQrCode: HiddenString|}>
type _SetRevokedSelfPayload = $ReadOnly<{|revoked: string|}>
type _SetTextCodePayload = $ReadOnly<{|
  codePageEnterCodeErrorText: string,
  codePageTextCode: HiddenString,
|}>
type _StartLoginPayload = void
type _SubmitDeviceNamePayload = $ReadOnly<{|deviceName: string|}>
type _SubmitPassphrasePayload = $ReadOnly<{|
  passphrase: HiddenString,
  storeSecret: boolean,
|}>
type _SubmitUsernameOrEmailPayload = $ReadOnly<{|usernameOrEmail: string|}>
type _WaitingForResponsePayload = $ReadOnly<{|waiting: boolean|}>

// Action Creators
export const createAddNewDevice = (payload: _AddNewDevicePayload) => ({error: false, payload, type: addNewDevice})
export const createChooseGPGMethod = (payload: _ChooseGPGMethodPayload) => ({error: false, payload, type: chooseGPGMethod})
export const createClearQRCode = (payload: _ClearQRCodePayload) => ({error: false, payload, type: clearQRCode})
export const createConfiguredAccounts = (payload: _ConfiguredAccountsPayload) => ({error: false, payload, type: configuredAccounts})
export const createConfiguredAccountsError = (payload: _ConfiguredAccountsPayloadError) => ({error: true, payload, type: configuredAccounts})
export const createLoginError = (payload: _LoginErrorPayload) => ({error: false, payload, type: loginError})
export const createLogout = (payload: _LogoutPayload) => ({error: false, payload, type: logout})
export const createLogoutDone = (payload: _LogoutDonePayload) => ({error: false, payload, type: logoutDone})
export const createNavBasedOnLoginAndInitialState = (payload: _NavBasedOnLoginAndInitialStatePayload) => ({error: false, payload, type: navBasedOnLoginAndInitialState})
export const createOnBack = (payload: _OnBackPayload) => ({error: false, payload, type: onBack})
export const createOnFinish = (payload: _OnFinishPayload) => ({error: false, payload, type: onFinish})
export const createOnWont = (payload: _OnWontPayload) => ({error: false, payload, type: onWont})
export const createOpenAccountResetPage = (payload: _OpenAccountResetPagePayload) => ({error: false, payload, type: openAccountResetPage})
export const createProvisionTextCodeEntered = (payload: _ProvisionTextCodeEnteredPayload) => ({error: false, payload, type: provisionTextCodeEntered})
export const createProvisioningError = (payload: _ProvisioningErrorPayload) => ({error: false, payload, type: provisioningError})
export const createQrScanned = (payload: _QrScannedPayload) => ({error: false, payload, type: qrScanned})
export const createRelogin = (payload: _ReloginPayload) => ({error: false, payload, type: relogin})
export const createResetQRCodeScanned = (payload: _ResetQRCodeScannedPayload) => ({error: false, payload, type: resetQRCodeScanned})
export const createSelectDeviceId = (payload: _SelectDeviceIdPayload) => ({error: false, payload, type: selectDeviceId})
export const createSetCameraBrokenMode = (payload: _SetCameraBrokenModePayload) => ({error: false, payload, type: setCameraBrokenMode})
export const createSetCodePageMode = (payload: _SetCodePageModePayload) => ({error: false, payload, type: setCodePageMode})
export const createSetDeletedSelf = (payload: _SetDeletedSelfPayload) => ({error: false, payload, type: setDeletedSelf})
export const createSetMyDeviceCodeState = (payload: _SetMyDeviceCodeStatePayload) => ({error: false, payload, type: setMyDeviceCodeState})
export const createSetOtherDeviceCodeState = (payload: _SetOtherDeviceCodeStatePayload) => ({error: false, payload, type: setOtherDeviceCodeState})
export const createSetQRCode = (payload: _SetQRCodePayload) => ({error: false, payload, type: setQRCode})
export const createSetRevokedSelf = (payload: _SetRevokedSelfPayload) => ({error: false, payload, type: setRevokedSelf})
export const createSetTextCode = (payload: _SetTextCodePayload) => ({error: false, payload, type: setTextCode})
export const createStartLogin = (payload: _StartLoginPayload) => ({error: false, payload, type: startLogin})
export const createSubmitDeviceName = (payload: _SubmitDeviceNamePayload) => ({error: false, payload, type: submitDeviceName})
export const createSubmitPassphrase = (payload: _SubmitPassphrasePayload) => ({error: false, payload, type: submitPassphrase})
export const createSubmitUsernameOrEmail = (payload: _SubmitUsernameOrEmailPayload) => ({error: false, payload, type: submitUsernameOrEmail})
export const createWaitingForResponse = (payload: _WaitingForResponsePayload) => ({error: false, payload, type: waitingForResponse})

// Action Payloads
export type AddNewDevicePayload = $Call<typeof createAddNewDevice, _AddNewDevicePayload>
export type ChooseGPGMethodPayload = $Call<typeof createChooseGPGMethod, _ChooseGPGMethodPayload>
export type ClearQRCodePayload = $Call<typeof createClearQRCode, _ClearQRCodePayload>
export type ConfiguredAccountsPayload = $Call<typeof createConfiguredAccounts, _ConfiguredAccountsPayload>
export type ConfiguredAccountsPayloadError = $Call<typeof createConfiguredAccountsError, _ConfiguredAccountsPayloadError>
export type LoginErrorPayload = $Call<typeof createLoginError, _LoginErrorPayload>
export type LogoutDonePayload = $Call<typeof createLogoutDone, _LogoutDonePayload>
export type LogoutPayload = $Call<typeof createLogout, _LogoutPayload>
export type NavBasedOnLoginAndInitialStatePayload = $Call<typeof createNavBasedOnLoginAndInitialState, _NavBasedOnLoginAndInitialStatePayload>
export type OnBackPayload = $Call<typeof createOnBack, _OnBackPayload>
export type OnFinishPayload = $Call<typeof createOnFinish, _OnFinishPayload>
export type OnWontPayload = $Call<typeof createOnWont, _OnWontPayload>
export type OpenAccountResetPagePayload = $Call<typeof createOpenAccountResetPage, _OpenAccountResetPagePayload>
export type ProvisionTextCodeEnteredPayload = $Call<typeof createProvisionTextCodeEntered, _ProvisionTextCodeEnteredPayload>
export type ProvisioningErrorPayload = $Call<typeof createProvisioningError, _ProvisioningErrorPayload>
export type QrScannedPayload = $Call<typeof createQrScanned, _QrScannedPayload>
export type ReloginPayload = $Call<typeof createRelogin, _ReloginPayload>
export type ResetQRCodeScannedPayload = $Call<typeof createResetQRCodeScanned, _ResetQRCodeScannedPayload>
export type SelectDeviceIdPayload = $Call<typeof createSelectDeviceId, _SelectDeviceIdPayload>
export type SetCameraBrokenModePayload = $Call<typeof createSetCameraBrokenMode, _SetCameraBrokenModePayload>
export type SetCodePageModePayload = $Call<typeof createSetCodePageMode, _SetCodePageModePayload>
export type SetDeletedSelfPayload = $Call<typeof createSetDeletedSelf, _SetDeletedSelfPayload>
export type SetMyDeviceCodeStatePayload = $Call<typeof createSetMyDeviceCodeState, _SetMyDeviceCodeStatePayload>
export type SetOtherDeviceCodeStatePayload = $Call<typeof createSetOtherDeviceCodeState, _SetOtherDeviceCodeStatePayload>
export type SetQRCodePayload = $Call<typeof createSetQRCode, _SetQRCodePayload>
export type SetRevokedSelfPayload = $Call<typeof createSetRevokedSelf, _SetRevokedSelfPayload>
export type SetTextCodePayload = $Call<typeof createSetTextCode, _SetTextCodePayload>
export type StartLoginPayload = $Call<typeof createStartLogin, _StartLoginPayload>
export type SubmitDeviceNamePayload = $Call<typeof createSubmitDeviceName, _SubmitDeviceNamePayload>
export type SubmitPassphrasePayload = $Call<typeof createSubmitPassphrase, _SubmitPassphrasePayload>
export type SubmitUsernameOrEmailPayload = $Call<typeof createSubmitUsernameOrEmail, _SubmitUsernameOrEmailPayload>
export type WaitingForResponsePayload = $Call<typeof createWaitingForResponse, _WaitingForResponsePayload>

// All Actions
// prettier-ignore
export type Actions =
  | AddNewDevicePayload
  | ChooseGPGMethodPayload
  | ClearQRCodePayload
  | ConfiguredAccountsPayload
  | ConfiguredAccountsPayloadError
  | LoginErrorPayload
  | LogoutDonePayload
  | LogoutPayload
  | NavBasedOnLoginAndInitialStatePayload
  | OnBackPayload
  | OnFinishPayload
  | OnWontPayload
  | OpenAccountResetPagePayload
  | ProvisionTextCodeEnteredPayload
  | ProvisioningErrorPayload
  | QrScannedPayload
  | ReloginPayload
  | ResetQRCodeScannedPayload
  | SelectDeviceIdPayload
  | SetCameraBrokenModePayload
  | SetCodePageModePayload
  | SetDeletedSelfPayload
  | SetMyDeviceCodeStatePayload
  | SetOtherDeviceCodeStatePayload
  | SetQRCodePayload
  | SetRevokedSelfPayload
  | SetTextCodePayload
  | StartLoginPayload
  | SubmitDeviceNamePayload
  | SubmitPassphrasePayload
  | SubmitUsernameOrEmailPayload
  | WaitingForResponsePayload
  | {type: 'common:resetStore', payload: void}
