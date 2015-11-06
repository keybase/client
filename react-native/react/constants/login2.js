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
export const login = 'login'
export const loginDone = 'loginDone'
export const logoutDone = 'logoutDone'
export const setOtherDeviceCodeState = 'setOtherDeviceCodeState'
export const setCodeMode = 'setCodeMode'
export const setCountdown = 'setCountdown'
export const setTextCode = 'setTextCode'
export const qrScanned = 'qrScanned'
export const qrGenerate = 'qrGenerate'
export const setQRCode = 'setQRCode'
export const cameraBrokenMode = 'cameraBrokenMode'
export const needsLogin = 'needsLogin'
export const needsRegistering = 'needsRegistering'
export const doneRegistering = 'doneRegistering '

export const actionUpdateForgotPasswordEmailAddress = 'actionUpdateForgotPasswordEmailAddress'
export const actionSetForgotPasswordSubmitting = 'actionSetForgotPasswordSubmitting'
export const actionForgotPasswordDone = 'actionForgotPasswordDone'

export const actionAskUserPass = 'actionAskUserPass'
export const actionSetUserPass = 'actionSetUserPass'

export const actionAskDeviceName = 'actionAskDeviceName'
export const actionSetDeviceName = 'actionSetDeviceName'

export const actionRegisteredWithUserPass = 'actionRegisteredWithUserPass'
export const actionRegisteredWithPaperKey = 'actionRegisteredWithPaperKey'
export const actionRegisteredWithExistingDevice = 'actionRegisteredWithExistingDevice'
