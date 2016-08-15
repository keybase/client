// @flow
import React, {Component} from 'react'
import type {IntroProps} from './intro.render'
import {Text, Icon, Button, Box} from '../../common-adapters'
import {globalColors, globalStyles} from '../../styles/style-guide'

class Intro extends Component<void, IntroProps, void> {

  _renderSplash () {
    return (
      <Box style={stylesLoginForm}>
        <Icon type='icon-keybase-logo-160' />
        <Text style={stylesHeader} type='HeaderJumbo'>Keybase</Text>
        <Text style={stylesHeaderSub} type='Body'>Loading…</Text>
      </Box>
    )
  }

  _render () {
    return (
      <Box style={{...stylesLoginForm, marginTop: this.props.justRevokedSelf || this.props.justLoginFromRevokedDevice ? 0 : 45}}>
        {!!this.props.justRevokedSelf && <Box style={stylesRevoked}>
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>{this.props.justRevokedSelf}</Text>
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text>
        </Box>}
        {!!this.props.justLoginFromRevokedDevice && <Box style={stylesRevoked}>
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>This device has been revoked, please log in again.</Text>
        </Box>}
        <Icon type='icon-keybase-logo-160' />
        <Text style={stylesHeader} type='HeaderJumbo'>Join Keybase</Text>
        <Text style={stylesHeaderSub} type='Body'>Public key crypto for everyone</Text>
        <Button style={stylesButton} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Box style={stylesFooter}>
          <Text type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text><br />
          <Text type='BodyPrimaryLink' onClick={this.props.onLogin}>Log in</Text>
        </Box>
      </Box>
    )
  }

  render () {
    if (!this.props.loaded) {
      return this._renderSplash()
    }
    return this._render()
  }
}

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 20,
  flex: 1,
}
const stylesHeader = {
  marginTop: 27,
  color: globalColors.orange,
}
const stylesHeaderSub = {
  marginTop: 3,
}
const stylesButton = {
  marginTop: 15,
}
const stylesFooter = {
  marginTop: 91,
  textAlign: 'center',
  marginBottom: 15,
}
const stylesRevoked = {
  ...globalStyles.flexBoxRow,
  height: 45,
  marginBottom: 40,
  color: globalColors.white,
  justifyContent: 'center',
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.green,
}

export default Intro
