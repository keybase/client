// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import Container from '../../forms/container'
import Platform, {OS} from '../../../constants/platform'
import Qr from './qr'
import React, {Component} from 'react'
import type {IconType} from '../../../common-adapters/icon'
import type {Mode, DeviceRole} from '../../../constants/login'
import type {Props} from './index.render'
import {Box, ProgressIndicator, Text, Icon} from '../../../common-adapters'
import {StyleSheet, TouchableHighlight} from 'react-native'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
  codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer,
  codePageModeScanCode, codePageModeShowCode, codePageModeEnterText,
  codePageModeShowText} from '../../../constants/login'
import {globalStyles, globalColors} from '../../../styles'
import {specialStyles} from '../../../common-adapters/text'

const isIOS = Platform.OS_IOS === OS

function determineModes (myDeviceRole: DeviceRole, otherDeviceRole: DeviceRole, cameraBrokenMode: boolean): ?Array<Mode> {
  let controls = null

  switch (myDeviceRole + otherDeviceRole) {
    case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingComputer: // fallthrough
    case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewComputer:
      controls = [codePageModeScanCode, codePageModeShowText]
      break
    case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewPhone: // fallthrough
    case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingPhone:
      if (cameraBrokenMode) {
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

  return controls
}

class CodePageRender extends Component<void, Props, void> {
  renderMode (mode: Mode) {
    return (
      <Box style={{flex: 1, ...globalStyles.flexBoxColumn, alignItems: 'stretch'}}>
        {mode === codePageModeScanCode && this.renderScanner()}
        {mode === codePageModeShowCode && this.renderCode()}
        {mode === codePageModeShowText && this.renderText()}
      </Box>
    )
  }

  renderSwitch () {
    const availableModes = determineModes(this.props.myDeviceRole, this.props.otherDeviceRole, this.props.cameraBrokenMode)
    if (!availableModes) {
      return null
    }

    const inactiveModes = availableModes.filter(m => m !== this.props.mode)

    const modeTextMap: {[key: Mode]: string} = {
      codePageModeScanCode: 'Scan QR code instead',
      codePageModeShowCode: 'Display QR Code here instead',
      codePageModeShowText: 'Type text code instead',
    }

    const iconTypeMap: {[key: Mode]: IconType} = {
      codePageModeScanCode: 'icon-phone-qr-code-48',
      codePageModeShowCode: 'icon-phone-qr-code-48',
      codePageModeShowText: 'icon-phone-text-code-32',
    }

    const iconTypeFn = (m: Mode) => iconTypeMap[m] || 'phone-text-code'
    const modeTextFn = (m: Mode) => modeTextMap[m] || 'Switch mode'

    return (
      <Box style={{...globalStyles.flexBoxRow, ...stylesSwitch}}>
        {inactiveModes.map(mode => (
          <TouchableHighlight
            key={mode}
            activeOpacity={0.8}
            underlayColor={globalColors.white}
            onPress={() => this.props.setCodePageMode(mode)}>
            <Box style={{...globalStyles.flexBoxRow, alignItems: 'center', marginLeft: 10, marginRight: 10}}>
              <Icon type={iconTypeFn(mode)} />
              <Text type='Body' style={{marginLeft: 15, textAlign: 'center'}}>{modeTextFn(mode)}</Text>
            </Box>
          </TouchableHighlight>
        ))}
      </Box>
    )
  }

  renderContent () {
    return (
      <Box style={stylesHeader}>
        {this.props.mode
          ? this.renderMode(this.props.mode)
          : <Text type='Body'>No Active Mode found</Text>}
      </Box>
    )
  }

  renderIntroTextCode () {
    return (
      <Box style={stylesIntro}>
        <Text type='Header' style={{marginBottom: 10}} inline={true}>Type in text code</Text>
        <Text type='BodySmall' inline={true}>Please run </Text>
        <Text type='TerminalSmall' inline={true}>keybase device add</Text>
        <Text type='BodySmall' inline={true}> in the terminal on your computer.</Text>
      </Box>
    )
  }

  renderIntroScanQR () {
    return (
      <Box style={stylesIntro}>
        <Text type='Header' style={{marginBottom: 10}} inline={true}>Scan QR code</Text>
        <Text type='BodySmall' inline={true}>In the Keybase App</Text>
        <Text type='BodySmall' inline={true}>{'go to Devices > Add a new device'}</Text>
      </Box>
    )
  }

  renderIntroShowQR () {
    return (
      <Box style={stylesIntro}>
        <Text type='Header' style={{marginBottom: 10}} inline={true}>Scan this QR code</Text>
        <Text type='BodySmall' inline={true}>{'When adding a new mobile device'}</Text>
      </Box>
    )
  }

  renderIntro () {
    const headerTextMap: {[key: Mode]: React$Element<*>} = {
      codePageModeScanCode: this.renderIntroScanQR(),
      codePageModeShowCode: this.renderIntroShowQR(),
      codePageModeShowText: this.renderIntroTextCode(),
    }

    return headerTextMap[this.props.mode] || <Text type='BodySmall'>Good luck</Text>
  }

  renderText () {
    return (
      <Box style={stylesControl}>
        <Text type='Body' style={specialStyles.paperKey}>{this.props.textCode}</Text>
        <ProgressIndicator type='Large' style={stylesSpinner} />
      </Box>
    )
  }

  renderCode () {
    return (
      <Qr
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}
        scanning={false}
        onBarCodeRead={() => {}}
        qrCode={this.props.qrCode}>
        <Text type='Body'>Scan this QR code with your other device</Text>
      </Qr>
    )
  }

  renderScanner () {
    return (
      <Qr
        scanning={true}
        onBarCodeRead={code => this.props.qrScanned(code)}
        style={{flex: 1}}
        qrCode={this.props.qrCode}>

        {isIOS &&
          <Box style={{alignSelf: 'center', width: 200, height: 200}}>
            <Box style={[styles.box, styles.boxEdge, {left: 0}]} />
            <Box style={[styles.box, styles.boxEdge, {right: 0}]} />
            <Box style={[styles.box, styles.boxCorner, {right: 0, top: 0}]} />
            <Box style={[styles.box, styles.boxCorner, {left: 0, top: 0}]} />
            <Box style={[styles.box, styles.boxCorner, {right: 0, bottom: 0}]} />
            <Box style={[styles.box, styles.boxCorner, {left: 0, bottom: 0}]} />
          </Box>}
      </Qr>
    )
  }

  render () {
    return (
      <Container style={stylesContainer} onBack={this.props.onBack}>
        {this.renderIntro()}
        {this.renderContent()}
        {this.renderSwitch()}
      </Container>
    )
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
}

const stylesHeader = {
  flex: 1,
  marginTop: 46,
}

const stylesIntro = {
  marginTop: 55,
  alignItems: 'center',
}

const stylesSwitch = {
  justifyContent: 'center',
  marginTop: 50,
}

const stylesControl = {
  marginTop: 46,
  height: 100,
}

const stylesSpinner = {
  marginTop: 30,
  alignSelf: 'center',
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: 'red',
    position: 'absolute',
  },
  boxCorner: {
    height: 1,
    width: 20,
  },
  boxEdge: {
    top: 0,
    bottom: 0,
    width: 1,
  },
})

export default CodePageRender
