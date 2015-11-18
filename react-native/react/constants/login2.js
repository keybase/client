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
export const codePageModeShowCodeOrEnterText = 'codePageModeShowCodeOrEnterText'

export const countDownTime = 5 * 60

// actions
export const login = 'login2:login'
export const loginDone = 'login2:loginDone'
export const logoutDone = 'login2:logoutDone'
export const setOtherDeviceCodeState = 'login2:setOtherDeviceCodeState'
export const setCodeMode = 'login2:setCodeMode'
export const setTextCode = 'login2:setTextCode'
export const qrScanned = 'login2:qrScanned'
export const setQRCode = 'login2:setQRCode'
export const cameraBrokenMode = 'login2:cameraBrokenMode'
export const needsLogin = 'login2:needsLogin'
export const needsRegistering = 'login2:needsRegistering'
export const doneRegistering = 'login2:doneRegistering '

export const actionUpdateForgotPasswordEmailAddress = 'login2:actionUpdateForgotPasswordEmailAddress'
export const actionSetForgotPasswordSubmitting = 'login2:actionSetForgotPasswordSubmitting'
export const actionForgotPasswordDone = 'login2:actionForgotPasswordDone'

export const actionSetUserPass = 'login2:actionSetUserPass'

export const actionAskDeviceName = 'login2:actionAskDeviceName'
export const actionSetDeviceName = 'login2:actionSetDeviceName'

export const actionRegisteredWithUserPass = 'login2:actionRegisteredWithUserPass'
export const actionRegisteredWithPaperKey = 'login2:actionRegisteredWithPaperKey'
export const actionRegisteredWithExistingDevice = 'login2:actionRegisteredWithExistingDevice'
