// @flow
/*
 * Screen to scan/show qrcode/text code. Goes into various modes with various options depending on if
 * you're a phone/computer and if you're the existing device or the new device
 */

import React, {Component} from 'react'
import {TextField, RaisedButton} from 'material-ui'
import {globalStyles, globalColorsDZ2} from '../../../styles/style-guide'
import {Text, Icon} from '../../../common-adapters'
import {codePageDeviceRoleExistingPhone, codePageDeviceRoleNewPhone,
        codePageDeviceRoleExistingComputer, codePageDeviceRoleNewComputer} from '../../../constants/login'
import {codePageModeShowCode, codePageModeEnterText, codePageModeShowText} from '../../../constants/login'
import Container from '../../forms/container.desktop'
import type {Props} from './index.render'

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
        <Text style={{marginTop: 38, marginBottom: 11}} dz2 type='Header'>Scan this QR code</Text>
        <p>
          <Text dz2 type='BodySmall'>In the Keybase app on your phone, go to</Text>
          <Icon dz2 type='fa-mobile' style={styles.phoneIcon} />
          <Text dz2 type='BodySmall'>Devices > Add a new device.</Text>
        </p>
        <div style={styles.qrContainer}>
          <div style={{...qr, ...styles.qr}} />
        </div>
        <p style={{...globalStyles.flexBoxRow, alignItems: 'flex-end'}} onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>
          <Icon style={{marginRight: 15}} type='phone-text-code-small' />
          <Text dz2 type='BodyPrimaryLink' onClick={() => this.props.setCodePageMode(codePageModeEnterText)}>Type text code instead</Text>
        </p>
      </Container>
    )
  }

  renderEnterText () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        <h1>Type the verification code from your other device into here</h1>
        <TextField
          hintText='Type code here'
          floatingLabelText='Code'
          value={this.props.enterText}
          multiLine
          onChange={event => this.props.onChangeText(event.target.value)}
        />
        <RaisedButton
          style={{alignSelf: 'flex-end', marginTop: 20}}
          label='Submit'
          primary
          onClick={() => this.props.textEntered(codePageModeEnterText)}
        />
      </div>
    )
  }

  // renderShowCodeAndEnterText () {
    // return (
      // <div style={{display: 'flex', flexDirection: 'row', flex: 1, backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
        // {this.renderCode()}
        // <div style={{display: 'flex', flexDirection: 'column', backgroundColor: 'green', alignItems: 'center', justifyContent: 'center', padding: 20}}>
          // <p>|</p>
          // <p>or</p>
          // <p>|</p>
        // </div>
        // {this.renderEnterText()}
      // </div>
    // )
  // }

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
    backgroundColor: globalColorsDZ2.blue2
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
    marginRight: 18,
    transform: 'rotate(-325deg) translateX(18px)'
  }
}
