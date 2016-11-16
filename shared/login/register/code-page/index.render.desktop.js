// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import Container from '../../forms/container.desktop'
import React, {Component} from 'react'
import type {Props} from './index.render'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
  codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import {globalStyles, globalColors} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

const SubTitle = ({usePhone}) => (
  <p>
    <Text type='BodySmall'>In the Keybase app on your {usePhone ? 'phone' : 'computer'}, go to</Text>
    <Icon type='iconfont-identity-devices' />
    <Text type='BodySmall'>Devices > Add a new device.</Text>
  </p>
)

class CodePageRender extends Component<void, Props, void> {
  _renderText () {
    return (
      <Container
        style={stylesContainer}
        onBack={this.props.onBack}>

        <Text type='Header' style={{marginTop: 60}}>Type in text code</Text>
        <p style={{marginTop: 10}}>
          <Text type='BodySmall'>Run&nbsp;</Text><Text type='Terminal'>keybase device add</Text><Text type='BodySmall'>&nbsp;on your other device and type this code there: </Text>
        </p>
        <Icon type='icon-computer-bw-48' style={{marginTop: 28}} />

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
        <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeShowText)}>
          <Icon style={{marginRight: 15}} type='icon-phone-text-code-32' />
          <Text type='BodyPrimaryLink'>Show text code instead</Text>
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
        <Icon style={{marginTop: 30, marginBottom: 40}} type='icon-phone-text-code-32' />
        <Input
          hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
          floatingHintTextOverride='Text code'
          multiline={true}
          value={this.props.enterText}
          onChangeText={text => this.props.onChangeText(text)}
        />
        <Button type='Primary' style={{alignSelf: 'flex-end', marginTop: 35, marginBottom: 20}} label='Continue' onClick={() => this.props.textEntered(codePageModeEnterText)} />
        {this._otherIsPhone() && <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeShowCode)}>
          <Icon style={{marginRight: 15}} type='icon-phone-qr-code-48' />
          <Text type='BodyPrimaryLink' onClick={() => this.props.setCodePageMode(codePageModeShowCode)}>Scan QR code instead</Text>
        </p>
        }
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

const stylesContainer = {
  flex: 1,
  alignItems: 'center',
}
const stylesPaperkey = {
  ...getStyle('Header', 'Normal'),
  ...globalStyles.selectable,
  color: globalColors.darkBlue,
  display: 'inline-block',
  lineHeight: '24px',
  marginTop: 30,
  textAlign: 'center',
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

export default CodePageRender
