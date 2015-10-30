'use strict'
/* @flow */

/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, { Component, StyleSheet, Text, View, TextInput } from 'react-native'
import { codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
         codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer } from '../../../constants/login2'
import { codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText } from '../../../constants/login2'
import { setCodePageMode, qrScanned, setCameraBrokenMode, textEntered, doneRegistering } from '../../../actions/login2'
import QR from './qr'
import Button from '../../../common-adapters/button'
import commonStyles from '../../../styles/common'

export default class CodePage extends Component {
  constructor (props) {
    super(props)

    this.state = {
      enterText: null
    }
  }

  componentWillUnmount () {
    this.props.doneRegistering()
  }

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

  countDownToTime () {
    const mins = Math.floor(this.props.codeCountDown / 60)
    const secs = this.props.codeCountDown - (mins * 60)
    let secString = `${secs}`
    if (secString.length < 2) {
      secString = '0' + secString
    }
    return `${mins}:${secString}`
  }

  renderText () {
    return (
      <View style={{flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <Text>Type this verification code into your other device</Text>
        <Text style={{alignSelf: 'flex-end'}}>Code valid for {this.countDownToTime()}</Text>
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
        <Text style={{alignSelf: 'flex-end', marginRight: 40}}>Code valid for {this.countDownToTime()}</Text>
      </QR>
    )
  }

  renderEnterText () {
    return (
      <View style={{flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <Text style={commonStyles.h1}>Type the verification code from your other device into here</Text>
        <TextInput value={this.state.enterText}
          style={[commonStyles.textInput, {height: 100, marginTop: 40}]}
          onChangeText={(enterText) => this.setState({enterText})}
          placeholder='Type code here'
          multiline />
        <Button style={{alignSelf: 'flex-end'}} title='Submit' action onPress={() => {
          this.props.textEntered(this.state.enterText)
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

  /*
  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        component: CodePage,
        mapStateToProps: state => {
          const {
            mode, codeCountDown, textCode, qrCode,
            myDeviceRole, otherDeviceRole, cameraBrokenMode } = state.login2.codePage
          return {
            mode,
            codeCountDown,
            textCode,
            qrCode,
            myDeviceRole,
            otherDeviceRole,
            cameraBrokenMode
          }
        },
        props: {
          setCodePageMode: mode => store.dispatch(setCodePageMode(mode)),
          qrScanned: code => store.dispatch(qrScanned(code)),
          setCameraBrokenMode: broken => store.dispatch(setCameraBrokenMode(broken)),
          textEntered: text => store.dispatch(textEntered(text)),
          doneRegistering: () => store.dispatch(doneRegistering())
        }
      }
    }
  }
  */
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePage.propTypes = {
  mode: React.PropTypes.oneOf([codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
  codeCountDown: React.PropTypes.number,
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

