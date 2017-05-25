// @flow
import * as Constants from '../../constants/login'
import QRCodeGen from 'qrcode-generator'

import type {DeviceRole, Mode} from '../../constants/login'

export function defaultModeForDeviceRoles(
  myDeviceRole: DeviceRole,
  otherDeviceRole: DeviceRole,
  brokenMode: boolean
): ?Mode {
  switch (myDeviceRole + otherDeviceRole) {
    case Constants.codePageDeviceRoleExistingComputer + Constants.codePageDeviceRoleNewComputer:
      return Constants.codePageModeEnterText
    case Constants.codePageDeviceRoleNewComputer + Constants.codePageDeviceRoleExistingComputer:
      return Constants.codePageModeShowText

    case Constants.codePageDeviceRoleExistingComputer + Constants.codePageDeviceRoleNewPhone:
      return Constants.codePageModeShowCode
    case Constants.codePageDeviceRoleNewPhone + Constants.codePageDeviceRoleExistingComputer:
      return Constants.codePageModeScanCode

    case Constants.codePageDeviceRoleExistingPhone + Constants.codePageDeviceRoleNewComputer:
      return Constants.codePageModeScanCode
    case Constants.codePageDeviceRoleNewComputer + Constants.codePageDeviceRoleExistingPhone:
      return Constants.codePageModeShowCode

    case Constants.codePageDeviceRoleExistingPhone + Constants.codePageDeviceRoleNewPhone:
      return brokenMode ? Constants.codePageModeShowText : Constants.codePageModeShowCode
    case Constants.codePageDeviceRoleNewPhone + Constants.codePageDeviceRoleExistingPhone:
      return brokenMode ? Constants.codePageModeEnterText : Constants.codePageModeScanCode
  }
  return null
}

export function qrGenerate(code: string): string {
  const qr = QRCodeGen(4, 'L')
  qr.addData(code)
  qr.make()
  let tag = qr.createImgTag(10)
  const src = tag.split(' ')[1]
  const qrCode = src.split('"')[1]
  return qrCode
}
