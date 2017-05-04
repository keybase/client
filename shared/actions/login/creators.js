// @flow

import * as Constants from '../../constants/login'
import * as DeviceConstants from '../../constants/devices'
import HiddenString from '../../util/hidden-string'
import {qrGenerate} from './provision-helpers'

import type {Action} from '../../constants/types/flux'

function submitUsernameOrEmail (usernameOrEmail: string): Constants.SubmitUsernameOrEmail {
  return {type: Constants.submitUsernameOrEmail, payload: {usernameOrEmail}}
}

function startLogin (): Constants.StartLogin {
  return {type: Constants.startLogin, payload: null}
}

function logout (): Constants.Logout {
  return {type: Constants.logout, payload: null}
}

function setTextCode (phrase: string, previousErr: string): Constants.SetTextCode {
  return {type: Constants.setTextCode, payload: {enterCodeErrorText: previousErr, textCode: new HiddenString(phrase)}}
}

function relogin (usernameOrEmail: string, passphrase: string): Constants.Relogin {
  return {type: Constants.relogin, payload: {usernameOrEmail, passphrase: new HiddenString(passphrase)}}
}

function setQRCode (code: string): Constants.SetQRCode {
  return {type: Constants.setQRCode, payload: {qrCode: new HiddenString(qrGenerate(code))}}
}

function submitPassphrase (passphrase: HiddenString, storeSecret: boolean = false): Constants.SubmitPassphrase {
  if (typeof passphrase === 'string') {
    throw new Error('DEV: passphrase is a string, should be a hidden string!')
  }
  return {type: Constants.submitPassphrase, payload: {passphrase, storeSecret}}
}

function onBack (): Constants.OnBack {
  return {type: Constants.onBack, payload: {}}
}

function onWont (): Constants.OnWont {
  return {type: Constants.onWont, payload: {}}
}

function someoneElse (): Constants.SomeoneElse {
  return {type: Constants.someoneElse, payload: {}}
}

function selectDeviceId (deviceId: string): Constants.SelectDeviceId {
  return {type: Constants.selectDeviceId, payload: {deviceId}}
}

function chooseGPGMethod (exportKey: boolean): Constants.ChooseGPGMethod {
  return {type: Constants.chooseGPGMethod, payload: {exportKey}}
}

function submitDeviceName (deviceName: string): Constants.SubmitDeviceName {
  return {type: Constants.submitDeviceName, payload: {deviceName}}
}

function onFinish (): Constants.OnFinish {
  return {type: Constants.onFinish, payload: {}}
}

function qrScanned (phrase: string): Constants.QrScanned {
  return {type: Constants.qrScanned, payload: {phrase}}
}

function provisionTextCodeEntered (phrase: string): Constants.ProvisionTextCodeEntered {
  return {type: Constants.provisionTextCodeEntered, payload: {phrase}}
}

function setRevokedSelf (revoked: string) {
  return {type: Constants.setRevokedSelf, payload: revoked}
}

function setDeletedSelf (deletedUsername: string) {
  return {type: Constants.setDeletedSelf, payload: deletedUsername}
}

function setLoginFromRevokedDevice (error: string) {
  return {type: Constants.setLoginFromRevokedDevice, payload: error}
}

function setCodePageMode (mode: Constants.Mode) {
  return {type: Constants.setCodeMode, payload: mode}
}

function setOtherDeviceCodeState (otherDeviceRole: Constants.DeviceRole): Constants.SetOtherDeviceCodeState {
  return {type: Constants.setOtherDeviceCodeState, payload: otherDeviceRole}
}

function loginDone (error?: {message: string}) {
  if (error) {
    return {type: Constants.loginDone, error: true, payload: error}
  }
  return {type: Constants.loginDone, payload: null}
}

function logoutDone () {
  return {type: Constants.logoutDone, payload: null}
}

function setMyDeviceCodeState (role: Constants.DeviceRole) {
  return {
    payload: role,
    type: Constants.setMyDeviceCodeState,
  }
}

function setCameraBrokenMode (broken: boolean) {
  return {payload: broken, type: Constants.cameraBrokenMode}
}

function addNewDevice (role: Constants.DeviceRole): DeviceConstants.AddNewDevice {
  return {type: 'device:addNewDevice', payload: {role}}
}

function addNewPhone () {
  return addNewDevice(Constants.codePageDeviceRoleNewPhone)
}

function addNewComputer () {
  return addNewDevice(Constants.codePageDeviceRoleNewComputer)
}

function updateForgotPasswordEmail (email: string): Constants.UpdateForgotPasswordEmail {
  return {payload: email, type: Constants.actionUpdateForgotPasswordEmailAddress}
}

function openAccountResetPage () {
  return {payload: {}, type: Constants.openAccountResetPage}
}

function navBasedOnLoginState (): Action {
  return {payload: {}, type: Constants.navBasedOnLoginState}
}

export {
  addNewComputer,
  addNewDevice,
  addNewPhone,
  chooseGPGMethod,
  loginDone,
  logout,
  logoutDone,
  navBasedOnLoginState,
  onBack,
  onFinish,
  onWont,
  openAccountResetPage,
  provisionTextCodeEntered,
  qrScanned,
  relogin,
  selectDeviceId,
  setCameraBrokenMode,
  setCodePageMode,
  setDeletedSelf,
  setLoginFromRevokedDevice,
  setMyDeviceCodeState,
  setOtherDeviceCodeState,
  setQRCode,
  setRevokedSelf,
  setTextCode,
  someoneElse,
  startLogin,
  submitDeviceName,
  submitPassphrase,
  submitUsernameOrEmail,
  updateForgotPasswordEmail,
}
