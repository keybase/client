/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from 'react'
import {StyleSheet} from 'react-native'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import QR from './qr'
import {Box, ProgressIndicator, TabBar, Text} from '../../../common-adapters'
import {specialStyles} from '../../../common-adapters/text'
import Container from '../../forms/container'
import {globalStyles} from '../../../styles/style-guide'

export default class CodePageRender extends Component {
  renderControl (mode) {
    const label = {
      codePageModeShowText: 'Display Code',
      codePageModeEnterText: 'Enter Code',
      codePageModeShowCode: 'Display Code',
      codePageModeScanCode: 'Scan Code'
    }

    return (
      <TabBar.Item key={mode} selected={mode === this.props.mode} label={label[mode]} onPress={() => this.props.setCodePageMode(mode)}>
        <Box style={{...stylesHeader, width: 300, height: 200}}>
          {mode === codePageModeScanCode && this.renderScanner()}
          {mode === codePageModeShowCode && this.renderCode()}
          {mode === codePageModeShowText && this.renderText()}
        </Box>
      </TabBar.Item>
    )
  }

  renderContent () {
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

    return (
      <Box style={stylesHeader}>
        <TabBar underlined tabWidth={150}>
          {controls.map(c => this.renderControl(c))}
        </TabBar>
      </Box>
    )
  }

  renderChangeMode () {
    switch (this.props.myDeviceRole + this.props.otherDeviceRole) {
      case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
        if (this.props.mode === codePageModeScanCode) {
          return (
            <Box style={stylesFooter}>
              <Text>Type text code instead</Text>
            </Box>
          )
        } else {
          return (
            <Box style={stylesFooter}>
              <Text>Scan QR code instead</Text>
            </Box>
          )
        }
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
      <Box style={stylesControl}>
        <Text style={specialStyles.paperKey}>{this.props.textCode}</Text>
        <ProgressIndicator styleAttr='Normal' style={stylesSpinner}/>
      </Box>
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
        <Box style={{alignSelf: 'center', width: 200, height: 200}}>
          <Box style={[styles.box, styles.boxEdge, {left: 0}]}/>
          <Box style={[styles.box, styles.boxEdge, {right: 0}]}/>
          <Box style={[styles.box, styles.boxCorner, {right: 0, top: 0}]}/>
          <Box style={[styles.box, styles.boxCorner, {left: 0, top: 0}]}/>
          <Box style={[styles.box, styles.boxCorner, {right: 0, bottom: 0}]}/>
          <Box style={[styles.box, styles.boxCorner, {left: 0, bottom: 0}]}/>
        </Box>
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
  ...globalStyles.flexBoxColumn,
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
  marginBottom: 80,
  alignItems: 'center'
}

const stylesControl = {
  marginTop: 46,
  height: 100
}

const stylesSpinner = {
  marginTop: 30,
  alignSelf: 'center'
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
