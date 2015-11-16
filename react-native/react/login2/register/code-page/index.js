'use strict'
/* @flow */

/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from '../../../base-react'
import { codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
         codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer } from '../../../constants/login2'
import { codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText } from '../../../constants/login2'
import Render from './index.render'

export default class CodePage extends Component {
  render () {
    return (
      <Render
        mode={this.props.mode}
        textCode={this.props.textCode}
        qrCode={this.props.qrCode}
        myDeviceRole={this.props.myDeviceRole}
        otherDeviceRole={this.props.otherDeviceRole}
        cameraBrokenMode={this.props.cameraBrokenMode}
        setCodePageMode={this.props.setCodePageMode}
        qrScanned={this.props.qrScanned}
        setCameraBrokenMode={this.props.setCameraBrokenMode}
        textEntered={this.props.textEntered}
        doneRegistering={this.props.doneRegistering}
      />
    )
  }
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePage.propTypes = {
  mode: React.PropTypes.oneOf([codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
  textCode: React.PropTypes.string,
  qrCode: React.PropTypes.string,
  myDeviceRole: React.PropTypes.oneOf(validRoles),
  otherDeviceRole: React.PropTypes.oneOf(validRoles),
  cameraBrokenMode: React.PropTypes.bool.isRequired,
  setCodePageMode: React.PropTypes.func.isRequired,
  qrScanned: React.PropTypes.func.isRequired,
  setCameraBrokenMode: React.PropTypes.func.isRequired,
  textEntered: React.PropTypes.func.isRequired,
  doneRegistering: React.PropTypes.func.isRequired
}
