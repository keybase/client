// @flow
import HiddenString from '../util/hidden-string'

export type Mode =
  | 'codePageModeScanCode'
  | 'codePageModeShowCode'
  | 'codePageModeEnterText'
  | 'codePageModeShowText'

export type DeviceRole =
  | 'codePageDeviceRoleExistingPhone'
  | 'codePageDeviceRoleNewPhone'
  | 'codePageDeviceRoleExistingComputer'
  | 'codePageDeviceRoleNewComputer'

export const codePageDeviceRoleExistingPhone = 'codePageDeviceRoleExistingPhone'
export const codePageDeviceRoleNewPhone = 'codePageDeviceRoleNewPhone'
export const codePageDeviceRoleExistingComputer = 'codePageDeviceRoleExistingComputer'
export const codePageDeviceRoleNewComputer = 'codePageDeviceRoleNewComputer'

export const codePageModeScanCode = 'codePageModeScanCode'
export const codePageModeShowCode = 'codePageModeShowCode'
export const codePageModeEnterText = 'codePageModeEnterText'
export const codePageModeShowText = 'codePageModeShowText'

export const countDownTime = 5 * 60

export function defaultModeForDeviceRoles(
  myDeviceRole: DeviceRole,
  otherDeviceRole: DeviceRole,
  brokenMode: boolean
): ?Mode {
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

export function qrGenerate(code: string): string {
  const QRCodeGen = require('qrcode-generator')
  const qr = QRCodeGen(4, 'L')
  qr.addData(code)
  qr.make()
  let tag = qr.createImgTag(10)
  const src = tag.split(' ')[1]
  const qrCode = src.split('"')[1]
  return qrCode
}
// It's the b64 encoded value used to render the image
type QRCode = HiddenString

export type State = {
  codePage: {
    cameraBrokenMode: boolean,
    codeCountDown: number,
    enterCodeErrorText: string,
    mode: ?Mode,
    myDeviceRole: ?DeviceRole,
    otherDeviceRole: ?DeviceRole,
    qrCode: ?QRCode,
    qrCodeScanned: boolean,
    qrScanned: ?QRCode,
    textCode: ?HiddenString,
  },
  configuredAccounts: ?Array<{|hasStoredSecret: boolean, username: string|}>,
  forgotPasswordEmailAddress: string | '',
  forgotPasswordError: ?Error,
  forgotPasswordSubmitting: boolean,
  forgotPasswordSuccess: boolean,
  justDeletedSelf: ?string,
  justRevokedSelf: ?string,
  loginError: ?string,
  registerUserPassError: ?string,
  registerUserPassLoading: boolean,
  waitingForResponse: boolean,
}
