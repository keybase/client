// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../../../styles/style-guide'
import {Text, Icon, Input, Button} from '../../../common-adapters'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

const subTitle = () => (
  <p>
    <Text type='BodySmall'>In the Keybase app on your phone, go to</Text>
    <Icon type='fa-mobile' style={styles.phoneIcon} />
    <Text type='BodySmall'>Devices > Add a new device.</Text>
  </p>
)

export default class CodePageRender extends Component {
  props: Props;

  renderText () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <h1>Type this verification code into your other device</h1>
        <p style={{backgroundColor: 'grey', padding: 20, marginTop: 20}}>{this.props.textCode}</p>
      </div>
    )
  }

  renderCode () {
    const qr = {
      background: `url("${this.props.qrCode}")`
    }

    return (
      <Container
        style={styles.container}
        onBack={this.props.onBack}>
        <Text style={{marginTop: 38, marginBottom: 11}} type='Header'>Scan this QR code</Text>
        {subTitle()}
        <div style={styles.qrContainer}>
          <div style={{...qr, ...styles.qr}} />
        </div>
        <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>
          <Icon style={{marginRight: 15}} type='phone-text-code-small' />
          <Text type='BodyPrimaryLink' onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>Type text code instead</Text>
        </p>
      </Container>
    )
  }

  renderEnterText () {
    return (
      <Container
        style={styles.container}
        onBack={this.props.onBack}>
        <Text style={{marginTop: 38, marginBottom: 11}} type='Header'>Type in text code</Text>
        {subTitle()}

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
        return this.renderCode()
      case codePageModeEnterText:
        return this.renderEnterText()
      case codePageModeShowText:
        return this.renderText()
    }
    return (<div/>)
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
  enterText: React.PropTypes.string
}

const styles = {
  container: {
    flex: 1,
    alignItems: 'center'
  },
  qrContainer: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    marginTop: 35,
    marginBottom: 47,
    padding: 15,
    alignSelf: 'stretch',
    marginLeft: -65,
    marginRight: -65,
    backgroundColor: globalColors.blue2
  },
  qr: {
    width: 190,
    height: 190,
    backgroundPosition: '-22px -22px',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '234px 234px',
    imageRendering: 'pixelated'
  },
  phoneIcon: {
    fontSize: 30,
    marginRight: 25,
    transform: 'rotate(-325deg) translateX(18px)'
  }
}
