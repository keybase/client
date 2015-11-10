'use strict'
/* @flow */

/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from '../../../base-react'
import {TextField, RaisedButton} from 'material-ui'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login2'
import {codePageModeShowCodeOrEnterText, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login2'

export default class CodePageRender extends Component {
  constructor (props) {
    super(props)

    this.state = {
      enterText: ''
    }
  }

  /*
  controlStyle (mode) {
    if (this.props.mode === mode) {
      return { backgroundColor: 'green' }
    }
    return {}
  }

  renderSwitch (mode) {
    const label = {
      codePageModeShowText: 'Display Code',
      codePageModeEnterText: 'Enter Code',
      codePageModeShowCode: 'Display Code',
      codePageModeScanCode: 'Scan Code'
    }

    return (<Text style={this.controlStyle(mode)} onPress={() => this.props.setCodePageMode(mode) }>{label[mode]}</Text>)
  }

  renderCameraBrokenControl () {
    switch (this.props.myDeviceRole + this.props.otherDeviceRole) {
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone: // fallthrough
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
        return (<Text style={{textAlign: 'center', backgroundColor: 'red', padding: 20}} onPress={() => {
          this.props.setCameraBrokenMode(!this.props.cameraBrokenMode)
        }}>Camera {this.props.cameraBrokenMode ? 'working' : 'broken'}?</Text>)
    }

    return null
  }

  renderControls () {
    let controls = null

    switch (this.props.myDeviceRole + this.props.otherDeviceRole) {
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingComputer: // fallthrough
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewComputer:
        controls = [ codePageModeScanCode, codePageModeShowText ]
        break
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone: // fallthrough
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
        if (this.props.cameraBrokenMode) {
          controls = [ codePageModeShowText, codePageModeEnterText ]
        } else {
          controls = [ codePageModeShowCode, codePageModeScanCode ]
        }
        break
      case codePageDeviceRoleNewComputer + codePageDeviceRoleExistingPhone: // fallthrough
      case codePageDeviceRoleExistingComputer + codePageDeviceRoleNewPhone:
        controls = [ codePageModeShowCode, codePageModeEnterText ]
        break
    }

    if (!controls) {
      return null
    }

    return (
      <View style={{flexDirection: 'column', justifyContent: 'space-between'}}>
        {[
          (<View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: 'orange'}}>
            {controls.map(c => this.renderSwitch(c))}
          </View>),
          this.renderCameraBrokenControl()
        ]}
      </View>
    )
  }

  renderScanner () {
    return (
      <QR
        scanning
        onBarCodeRead={(code) => this.props.qrScanned(code)}
        qrCode={this.props.qrCode}>

        <Text style={styles.text}>Use this phone to scan the QR code displayed on your other device</Text>
        <View style={{alignSelf: 'center', width: 200, height: 200}}>
          <View style={[styles.box, styles.boxEdge, {left: 0}]}/>
          <View style={[styles.box, styles.boxEdge, {right: 0}]}/>
          <View style={[styles.box, styles.boxCorner, {right: 0, top: 0}]}/>
          <View style={[styles.box, styles.boxCorner, {left: 0, top: 0}]}/>
          <View style={[styles.box, styles.boxCorner, {right: 0, bottom: 0}]}/>
          <View style={[styles.box, styles.boxCorner, {left: 0, bottom: 0}]}/>
        </View>
      </QR>
    )
  }
        */

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
          value={this.state.enterText}
          multiLine
          onChange={event => this.setState({enterText: event.target.value})}
        />
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.props.textEntered(this.state.enterText)}
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
  myDeviceRole: React.PropTypes.oneOf(validRoles),
  otherDeviceRole: React.PropTypes.oneOf(validRoles),
  cameraBrokenMode: React.PropTypes.bool.isRequired,
  setCodePageMode: React.PropTypes.func.isRequired,
  qrScanned: React.PropTypes.func.isRequired,
  setCameraBrokenMode: React.PropTypes.func.isRequired,
  textEntered: React.PropTypes.func.isRequired
}
