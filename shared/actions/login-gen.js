// @flow
// NOTE: This file is GENERATED from json files in actions/json. Run 'yarn build-actions' to regenerate
/* eslint-disable no-unused-vars,prettier/prettier */

import * as I from 'immutable'
import * as RPCTypes from '../constants/types/flow-types'
import * as More from '../constants/types/more'
import * as Types from '../constants/types/login'
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
export const createAddNewDevice = (payload: {|+role: Types.DeviceRole|}) => ({error: false, payload, type: addNewDevice})
export const createChooseGPGMethod = (payload: {|+exportKey: boolean|}) => ({error: false, payload, type: chooseGPGMethod})
export const createClearQRCode = () => ({error: false, payload: undefined, type: clearQRCode})
export const createConfiguredAccounts = (payload: {|+accounts: ?Array<{|hasStoredSecret: boolean, username: string|}>|}) => ({error: false, payload, type: configuredAccounts})
export const createConfiguredAccountsError = (payload: {|+error: Error|}) => ({error: true, payload, type: configuredAccounts})
export const createLoginDone = () => ({error: false, payload: undefined, type: loginDone})
export const createLogout = () => ({error: false, payload: undefined, type: logout})
export const createLogoutDone = () => ({error: false, payload: undefined, type: logoutDone})
export const createNavBasedOnLoginAndInitialState = () => ({error: false, payload: undefined, type: navBasedOnLoginAndInitialState})
export const createOnBack = () => ({error: false, payload: undefined, type: onBack})
export const createOnFinish = () => ({error: false, payload: undefined, type: onFinish})
export const createOnWont = () => ({error: false, payload: undefined, type: onWont})
export const createOpenAccountResetPage = () => ({error: false, payload: undefined, type: openAccountResetPage})
export const createProvisionTextCodeEntered = (payload: {|+phrase: HiddenString|}) => ({error: false, payload, type: provisionTextCodeEntered})
export const createProvisioningError = (payload: {|+error: Error|}) => ({error: false, payload, type: provisioningError})
export const createQrScanned = (payload: {|+phrase: HiddenString|}) => ({error: false, payload, type: qrScanned})
export const createRelogin = (payload: {|+usernameOrEmail: string, +passphrase: HiddenString|}) => ({error: false, payload, type: relogin})
export const createReloginError = (payload: {|+error: Error|}) => ({error: true, payload, type: relogin})
export const createResetQRCodeScanned = () => ({error: false, payload: undefined, type: resetQRCodeScanned})
export const createSelectDeviceId = (payload: {|+deviceId: string|}) => ({error: false, payload, type: selectDeviceId})
export const createSetCameraBrokenMode = (payload: {|+broken: boolean|}) => ({error: false, payload, type: setCameraBrokenMode})
export const createSetCodePageMode = (payload: {|+mode: Types.Mode|}) => ({error: false, payload, type: setCodePageMode})
export const createSetDeletedSelf = (payload: {|+deletedUsername: string|}) => ({error: false, payload, type: setDeletedSelf})
export const createSetMyDeviceCodeState = (payload: {|+state: Types.DeviceRole|}) => ({error: false, payload, type: setMyDeviceCodeState})
export const createSetOtherDeviceCodeState = (payload: {|+state: Types.DeviceRole|}) => ({error: false, payload, type: setOtherDeviceCodeState})
export const createSetQRCode = (payload: {|+qrCode: HiddenString|}) => ({error: false, payload, type: setQRCode})
export const createSetRevokedSelf = (payload: {|+revoked: string|}) => ({error: false, payload, type: setRevokedSelf})
export const createSetTextCode = (payload: {|+enterCodeErrorText: string, +textCode: HiddenString|}) => ({error: false, payload, type: setTextCode})
export const createSomeoneElse = () => ({error: false, payload: undefined, type: someoneElse})
export const createStartLogin = () => ({error: false, payload: undefined, type: startLogin})
export const createSubmitDeviceName = (payload: {|+deviceName: string|}) => ({error: false, payload, type: submitDeviceName})
export const createSubmitPassphrase = (payload: {|+passphrase: HiddenString, +storeSecret: boolean|}) => ({error: false, payload, type: submitPassphrase})
export const createSubmitUsernameOrEmail = (payload: {|+usernameOrEmail: string|}) => ({error: false, payload, type: submitUsernameOrEmail})
export const createWaitingForResponse = (payload: {|+waiting: boolean|}) => ({error: false, payload, type: waitingForResponse})

// Action Payloads
export type AddNewDevicePayload = More.ReturnType<typeof createAddNewDevice>
export type ChooseGPGMethodPayload = More.ReturnType<typeof createChooseGPGMethod>
export type ClearQRCodePayload = More.ReturnType<typeof createClearQRCode>
export type ConfiguredAccountsPayload = More.ReturnType<typeof createConfiguredAccounts>
export type LoginDonePayload = More.ReturnType<typeof createLoginDone>
export type LogoutDonePayload = More.ReturnType<typeof createLogoutDone>
export type LogoutPayload = More.ReturnType<typeof createLogout>
export type NavBasedOnLoginAndInitialStatePayload = More.ReturnType<typeof createNavBasedOnLoginAndInitialState>
export type OnBackPayload = More.ReturnType<typeof createOnBack>
export type OnFinishPayload = More.ReturnType<typeof createOnFinish>
export type OnWontPayload = More.ReturnType<typeof createOnWont>
export type OpenAccountResetPagePayload = More.ReturnType<typeof createOpenAccountResetPage>
export type ProvisionTextCodeEnteredPayload = More.ReturnType<typeof createProvisionTextCodeEntered>
export type ProvisioningErrorPayload = More.ReturnType<typeof createProvisioningError>
export type QrScannedPayload = More.ReturnType<typeof createQrScanned>
export type ReloginPayload = More.ReturnType<typeof createRelogin>
export type ResetQRCodeScannedPayload = More.ReturnType<typeof createResetQRCodeScanned>
export type SelectDeviceIdPayload = More.ReturnType<typeof createSelectDeviceId>
export type SetCameraBrokenModePayload = More.ReturnType<typeof createSetCameraBrokenMode>
export type SetCodePageModePayload = More.ReturnType<typeof createSetCodePageMode>
export type SetDeletedSelfPayload = More.ReturnType<typeof createSetDeletedSelf>
export type SetMyDeviceCodeStatePayload = More.ReturnType<typeof createSetMyDeviceCodeState>
export type SetOtherDeviceCodeStatePayload = More.ReturnType<typeof createSetOtherDeviceCodeState>
export type SetQRCodePayload = More.ReturnType<typeof createSetQRCode>
export type SetRevokedSelfPayload = More.ReturnType<typeof createSetRevokedSelf>
export type SetTextCodePayload = More.ReturnType<typeof createSetTextCode>
export type SomeoneElsePayload = More.ReturnType<typeof createSomeoneElse>
export type StartLoginPayload = More.ReturnType<typeof createStartLogin>
export type SubmitDeviceNamePayload = More.ReturnType<typeof createSubmitDeviceName>
export type SubmitPassphrasePayload = More.ReturnType<typeof createSubmitPassphrase>
export type SubmitUsernameOrEmailPayload = More.ReturnType<typeof createSubmitUsernameOrEmail>
export type WaitingForResponsePayload = More.ReturnType<typeof createWaitingForResponse>

// All Actions
// prettier-ignore
export type Actions =
  | More.ReturnType<typeof createAddNewDevice>
  | More.ReturnType<typeof createChooseGPGMethod>
  | More.ReturnType<typeof createClearQRCode>
  | More.ReturnType<typeof createConfiguredAccounts>
  | More.ReturnType<typeof createConfiguredAccountsError>
  | More.ReturnType<typeof createLoginDone>
  | More.ReturnType<typeof createLogout>
  | More.ReturnType<typeof createLogoutDone>
  | More.ReturnType<typeof createNavBasedOnLoginAndInitialState>
  | More.ReturnType<typeof createOnBack>
  | More.ReturnType<typeof createOnFinish>
  | More.ReturnType<typeof createOnWont>
  | More.ReturnType<typeof createOpenAccountResetPage>
  | More.ReturnType<typeof createProvisionTextCodeEntered>
  | More.ReturnType<typeof createProvisioningError>
  | More.ReturnType<typeof createQrScanned>
  | More.ReturnType<typeof createRelogin>
  | More.ReturnType<typeof createReloginError>
  | More.ReturnType<typeof createResetQRCodeScanned>
  | More.ReturnType<typeof createSelectDeviceId>
  | More.ReturnType<typeof createSetCameraBrokenMode>
  | More.ReturnType<typeof createSetCodePageMode>
  | More.ReturnType<typeof createSetDeletedSelf>
  | More.ReturnType<typeof createSetMyDeviceCodeState>
  | More.ReturnType<typeof createSetOtherDeviceCodeState>
  | More.ReturnType<typeof createSetQRCode>
  | More.ReturnType<typeof createSetRevokedSelf>
  | More.ReturnType<typeof createSetTextCode>
  | More.ReturnType<typeof createSomeoneElse>
  | More.ReturnType<typeof createStartLogin>
  | More.ReturnType<typeof createSubmitDeviceName>
  | More.ReturnType<typeof createSubmitPassphrase>
  | More.ReturnType<typeof createSubmitUsernameOrEmail>
  | More.ReturnType<typeof createWaitingForResponse>
  | {type: 'common:resetStore', payload: void}
