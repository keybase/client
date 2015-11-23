/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component, StyleSheet, Text, View, TextInput} from '../../../base-react'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import QR from './qr'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'

export default class CodePageRender extends Component {
  controlStyle (mode) {
    if (this.props.mode === mode) {
      return {backgroundColor: 'green'}
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
        controls = [codePageModeScanCode, codePageModeShowText]
        break
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone: // fallthrough
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
        if (this.props.cameraBrokenMode) {
          controls = [codePageModeShowText, codePageModeEnterText]
        } else {
          controls = [codePageModeShowCode, codePageModeScanCode]
        }
        break
      case codePageDeviceRoleNewComputer + codePageDeviceRoleExistingPhone: // fallthrough
      case codePageDeviceRoleExistingComputer + codePageDeviceRoleNewPhone:
        controls = [codePageModeShowCode, codePageModeEnterText]
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
        onBarCodeRead={code => this.props.qrScanned(code)}
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

  renderText () {
    return (
      <View style={{flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <Text>Type this verification code into your other device</Text>
        <Text style={{backgroundColor: 'grey', padding: 20, marginTop: 20}}>{this.props.textCode}</Text>
      </View>
    )
  }

  renderCode () {
    return (
      <QR
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}
        scanning={false}
        qrCode={this.props.qrCode}>
        <Text style={styles.text}>Scan this QR code with your other device</Text>
      </QR>
    )
  }

  renderEnterText () {
    return (
      <View style={{flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <Text style={commonStyles.h1}>Type the verification code from your other device into here</Text>
        <TextInput
          style={[commonStyles.textInput, {height: 100, marginTop: 40}]}
          onChangeText={enterText => this.props.onChangeText(enterText)}
          autoCapitalize={'none'}
          placeholder='Type code here'
          value={this.props.enterText}
          multiline />
        <Button style={{alignSelf: 'flex-end'}} title='Submit' action onPress={() => {
          this.props.textEntered()
        }}/>
      </View>
    )
  }

  renderContent () {
    switch (this.props.mode) {
      case codePageModeScanCode:
        return this.renderScanner()
      case codePageModeShowCode:
        return this.renderCode()
      case codePageModeEnterText:
        return this.renderEnterText()
      case codePageModeShowText:
        return this.renderText()
    }
  }

  render () {
    return (
      <View style={styles.container}>
        {this.renderContent()}
        {this.renderControls()}
      </View>
    )
  }
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePageRender.propTypes = {
  mode: React.PropTypes.oneOf([codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]).isRequired,
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'stretch',
    justifyContent: 'flex-start'
  },
  box: {
    backgroundColor: 'red',
    position: 'absolute'
  },
  boxCorner: {
    height: 1,
    width: 20
  },
  boxEdge: {
    top: 0,
    bottom: 0,
    width: 1
  },
  text: {
    margin: 50,
    color: 'white',
    textAlign: 'center',
    shadowColor: 'black',
    shadowOpacity: 1,
    shadowOffset: {width: 1, height: 1}
  }
})
