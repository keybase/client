// @flow
import * as I from 'immutable'
import * as Types from './types/login'

export const codePageDeviceRoleExistingPhone = 'codePageDeviceRoleExistingPhone'
export const codePageDeviceRoleNewPhone = 'codePageDeviceRoleNewPhone'
export const codePageDeviceRoleExistingComputer = 'codePageDeviceRoleExistingComputer'
export const codePageDeviceRoleNewComputer = 'codePageDeviceRoleNewComputer'

export const codePageModeScanCode = 'codePageModeScanCode'
export const codePageModeShowCode = 'codePageModeShowCode'
export const codePageModeEnterText = 'codePageModeEnterText'
export const codePageModeShowText = 'codePageModeShowText'

function defaultModeForDeviceRoles(
  myDeviceRole: Types.DeviceRole,
  otherDeviceRole: Types.DeviceRole,
  brokenMode: boolean
): ?Types.Mode {
  switch (myDeviceRole + otherDeviceRole) {
    case codePageDeviceRoleExistingComputer + codePageDeviceRoleNewComputer:
      return codePageModeEnterText
    case codePageDeviceRoleNewComputer + codePageDeviceRoleExistingComputer:
      return codePageModeShowText

    case codePageDeviceRoleExistingComputer + codePageDeviceRoleNewPhone:
      return codePageModeShowCode
    case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingComputer:
      return codePageModeScanCode

    case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewComputer:
      return codePageModeScanCode
    case codePageDeviceRoleNewComputer + codePageDeviceRoleExistingPhone:
      return codePageModeShowCode

    case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone:
      return brokenMode ? codePageModeShowText : codePageModeShowCode
    case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
      return brokenMode ? codePageModeEnterText : codePageModeScanCode
  }
  return null
}

function qrGenerate(code: string): string {
  const QRCodeGen = require('qrcode-generator')
  const qr = QRCodeGen(4, 'L')
  qr.addData(code)
  qr.make()
  let tag = qr.createImgTag(10)
  const src = tag.split(' ')[1]
  const qrCode = src.split('"')[1]
  return qrCode
}

const makeAccount: I.RecordFactory<Types._Account> = I.Record({
  hasStoredSecret: false,
  username: '',
})

const makeState: I.RecordFactory<Types._State> = I.Record({
  codePageCameraBrokenMode: false,
  codePageCodeCountDown: 0,
  codePageEnterCodeErrorText: '',
  codePageMode: null,
  codePageMyDeviceRole: null,
  codePageOtherDeviceRole: null,
  codePageQrCode: null,
  codePageQrCodeScanned: false,
  codePageQrScanned: null,
  codePageTextCode: null,
  configuredAccounts: I.List(),
  forgotPasswordError: null,
  forgotPasswordSubmitting: false,
  forgotPasswordSuccess: false,
  justDeletedSelf: null,
  justRevokedSelf: null,
  loginError: null,
  registerUserPassError: null,
  registerUserPassLoading: false,
  waitingForResponse: false,
})

export {makeState, qrGenerate, defaultModeForDeviceRoles, makeAccount}
