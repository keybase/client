// @flow
// constants

import type {TypedAction, NoErrorTypedAction} from './types/flux'
import HiddenString from '../util/hidden-string'

export type Mode = 'codePageModeScanCode'
| 'codePageModeShowCode'
| 'codePageModeEnterText'
| 'codePageModeShowText'

export type DeviceRole = 'codePageDeviceRoleExistingPhone'
| 'codePageDeviceRoleNewPhone'
| 'codePageDeviceRoleExistingComputer'
| 'codePageDeviceRoleNewComputer'

export const startLogin = 'login:startLogin'
export type StartLogin = NoErrorTypedAction<'login:startLogin', null>

export const submitUsernameOrEmail = 'login:submitUsernameOrEmail'
export type SubmitUsernameOrEmail = NoErrorTypedAction<'login:submitUsernameOrEmail', {usernameOrEmail: string}>

export const relogin = 'login:relogin'
export type Relogin = NoErrorTypedAction<'login:relogin', {usernameOrEmail: string, passphrase: HiddenString}>

export const submitPassphrase = 'login:submitPassphrase'
export type SubmitPassphrase = NoErrorTypedAction<'login:submitPassphrase', {passphrase: HiddenString, storeSecret: boolean}>

export const someoneElse = 'login:someoneElse'
export type SomeoneElse = NoErrorTypedAction<'login:someoneElse', {}>

export const onBack = 'login:onBack'
export type OnBack = NoErrorTypedAction<'login:onBack', {}>

export const onWont = 'login:onWont'
export type OnWont = NoErrorTypedAction<'login:onWont', {}>

export const onFinish = 'login:onFinish'
export type OnFinish = NoErrorTypedAction<'login:onFinish', {}>

export const qrScanned = 'login:qrScanned'
export type QrScanned = NoErrorTypedAction<'login:qrScanned', {phrase: string}>

export const provisionTextCodeEntered = 'login:provisionTextCodeEntered'
export type ProvisionTextCodeEntered = NoErrorTypedAction<'login:provisionTextCodeEntered', {phrase: string}>

export const selectDeviceId = 'login:selectDeviceId'
export type SelectDeviceId = NoErrorTypedAction<'login:selectDeviceId', {deviceId: string}>

export const chooseGPGMethod = 'login:chooseGPGMethod'
export type ChooseGPGMethod = NoErrorTypedAction<'login:chooseGPGMethod', {exportKey: boolean}>

export const submitDeviceName = 'login:submitDeviceName'
export type SubmitDeviceName = NoErrorTypedAction<'login:submitDeviceName', {deviceName: string}>

export const setCodeMode = 'login:setCodeMode'
export type SetCodeMode = NoErrorTypedAction<'login:setCodeMode', Mode>

export const setTextCode = 'login:setTextCode'
export type SetTextCode = NoErrorTypedAction<'login:setTextCode', {textCode: HiddenString}>

export const setQRCode = 'login:setQRCode'
export type SetQRCode = NoErrorTypedAction<'login:setQRCode', {qrCode: HiddenString}>

export const setOtherDeviceCodeState = 'login:setOtherDeviceCodeState'
export type SetOtherDeviceCodeState = NoErrorTypedAction<'login:setOtherDeviceCodeState', DeviceRole>

export const loginDone = 'login:loginDone'
export type LoginDone = TypedAction<'login:relogin', {}, Error>

export const actionUpdateForgotPasswordEmailAddress = 'login:actionUpdateForgotPasswordEmailAddress'
export type UpdateForgotPasswordEmail = NoErrorTypedAction<'login:actionUpdateForgotPasswordEmailAddress', string>

export const codePageDeviceRoleExistingPhone = 'codePageDeviceRoleExistingPhone'
export const codePageDeviceRoleNewPhone = 'codePageDeviceRoleNewPhone'
export const codePageDeviceRoleExistingComputer = 'codePageDeviceRoleExistingComputer'
export const codePageDeviceRoleNewComputer = 'codePageDeviceRoleNewComputer'

export const codePageModeScanCode = 'codePageModeScanCode'
export const codePageModeShowCode = 'codePageModeShowCode'
export const codePageModeEnterText = 'codePageModeEnterText'
export const codePageModeShowText = 'codePageModeShowText'

export const countDownTime = 5 * 60

// actions
export const login = 'login:login'
export const logout = 'login:logout'
export type Logout = NoErrorTypedAction<'login:logout', null>
export const logoutDone = 'login:logoutDone'
export const setMyDeviceCodeState = 'login:setMyDeviceCodeState'
export const cameraBrokenMode = 'login:cameraBrokenMode'
export const configuredAccounts = 'login:configuredAccounts'
export const waitingForResponse = 'login:waitingForResponse'
export const setRevokedSelf = 'login:setRevokedSelf'
export const setDeletedSelf = 'login:setDeletedSelf'
export const setLoginFromRevokedDevice = 'login:setLoginFromRevokedDevice'

export const actionSetForgotPasswordSubmitting = 'login:actionSetForgotPasswordSubmitting'
export const actionForgotPasswordDone = 'login:actionForgotPasswordDone'

export const actionRegisteredWithUserPass = 'login:actionRegisteredWithUserPass'
export const actionRegisteredWithPaperKey = 'login:actionRegisteredWithPaperKey'
export const actionRegisteredWithExistingDevice = 'login:actionRegisteredWithExistingDevice'
export const openAccountResetPage = 'login:openAccountResetPage'
export const navBasedOnLoginState = 'login:navBasedOnLoginState'
