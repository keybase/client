'use strict'

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
export const login = 'login:login'
export const loginDone = 'login:loginDone'
export const logoutDone = 'login:logoutDone'
export const setOtherDeviceCodeState = 'login:setOtherDeviceCodeState'
export const setCodeMode = 'login:setCodeMode'
export const setTextCode = 'login:setTextCode'
export const qrScanned = 'login:qrScanned'
export const setQRCode = 'login:setQRCode'
export const cameraBrokenMode = 'login:cameraBrokenMode'
export const needsLogin = 'login:needsLogin'
export const needsRegistering = 'login:needsRegistering'
export const doneRegistering = 'login:doneRegistering '

export const actionUpdateForgotPasswordEmailAddress = 'login:actionUpdateForgotPasswordEmailAddress'
export const actionSetForgotPasswordSubmitting = 'login:actionSetForgotPasswordSubmitting'
export const actionForgotPasswordDone = 'login:actionForgotPasswordDone'

export const actionSetUserPass = 'login:actionSetUserPass'

export const actionAskDeviceName = 'login:actionAskDeviceName'
export const actionSetDeviceName = 'login:actionSetDeviceName'

export const actionRegisteredWithUserPass = 'login:actionRegisteredWithUserPass'
export const actionRegisteredWithPaperKey = 'login:actionRegisteredWithPaperKey'
export const actionRegisteredWithExistingDevice = 'login:actionRegisteredWithExistingDevice'
