// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import {specialStyles as textStyles} from '../../../common-adapters/text'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

const SubTitle = ({usePhone}) => (
  <p>
    <Text type='BodySmall'>In the Keybase app on your {usePhone ? 'phone' : 'computer'}, go to</Text>
    <Icon type='fa-mobile' style={stylesPhoneIcon} />
    <Text type='BodySmall'>Devices > Add a new device.</Text>
  </p>
)

export default class CodePageRender extends Component<void, Props, void> {
  _renderText () {
    return (
      <Container
        style={stylesContainer}
        onBack={this.props.onBack}>

        <Text type='Header' style={{marginTop: 60}}>Type in text code</Text>
        <p style={{marginTop: 10}}>
          <Text type='BodySmall' inline>Run&nbsp;</Text><Text type='TerminalSmall' inline>keybase device add</Text><Text type='BodySmall' inline>&nbsp;on your other device and type this code there: </Text>
        </p>
        <Icon type='computer-bw-m' style={{marginTop: 28}} />

        <Text type='Body' style={stylesPaperkey}>{this.props.textCode}</Text>
      </Container>
    )
  }

  _otherIsPhone () {
    return [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone].indexOf(this.props.otherDeviceRole) !== -1
  }

  _renderCode () {
    const qr = {
      background: `url("${this.props.qrCode}")`,
    }

    return (
      <Container
        style={stylesContainer}
        onBack={this.props.onBack}>
        <Text style={{marginTop: 38, marginBottom: 11}} type='Header'>Scan this QR code</Text>
        <SubTitle usePhone={this._otherIsPhone()} />
        <div style={stylesQrContainer}>
          <div style={{...qr, ...stylesQr}} />
        </div>
        <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>
          <Icon style={{marginRight: 15}} type='phone-text-code-small' />
          <Text type='BodyPrimaryLink' onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>Type text code instead</Text>
        </p>
      </Container>
    )
  }

  _renderEnterText () {
    return (
      <Container
        style={stylesContainer}
        onBack={this.props.onBack}>
        <Text style={{marginTop: 38, marginBottom: 11}} type='Header'>Type in text code</Text>
        <SubTitle usePhone={this._otherIsPhone()} />
        <Icon style={{marginTop: 30, marginBottom: 40}} type='phone-text-code' />
        <Input
          style={{alignSelf: 'stretch'}}
          hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
          floatingLabelText='Text code'
          multiLine
          value={this.props.enterText}
          onChange={event => this.props.onChangeText(event.target.value)}
        />
        <Button type='Primary' style={{alignSelf: 'flex-end', marginTop: 35, marginBottom: 20}} label='Continue' onClick={() => this.props.textEntered(codePageModeEnterText)} />
        <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeShowCode)}>
          <Icon style={{marginRight: 15}} type='phone-q-r-code' />
          <Text type='BodyPrimaryLink' onClick={() => this.props.setCodePageMode(codePageModeShowCode)}>Scan QR code instead</Text>
        </p>
      </Container>
    )
  }

  render () {
    switch (this.props.mode) {
      case codePageModeShowCode:
        return this._renderCode()
      case codePageModeEnterText:
        return this._renderEnterText()
      case codePageModeShowText:
        return this._renderText()
    }
    console.warn(`No mode prop passed! Mode: ${this.props.mode}`)
    return (<div />)
  }
}

const validRoles = [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone, codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer]

CodePageRender.propTypes = {
  mode: React.PropTypes.oneOf([codePageModeShowCode, codePageModeEnterText, codePageModeShowText]),
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
  onBack: React.PropTypes.func.isRequired,
  enterText: React.PropTypes.string,
}

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
}
const stylesPaperkey = {
  ...textStyles.paperKey,
  ...globalStyles.selectable,
  textAlign: 'center',
  marginTop: 30,
  display: 'inline-block',
}
const stylesQrContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginTop: 35,
  marginBottom: 47,
  padding: 15,
  alignSelf: 'stretch',
  marginLeft: -65,
  marginRight: -65,
  backgroundColor: globalColors.blue2,
}
const stylesQr = {
  width: 190,
  height: 190,
  backgroundPosition: '-22px -22px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '234px 234px',
  imageRendering: 'pixelated',
}
const stylesPhoneIcon = {
  fontSize: 30,
  marginRight: 25,
  transform: 'rotate(-325deg) translateX(18px)',
}
