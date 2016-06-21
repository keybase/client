/* @flow */
/* eslint-disable react/prop-types */

import React, {Component} from 'react'
import {globalColors, globalStyles} from '../../styles/style-guide'
import {Text, Icon, Button, Box} from '../../common-adapters'

import type {IntroProps} from './intro.render'

export default class Intro extends Component<void, IntroProps, void> {
  render () {
    return (
      <Box style={{...stylesLoginForm, marginTop: this.props.justRevokedSelf ? 0 : 45}}>
        {!!this.props.justRevokedSelf && <Box style={stylesRevoked}>
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>{this.props.justRevokedSelf}</Text>
          <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text>
        </Box>}
        <Icon type='logo-160' />
        <Text style={stylesHeader} type='HeaderJumbo'>Join Keybase</Text>
        <Text style={stylesHeaderSub} type='Body'>Public key crypto for everyone</Text>
        <Button style={stylesButton} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Text style={stylesLoginHeader} type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text>
        <Text type='BodyPrimaryLink' onClick={this.props.onLogin}>Log in</Text>
      </Box>
    )
  }
}

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  marginTop: 95,
  flex: 1,
}
const stylesHeader = {
  marginTop: 27,
  color: globalColors.orange,
}
const stylesHeaderSub = {
  marginTop: 3,
}
const stylesLoginHeader = {
  marginTop: 91,
  textAlign: 'center',
}
const stylesButton = {
  marginTop: 15,
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
