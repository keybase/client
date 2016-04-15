/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from 'react'
import {StyleSheet, View, TextInput} from 'react-native'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import QR from './qr'
import {Box, Button, TabBar, TabBarItem, Text} from '../../../common-adapters'
import {specialStyles as textStyles} from '../../../common-adapters/text'
import Container from '../../forms/container'
import commonStyles from '../../../styles/common'

export default class CodePageRender extends Component {
  renderContent () {
    const label = {
      codePageModeShowText: 'Display Code',
      codePageModeEnterText: 'Enter Code',
      codePageModeShowCode: 'Display Code',
      codePageModeScanCode: 'Scan Code'
    }

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
      return <Box/>
    }

    const mode = this.props.mode

    const controla = controls[0]
    const controlb = controls[1]
    const tabbar1 = mode => {
      return (
        <TabBar.Item selected={mode === this.props.mode} label={label[mode]} onPress={() => this.props.setCodePageMode(mode)}>
          <Box>
            <Text>foo</Text>
            {this.renderCode()}
          </Box>
        </TabBar.Item>
      )
    }

    const tabbar2 = mode => {
      return (
        <TabBar.Item selected={mode === this.props.mode} label={label[mode]} onPress={() => this.props.setCodePageMode(mode)}>
          <Box>
            <Text>bar</Text>
            {this.renderText()}
          </Box>
        </TabBar.Item>
      )
    }

    return (
      <Box style={stylesHeader}>
        <TabBar underlined tabWidth={150}>
          {tabbar1(controla)}
          {tabbar2(controlb)}
        </TabBar>
      </Box>
    )
  }

  renderChangeMode () {
    switch (this.props.mode) {
      case codePageModeScanCode:
        return (
          <Box style={stylesFooter}>
            <Text>Type text code instead</Text>
          </Box>
        )
      default:
        return (
          <Box style={stylesFooter}>
            <Text>Scan QR code instead</Text>
          </Box>
        )
    }
  }

  renderIntro () {
    return (
      <Box style={stylesIntro}>
        <Text type='Header' style={{marginBottom: 10}} inline>Type in text code</Text>
        <Text type='BodySmall' inline>Please run&nbsp;</Text>
        <Text type='TerminalSmall' inline>keybase device add</Text>
        <Text type='BodySmall' inline>&nbsp;in the terminal on your computer.</Text>
      </Box>
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

  render () {
    return (
      <Container style={stylesContainer} onBack={this.props.onBack}>
        {this.renderIntro()}
        {this.renderContent()}
        {this.renderChangeMode()}
      </Container>
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

const stylesContainer = {
  flex: 1,
  alignItems: 'stretch',
  justifyContent: 'flex-start'
}

const stylesHeader = {
  marginTop: 46,
  alignItems: 'center'
}

const stylesIntro = {
  marginTop: 55,
  alignItems: 'center'
}

const stylesFooter = {
  position: 'absolute',
  marginBottom: 30,
  alignItems: 'center'
}

const styles = StyleSheet.create({
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
