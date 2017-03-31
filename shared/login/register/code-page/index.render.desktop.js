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
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

const SubTitle = ({usePhone}) => (
  <p>
    <Text type='Body'>In the Keybase app on your {usePhone ? 'phone' : 'computer'}, go to</Text>
    <Icon type='iconfont-identity-devices' style={{color: globalColors.black_75, paddingLeft: globalMargins.xtiny, paddingRight: globalMargins.xtiny}} />
    <Text type='Body'>Devices > Add a new device.</Text>
  </p>
)

const CodePageText = ({onBack, textCode}) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type='Header' style={{marginTop: 60}}>Type in text code</Text>
    <p style={{marginTop: 10}}>
      <Text type='Body'>Run&nbsp;</Text><Text type='TerminalInline'>keybase device add</Text><Text type='Body'>&nbsp;on your other device and type this code there: </Text>
    </p>
    <Icon type='icon-computer-text-code-48' style={{marginTop: 28}} />
    <Text type='Body' style={stylesPaperkey}>{textCode}</Text>
  </Container>
)

const CodePageCode = ({onBack, otherDeviceRole, setCodePageMode, qrCode}) => (
  <Container
    style={{...stylesContainer, alignItems: 'stretch'}}
    onBack={onBack}>
    <div style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, overflowY: 'auto'}}>
      <Text style={{marginBottom: 11, marginTop: 38}} type='Header'>Scan this QR code</Text>
      <SubTitle usePhone={_otherIsPhone(otherDeviceRole)} />
      <div style={stylesQrContainer}>
        <div style={{background: `url("${qrCode}")`, ...stylesQr}} />
      </div>
      <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => setCodePageMode(codePageModeShowText)}>
        <Icon style={{marginRight: globalMargins.xtiny}} type='icon-phone-text-code-32' />
        <Text type='BodyPrimaryLink'>Show text code instead</Text>
      </p>
    </div>
  </Container>
)

const CodePageEnterText = ({onBack, otherDeviceRole, enterText, onChangeText, textEntered, setCodePageMode}) => (
  <Container
    style={stylesContainer}
    onBack={onBack}>
    <Text style={{marginBottom: 11, marginTop: 38}} type='Header'>Type in text code</Text>
    <SubTitle usePhone={_otherIsPhone(otherDeviceRole)} />
    <Icon style={{marginBottom: 40, marginTop: 30}} type='icon-phone-text-code-32' />
    <Input
      hintText='opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas'
      floatingHintTextOverride='Text code'
      multiline={true}
      value={enterText}
      onChangeText={onChangeText}
    />
    <Button
      type='Primary'
      style={{alignSelf: 'center', marginBottom: globalMargins.large, marginTop: globalMargins.large}}
      label='Continue'
      onClick={() => textEntered(codePageModeEnterText)} />
    {_otherIsPhone(otherDeviceRole) && <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => setCodePageMode(codePageModeShowCode)}>
      <Icon style={{marginRight: globalMargins.xtiny}} type='icon-phone-qr-code-32' />
      <Text type='BodyPrimaryLink' onClick={() => setCodePageMode(codePageModeShowCode)}>Scan QR code instead</Text>
    </p>
    }
  </Container>
)

function _otherIsPhone (otherDeviceRole) {
  return [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone].indexOf(otherDeviceRole) !== -1
}

class CodePageRender extends Component<void, Props, void> {
  render () {
    switch (this.props.mode) {
      case codePageModeShowCode:
        return <CodePageCode {...this.props} />
      case codePageModeEnterText:
        return <CodePageEnterText {...this.props} />
      case codePageModeShowText:
        return <CodePageText {...this.props} />
    }
    console.warn(`No mode prop passed! Mode: ${this.props.mode}`)
    return (<div />)
  }
}

const stylesContainer = {
  alignItems: 'center',
  flex: 1,
}
const stylesPaperkey = {
  ...getStyle('Header', 'Normal'),
  ...globalStyles.fontTerminal,
  ...globalStyles.selectable,
  color: globalColors.darkBlue,
  display: 'inline-block',
  lineHeight: '20px',
  marginTop: 30,
  maxWidth: 460,
  textAlign: 'center',
}
const stylesQrContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.blue2,
  marginBottom: 47,
  marginLeft: -65,
  marginRight: -65,
  marginTop: 35,
  minHeight: 220,
  minWidth: 220,
  padding: 15,
}
const stylesQr = {
  backgroundPosition: '-22px -22px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '234px 234px',
  height: 190,
  imageRendering: 'pixelated',
  width: 190,
}

export default CodePageRender
