/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeShowCodeOrEnterText, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'

export default class CodePageRender extends Component {
  renderText () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <h1>Type this verification code into your other device</h1>
        <p style={{backgroundColor: 'grey', padding: 20, marginTop: 20}}>{this.props.textCode}</p>
      </div>
    )
  }

  renderCode () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <h1>Scan this code with your other device</h1>
        <img style={{width: 300, height: 300, imageRendering: 'pixelated'}} src={this.props.qrCode} />
      </div>
    )
  }

  renderEnterText () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <h1>Type the verification code from your other device into here</h1>
        <TextField
          hintText='Type code here'
          floatingLabelText='Code'
          value={this.props.enterText}
          multiLine
          onChange={event => this.props.onChangeText(event.target.value)}
        />
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.props.textEntered()}
        />
      </div>
    )
  }

  renderShowCodeAndEnterText () {
    return (
      <div style={{display: 'flex', flexDirection: 'row', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        {this.renderCode()}
        <div style={{display: 'flex', flexDirection: 'column', backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
          <p>|</p>
          <p>or</p>
          <p>|</p>
        </div>
        {this.renderEnterText()}
      </div>
    )
  }

  render () {
    switch (this.props.mode) {
      case codePageModeShowCodeOrEnterText:
        return this.renderShowCodeAndEnterText()
      case codePageModeShowCode:
        return this.renderCode()
      case codePageModeEnterText:
        return this.renderEnterText()
      case codePageModeShowText:
        return this.renderText()
    }
    return (<div/>)
  }
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePageRender.propTypes = {
  mode: React.PropTypes.oneOf([codePageModeShowCodeOrEnterText, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
  textCode: React.PropTypes.string,
  qrCode: React.PropTypes.string,
  myDeviceRole: React.PropTypes.oneOf(validRoles).isRequired,
  otherDeviceRole: React.PropTypes.oneOf(validRoles).isRequired,
  cameraBrokenMode: React.PropTypes.bool.isRequired,
  setCodePageMode: React.PropTypes.func.isRequired,
  qrScanned: React.PropTypes.func.isRequired,
  setCameraBrokenMode: React.PropTypes.func.isRequired,
  textEntered: React.PropTypes.func.isRequired,
  onChangeText: React.PropTypes.func.isRequired,
  enterText: React.PropTypes.string
}
