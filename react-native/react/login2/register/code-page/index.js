'use strict'
/* @flow */

import React, { Component, StyleSheet, Text, View } from 'react-native'

import { codePageRolePhone1, codePageRolePhone2, codePageRoleComputer1, codePageRoleComputer2 } from '../../../constants/login2'
import { codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText } from '../../../constants/login2'
import { setCodePageMode, qrScanned } from '../../../actions/login2'
import QR from './qr'

export default class CodePage extends Component {
  renderControls () {
    switch (this.props.role + this.props.otherRole) {
      case codePageRolePhone2 + codePageRoleComputer1:
        return (
          <View style={{flexDirection: 'row', justifyContent: 'space-between', padding: 20}}>
            <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeScanCode)) }>QR Code</Text>
            <Text onPress={() => this.props.dispatch(setCodePageMode(codePageModeShowText)) }>Text Code</Text>
          </View>
        )
    }

    return null
  }

  renderScanner () {
    return (
      <QR style={{flex: 1, alignItems: 'flex-start', justifyContent: 'flex-start', flexDirection: 'row'}}
        scanning
        onBarCodeRead={(code) => this.props.dispatch(qrScanned(code))}
        qrCode={this.props.qrCode}>

        <Text style={{margin: 50, color: 'white', textAlign: 'center', shadowColor: 'black', shadowOpacity: 1, shadowOffset: {width: 1, height: 1}}}>Use this phone to scan the QR code displayed on your other device</Text>
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

  renderContent () {
    switch (this.props.mode) {
      case codePageModeScanCode:
        return this.renderScanner()
      case codePageModeShowCode:
        return (<Text>Show code </Text>)
      case codePageModeEnterText:
        return (<Text>Enter text</Text>)
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
        title: '',
        component: CodePage,
        leftButtonTitle: '',
        mapStateToProps: state => state.login2.codePage
      }
    }
  }
}

CodePage.propTypes = {
  dispatch: React.PropTypes.func.isRequired,
  otherRole: React.PropTypes.oneOf([codePageRolePhone1, codePageRolePhone2, codePageRoleComputer1, codePageRoleComputer2]),
  mode: React.PropTypes.oneOf([codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
  codeCountDown: React.PropTypes.number,
  textCode: React.PropTypes.string,
  qrCode: React.PropTypes.string
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
  }
})

