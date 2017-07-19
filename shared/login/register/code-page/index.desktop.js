// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import Container from '../../forms/container.desktop'
import React, {Component} from 'react'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import {
  codePageDeviceRoleExistingPhone,
  codePageDeviceRoleNewPhone,
  codePageModeShowCode,
  codePageModeEnterText,
  codePageModeShowText,
} from '../../../constants/login'
import {globalStyles, globalColors, globalMargins} from '../../../styles'
import {getStyle} from '../../../common-adapters/text'

import type {Props} from '.'

const SubTitle = ({usePhone}) => (
  <p>
    {usePhone
      ? <Text type="Body">
          In the Keybase app on your phone, go to
          {' '}
          <Text type="BodySemibold">Settings > Devices > Add new...</Text>
        </Text>
      : <Text type="Body">
          In the Keybase app on your computer, go to <Text type="BodySemibold">Devices > Add new...</Text>
        </Text>}
  </p>
)

const DeviceIcon = ({usePhone}) => (
  <p>
    {usePhone
      ? <Icon type="icon-phone-text-code-48" style={{marginTop: globalMargins.medium}} />
      : <Icon type="icon-computer-text-code-48" style={{marginTop: globalMargins.medium}} />}
  </p>
)

const CodePageText = ({onBack, textCode, otherDeviceRole, setCodePageMode}) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text type="Header" style={{marginBottom: globalMargins.small, marginTop: globalMargins.large}}>
      Type in text code
    </Text>
    <SubTitle usePhone={_otherIsPhone(otherDeviceRole)} />
    <DeviceIcon usePhone={_otherIsPhone(otherDeviceRole)} />
    <Text type="Body" style={stylesPaperkey}>{textCode}</Text>
    {_otherIsPhone(otherDeviceRole) &&
      <p
        style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}}
        onClick={() => setCodePageMode(codePageModeShowCode)}
      >
        <Icon style={{marginRight: globalMargins.xtiny}} type="icon-phone-qr-code-32" />
        <Text type="BodyPrimaryLink" onClick={() => setCodePageMode(codePageModeShowCode)}>
          Scan QR code instead
        </Text>
      </p>}
  </Container>
)

const CodePageCode = ({onBack, otherDeviceRole, setCodePageMode, qrCode}) => (
  <Container style={{...stylesContainer, alignItems: 'stretch'}} onBack={onBack}>
    <div style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, overflowY: 'auto'}}>
      <Text style={{marginBottom: globalMargins.small, marginTop: globalMargins.large}} type="Header">
        Scan this QR code
      </Text>
      <SubTitle usePhone={_otherIsPhone(otherDeviceRole)} />
      <div style={stylesQrContainer}>
        <div style={{background: `url("${qrCode}")`, ...stylesQr}} />
      </div>
      <p
        style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}}
        onClick={() => setCodePageMode(codePageModeShowText)}
      >
        <Icon style={{marginRight: globalMargins.xtiny}} type="icon-phone-text-code-32" />
        <Text type="BodyPrimaryLink">Show text code instead</Text>
      </p>
    </div>
  </Container>
)

const CodePageEnterText = ({
  enterCodeErrorText,
  onBack,
  otherDeviceRole,
  enterText,
  onChangeText,
  textEntered,
  setCodePageMode,
}) => (
  <Container style={stylesContainer} onBack={onBack}>
    <Text style={{marginBottom: 11, marginTop: 38}} type="Header">Type in text code</Text>
    <SubTitle usePhone={_otherIsPhone(otherDeviceRole)} />
    <DeviceIcon usePhone={_otherIsPhone(otherDeviceRole)} />
    <Input
      errorText={enterCodeErrorText}
      hintText="opp blezzard tofi pando agg whi pany yaga jocket daubt bruwnstane hubit yas"
      floatingHintTextOverride="Text code"
      multiline={true}
      value={enterText}
      onChangeText={onChangeText}
    />
    <Button
      type="Primary"
      style={{alignSelf: 'center', marginBottom: globalMargins.large, marginTop: globalMargins.large}}
      label="Continue"
      onClick={() => textEntered(codePageModeEnterText)}
    />
    {_otherIsPhone(otherDeviceRole) &&
      <p
        style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}}
        onClick={() => setCodePageMode(codePageModeShowCode)}
      >
        <Icon style={{marginRight: globalMargins.xtiny}} type="icon-phone-qr-code-32" />
        <Text type="BodyPrimaryLink" onClick={() => setCodePageMode(codePageModeShowCode)}>
          Scan QR code instead
        </Text>
      </p>}
  </Container>
)

function _otherIsPhone(otherDeviceRole) {
  return [codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone].indexOf(otherDeviceRole) !== -1
}

class CodePage extends Component<void, Props, void> {
  render() {
    switch (this.props.mode) {
      case codePageModeShowCode:
        return <CodePageCode {...this.props} />
      case codePageModeEnterText:
        return <CodePageEnterText {...this.props} />
      case codePageModeShowText:
        return <CodePageText {...this.props} />
    }
    console.warn(`No mode prop passed! Mode: ${this.props.mode}`)
    return <div />
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
  marginBottom: globalMargins.xlarge,
  marginTop: globalMargins.medium,
  maxWidth: 460,
  textAlign: 'center',
}
const stylesQrContainer = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'stretch',
  marginBottom: globalMargins.large,
  marginTop: globalMargins.large,
  minHeight: 220,
  minWidth: 220,
  padding: globalMargins.small,
}
const stylesQr = {
  backgroundPosition: '-22px -22px',
  backgroundRepeat: 'no-repeat',
  backgroundSize: '234px 234px',
  height: 190,
  imageRendering: 'pixelated',
  width: 190,
}

export default CodePage
