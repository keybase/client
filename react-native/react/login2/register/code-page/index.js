'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View, TextInput } from 'react-native'

import {
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleNewPhone,
  codePageDeviceRoleExistingComputer,
  codePageDeviceRoleNewComputer } from '../../../constants/login2'
import { codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText } from '../../../constants/login2'
import { setCodePageMode, qrScanned, setCameraBrokenMode, textEntered } from '../../../actions/login2'
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
  renderControls () {
    switch (this.props.myDeviceRole + this.props.otherDeviceRole) {
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingComputer: // fallthrough
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewComputer:
        return (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20}}>
            <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeScanCode)) }>QR Code</Text>
            <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeShowText)) }>Text Code</Text>
          </View>
        )
      case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone:
        if (this.props.cameraBrokenMode) {
          return (
            <View style={{flexDirection: 'column', padding: 20}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20}}>
                <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeShowText)) }>Display code</Text>
                <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeEnterText)) }>Enter Code</Text>
              </View>
              <Text style={{textAlign: 'center'}} onPress={() => {
                this.props.dispatch(setCameraBrokenMode(false))
                this.props.dispatch(setCodePageMode(codePageModeShowCode))
              }}>Camera working?</Text>
            </View>
          )
        } else {
          return (
            <View style={{flexDirection: 'column', padding: 20}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20}}>
                <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeShowCode)) }>Display code</Text>
                <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeScanCode)) }>Scan Code</Text>
              </View>
              <Text style={{textAlign: 'center'}} onPress={() => {
                this.props.dispatch(setCameraBrokenMode(true))
                this.props.dispatch(setCodePageMode(codePageModeShowText))
              }}>Camera broken?</Text>
            </View>
          )
        }
    }

    return null
  }

  renderScanner () {
    return (
      <QR style={{flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', flexDirection: 'row'}}
        scanning
        onBarCodeRead={(code) => this.props.dispatch(qrScanned(code))}
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
      <View style={{flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <Text>Show code </Text>
      </View>
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
          this.props.dispatch(textEntered(this.state.enterText))
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

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        component: CodePage,
        mapStateToProps: state => state.login2.codePage
      }
    }
  }
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePage.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  mode: React.PropTypes.oneOf([codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
  codeCountDown: React.PropTypes.number,
  textCode: React.PropTypes.string,
  qrCode: React.PropTypes.string,
  myDeviceRole: React.PropTypes.oneOf(validRoles),
  otherDeviceRole: React.PropTypes.oneOf(validRoles),
  cameraBrokenMode: React.PropTypes.bool.isRequired
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

