'use strict'
/* @flow */

// constants
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
export const login = 'Login:login'
export const loginDone = 'Login:loginDone'
export const logoutDone = 'Login:logoutDone'
export const setOtherDeviceCodeState = 'Login:setOtherDeviceCodeState'
export const setCodeMode = 'Login:setCodeMode'
export const setCountdown = 'Login:setCountdown'
export const setTextCode = 'Login:setTextCode'
export const qrScanned = 'Login:qrScanned'
export const qrGenerate = 'Login:qrGenerate'
export const setQRCode = 'Login:setQRCode'
export const cameraBrokenMode = 'Login:cameraBrokenMode'
export const needsLogin = 'Login:needsLogin'
export const needsRegistering = 'Login:needsRegistering'
export const doneRegistering = 'Login:doneRegistering '
export const actionRegisterSubmitUserPass = 'Login:actionRegisterSubmitUserPass'
export const actionRegisterUserPassSubmit = 'Login:actionRegisterUserPassSubmit'
export const actionRegisterUserPassDone = 'Login:actionRegisterUserPassDone'
export const actionUpdateForgotPasswordEmailAddress = 'Login:actionUpdateForgotPasswordEmailAddress'
export const actionSetForgotPasswordSubmitting = 'Login:actionSetForgotPasswordSubmitting'
export const actionForgotPasswordDone = 'Login:actionForgotPasswordDone'
export const deviceNameSet = 'Login:deviceNameSet'
