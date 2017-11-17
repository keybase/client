// @flow
/* eslint-disable */

// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate

import {type PayloadType, type ReturnType} from '../constants/types/more'
import * as Constants from '../constants/login'
import HiddenString from '../util/hidden-string'

// Constants
export const resetStore = 'common:resetStore' // not a part of login but is handled by every reducer
export const addNewDevice = 'login:addNewDevice'
export const chooseGPGMethod = 'login:chooseGPGMethod'
export const clearQRCode = 'login:clearQRCode'
export const configuredAccounts = 'login:configuredAccounts'
export const loginDone = 'login:loginDone'
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
export const someoneElse = 'login:someoneElse'
export const startLogin = 'login:startLogin'
export const submitDeviceName = 'login:submitDeviceName'
export const submitPassphrase = 'login:submitPassphrase'
export const submitUsernameOrEmail = 'login:submitUsernameOrEmail'
export const waitingForResponse = 'login:waitingForResponse'

// Action Creators
export const createAddNewDevice = (payload: {|role: Constants.DeviceRole|}) => ({error: false, payload, type: addNewDevice})
export const createChooseGPGMethod = (payload: {|exportKey: boolean|}) => ({error: false, payload, type: chooseGPGMethod})
export const createClearQRCode = () => ({error: false, payload: undefined, type: clearQRCode})
export const createConfiguredAccounts = (payload: {|accounts: ?Array<{|hasStoredSecret: boolean, username: string|}>|}) => ({error: false, payload, type: configuredAccounts})
export const createConfiguredAccountsError = (payload: {|error: Error|}) => ({error: true, payload, type: configuredAccounts})
export const createLoginDone = () => ({error: false, payload: undefined, type: loginDone})
export const createLogout = () => ({error: false, payload: undefined, type: logout})
export const createLogoutDone = () => ({error: false, payload: undefined, type: logoutDone})
export const createNavBasedOnLoginAndInitialState = () => ({error: false, payload: undefined, type: navBasedOnLoginAndInitialState})
export const createOnBack = () => ({error: false, payload: undefined, type: onBack})
export const createOnFinish = () => ({error: false, payload: undefined, type: onFinish})
export const createOnWont = () => ({error: false, payload: undefined, type: onWont})
export const createOpenAccountResetPage = () => ({error: false, payload: undefined, type: openAccountResetPage})
export const createProvisionTextCodeEntered = (payload: {|phrase: HiddenString|}) => ({error: false, payload, type: provisionTextCodeEntered})
export const createProvisioningError = (payload: {|error: Error|}) => ({error: false, payload, type: provisioningError})
export const createQrScanned = (payload: {|phrase: HiddenString|}) => ({error: false, payload, type: qrScanned})
export const createRelogin = (payload: {|usernameOrEmail: string, passphrase: HiddenString|}) => ({error: false, payload, type: relogin})
export const createReloginError = (payload: {|error: Error|}) => ({error: true, payload, type: relogin})
export const createResetQRCodeScanned = () => ({error: false, payload: undefined, type: resetQRCodeScanned})
export const createSelectDeviceId = (payload: {|deviceId: string|}) => ({error: false, payload, type: selectDeviceId})
export const createSetCameraBrokenMode = (payload: {|broken: boolean|}) => ({error: false, payload, type: setCameraBrokenMode})
export const createSetCodePageMode = (payload: {|mode: Constants.Mode|}) => ({error: false, payload, type: setCodePageMode})
export const createSetDeletedSelf = (payload: {|deletedUsername: string|}) => ({error: false, payload, type: setDeletedSelf})
export const createSetMyDeviceCodeState = (payload: {|state: Constants.DeviceRole|}) => ({error: false, payload, type: setMyDeviceCodeState})
export const createSetOtherDeviceCodeState = (payload: {|state: Constants.DeviceRole|}) => ({error: false, payload, type: setOtherDeviceCodeState})
export const createSetQRCode = (payload: {|qrCode: HiddenString|}) => ({error: false, payload, type: setQRCode})
export const createSetRevokedSelf = (payload: {|revoked: string|}) => ({error: false, payload, type: setRevokedSelf})
export const createSetTextCode = (payload: {|enterCodeErrorText: string, textCode: HiddenString|}) => ({error: false, payload, type: setTextCode})
export const createSomeoneElse = () => ({error: false, payload: undefined, type: someoneElse})
export const createStartLogin = () => ({error: false, payload: undefined, type: startLogin})
export const createSubmitDeviceName = (payload: {|deviceName: string|}) => ({error: false, payload, type: submitDeviceName})
export const createSubmitPassphrase = (payload: {|passphrase: HiddenString, storeSecret: boolean|}) => ({error: false, payload, type: submitPassphrase})
export const createSubmitUsernameOrEmail = (payload: {|usernameOrEmail: string|}) => ({error: false, payload, type: submitUsernameOrEmail})
export const createWaitingForResponse = (payload: {|waiting: boolean|}) => ({error: false, payload, type: waitingForResponse})

// Action Payloads
export type AddNewDevicePayload = ReturnType<typeof createAddNewDevice>
export type ChooseGPGMethodPayload = ReturnType<typeof createChooseGPGMethod>
export type ClearQRCodePayload = ReturnType<typeof createClearQRCode>
export type ConfiguredAccountsPayload = ReturnType<typeof createConfiguredAccounts>
export type LoginDonePayload = ReturnType<typeof createLoginDone>
export type LogoutDonePayload = ReturnType<typeof createLogoutDone>
export type LogoutPayload = ReturnType<typeof createLogout>
export type NavBasedOnLoginAndInitialStatePayload = ReturnType<typeof createNavBasedOnLoginAndInitialState>
export type OnBackPayload = ReturnType<typeof createOnBack>
export type OnFinishPayload = ReturnType<typeof createOnFinish>
export type OnWontPayload = ReturnType<typeof createOnWont>
export type OpenAccountResetPagePayload = ReturnType<typeof createOpenAccountResetPage>
export type ProvisionTextCodeEnteredPayload = ReturnType<typeof createProvisionTextCodeEntered>
export type ProvisioningErrorPayload = ReturnType<typeof createProvisioningError>
export type QrScannedPayload = ReturnType<typeof createQrScanned>
export type ReloginPayload = ReturnType<typeof createRelogin>
export type ResetQRCodeScannedPayload = ReturnType<typeof createResetQRCodeScanned>
export type SelectDeviceIdPayload = ReturnType<typeof createSelectDeviceId>
export type SetCameraBrokenModePayload = ReturnType<typeof createSetCameraBrokenMode>
export type SetCodePageModePayload = ReturnType<typeof createSetCodePageMode>
export type SetDeletedSelfPayload = ReturnType<typeof createSetDeletedSelf>
export type SetMyDeviceCodeStatePayload = ReturnType<typeof createSetMyDeviceCodeState>
export type SetOtherDeviceCodeStatePayload = ReturnType<typeof createSetOtherDeviceCodeState>
export type SetQRCodePayload = ReturnType<typeof createSetQRCode>
export type SetRevokedSelfPayload = ReturnType<typeof createSetRevokedSelf>
export type SetTextCodePayload = ReturnType<typeof createSetTextCode>
export type SomeoneElsePayload = ReturnType<typeof createSomeoneElse>
export type StartLoginPayload = ReturnType<typeof createStartLogin>
export type SubmitDeviceNamePayload = ReturnType<typeof createSubmitDeviceName>
export type SubmitPassphrasePayload = ReturnType<typeof createSubmitPassphrase>
export type SubmitUsernameOrEmailPayload = ReturnType<typeof createSubmitUsernameOrEmail>
export type WaitingForResponsePayload = ReturnType<typeof createWaitingForResponse>

// All Actions
// prettier-ignore
export type Actions =
  | ReturnType<typeof createAddNewDevice>
  | ReturnType<typeof createChooseGPGMethod>
  | ReturnType<typeof createClearQRCode>
  | ReturnType<typeof createConfiguredAccounts>
  | ReturnType<typeof createConfiguredAccountsError>
  | ReturnType<typeof createLoginDone>
  | ReturnType<typeof createLogout>
  | ReturnType<typeof createLogoutDone>
  | ReturnType<typeof createNavBasedOnLoginAndInitialState>
  | ReturnType<typeof createOnBack>
  | ReturnType<typeof createOnFinish>
  | ReturnType<typeof createOnWont>
  | ReturnType<typeof createOpenAccountResetPage>
  | ReturnType<typeof createProvisionTextCodeEntered>
  | ReturnType<typeof createProvisioningError>
  | ReturnType<typeof createQrScanned>
  | ReturnType<typeof createRelogin>
  | ReturnType<typeof createReloginError>
  | ReturnType<typeof createResetQRCodeScanned>
  | ReturnType<typeof createSelectDeviceId>
  | ReturnType<typeof createSetCameraBrokenMode>
  | ReturnType<typeof createSetCodePageMode>
  | ReturnType<typeof createSetDeletedSelf>
  | ReturnType<typeof createSetMyDeviceCodeState>
  | ReturnType<typeof createSetOtherDeviceCodeState>
  | ReturnType<typeof createSetQRCode>
  | ReturnType<typeof createSetRevokedSelf>
  | ReturnType<typeof createSetTextCode>
  | ReturnType<typeof createSomeoneElse>
  | ReturnType<typeof createStartLogin>
  | ReturnType<typeof createSubmitDeviceName>
  | ReturnType<typeof createSubmitPassphrase>
  | ReturnType<typeof createSubmitUsernameOrEmail>
  | ReturnType<typeof createWaitingForResponse>
  | {type: 'common:resetStore', payload: void}
