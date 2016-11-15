// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import Container from '../../forms/container'
import Platform, {OS} from '../../../constants/platform'
import Qr from './qr'
import React, {Component} from 'react'
import {Box, Button, ClickableBox, Icon, Input, NativeStyleSheet, ProgressIndicator, TabBar, Text} from '../../../common-adapters/index.native'
import {TabBarItem, TabBarButton} from '../../../common-adapters/tab-bar'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer, codePageModeScanCode, codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import {globalStyles, globalColors} from '../../../styles'

import type {IconType} from '../../../common-adapters/icon'
import type {Mode, DeviceRole} from '../../../constants/login'
import type {Props} from './index.render'

const isIOS = Platform.OS_IOS === OS

function determineModes (myDeviceRole: DeviceRole, otherDeviceRole: DeviceRole, cameraBrokenMode: boolean): ?Array<Mode> {
  let controls = null

  switch (myDeviceRole + otherDeviceRole) {
    case codePageDeviceRoleNewPhone + codePageDeviceRoleExistingComputer: // fallthrough
    case codePageDeviceRoleExistingPhone + codePageDeviceRoleNewComputer:
      controls = [codePageModeScanCode, codePageModeEnterText]
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

  renderShowCode () {
    return (
      <Qr
        style={{alignItems: 'center', justifyContent: 'center', flexDirection: 'column'}}
        scanning={false}
        onBarCodeRead={() => {}}
        qrCode={this.props.qrCode}>
      </Qr>
    )
  }

  renderScanCode() {
    return (
      <Qr
        scanning={true}
        onBarCodeRead={code => this.props.qrScanned(code)}
        style={{flex: 1}}
        qrCode={this.props.qrCode}>

        {isIOS &&
          <Box style={{alignSelf: 'center', width: 200, height: 200}}>
            <Box style={[stylesScan.box, stylesScan.boxEdge, {left: 0}]} />
            <Box style={[stylesScan.box, stylesScan.boxEdge, {right: 0}]} />
            <Box style={[stylesScan.box, stylesScan.boxCorner, {right: 0, top: 0}]} />
            <Box style={[stylesScan.box, stylesScan.boxCorner, {left: 0, top: 0}]} />
            <Box style={[stylesScan.box, stylesScan.boxCorner, {right: 0, bottom: 0}]} />
            <Box style={[stylesScan.box, stylesScan.boxCorner, {left: 0, bottom: 0}]} />
          </Box>}
      </Qr>
    )
  }

  renderShowText () {
    return (
      <Box style={stylesShowText}>
        <Text type='Header' style={stylesTextCode}>{this.props.textCode}</Text>
      </Box>
    )
  }

  renderEnterText () {
    return (
      <Box>
        <Box style={stylesEnterText}>
          <Icon type='icon-phone-text-code-32' style={{alignSelf: 'center'}} />
          <Input
            hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
            multiline={true}
            rows={3}
            value={this.props.enterText}
            onChangeText={text => this.props.onChangeText(text)}
          />
        </Box>
        <Button type='Primary' style={{marginTop: 5, marginBottom: 20}} label='Continue' onClick={() => this.props.textEntered(codePageModeEnterText)} />
      </Box>
    )
  }

  renderQRCode () {
    return (
      <Container style={stylesContainer} onBack={this.props.onBack}>
        <Box style={stylesIntro}>
          <Text type='Header' style={{marginBottom: 10}}>Scan QR code</Text>
          <Text type='Body'>In the Keybase App</Text>
          <Text type='Body'>{'go to Devices > Add a new device.'}</Text>
        </Box>
        <TabBar>
          <TabBarItem
            selected={this.props.mode === codePageModeShowCode}
            label='Display Code'
            onClick={() => { this.props.setCodePageMode(codePageModeScanCode) }}>
              {this.renderShowCode()}
          </TabBarItem>
          <TabBarItem
            label='Scan Code'
            selected={this.props.mode === codePageModeScanCode}
            onClick={() => { this.props.setCodePageMode(codePageModeShowCode) }}>
              {this.renderScanCode()}
          </TabBarItem>
        </TabBar>
      </Container>
    )
  }

  renderTextCode() {
    return (
      <Container style={stylesContainer} onBack={this.props.onBack}>
        <Box style={stylesIntro}>
          <Text type='Header' style={{marginBottom: 10}}>Type text code</Text>
            <Text type='Body'>In the Keybase App</Text>
            <Text type='Body'>{'go to Devices > Add a new device.'}</Text>
        </Box>
        <TabBar underlined={true}>
          <TabBarItem
            selected={this.props.mode === codePageModeShowText}
            label='Display Code'
            onClick={() => { this.props.setCodePageMode(codePageModeEnterText) }}>
              {this.renderShowText()}
          </TabBarItem>
          <TabBarItem
            label='Type Code'
            selected={this.props.mode === codePageModeEnterText}
            onClick={() => { this.props.setCodePageMode(codePageModeShowText) }}>
              {this.renderEnterText()}
          </TabBarItem>
        </TabBar>
      </Container>
    )
  }

  render () {
    switch (this.props.mode) {
    case codePageModeShowCode:
    case codePageModeScanCode:
      return this.renderQRCode()
    case codePageModeShowText:
    case codePageModeEnterText:
      return this.renderTextCode()
    }
  }
}

const stylesContainer = {
  ...globalStyles.flexBoxColumn,
  flex: 1,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
}

const stylesIntro = {
  marginTop: 55,
  alignItems: 'center',
  marginBottom: 30,
}

const stylesEnterText = {
  marginTop: 10,
  padding: 20,
}

const stylesShowText = {
  marginTop: 20,
  padding: 32,
}

const stylesTextCode = {
  ...globalStyles.selectable,
  ...globalStyles.fontTerminal,
  color: globalColors.darkBlue,
}

const stylesScan = NativeStyleSheet.create({
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
