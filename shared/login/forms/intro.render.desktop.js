// @flow
import React, {Component} from 'react'
import type {IntroProps} from './intro.render'
import {Text, Icon, Button, Box} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

class Intro extends Component<void, IntroProps, void> {

  _renderSplash () {
    return (
      <Box style={stylesLoginForm}>
        <Icon type='icon-keybase-logo-128' />
        <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
        <Text style={stylesHeaderSub} type='BodySmall'>Loading…</Text>
      </Box>
    )
  }

  _renderFailure () {
    return (
      <Box style={stylesLoginForm}>
        <Icon type='icon-keybase-logo-128' />
        <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
        <Text style={stylesMessage} type='Body'>
          Oops, we had a problem communicating with our services.<br />
          This might be because you lost connectivity.
        </Text>
        <Button
          type='Primary'
          label='Reload'
          onClick={() => this.props.onRetry()} />
      </Box>
    )
  }

  _render () {
    return (
      <Box style={{...stylesLoginForm, marginTop: this.props.justRevokedSelf || this.props.justDeletedSelf || this.props.justLoginFromRevokedDevice ? 0 : 45}}>
        {!!this.props.justRevokedSelf && <Box style={stylesRevoked}>
          <Text type='BodySemibold' style={{color: globalColors.white}}>{this.props.justRevokedSelf}</Text>
          <Text type='BodySemibold' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text>
        </Box>}
        {!!this.props.justDeletedSelf && <Box style={stylesRevoked}>
          <Text type='BodySemibold' style={{color: globalColors.white}}>Your Keybase account "{this.props.justDeletedSelf}" has been deleted. Au revoir!</Text>
        </Box>}
        {!!this.props.justLoginFromRevokedDevice && <Box style={{...stylesRevoked, backgroundColor: globalColors.blue}}>
          <Text type='BodySemibold' style={{color: globalColors.white}}>This device has been revoked, please log in again.</Text>
        </Box>}
        <Icon type='icon-keybase-logo-128' />
        <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
        <Text style={stylesHeaderSub} type='BodySemibold'>Public key crypto for everyone</Text>
        <Button style={stylesButton} type='Primary' onClick={this.props.onSignup} label='Create an account' />
        <Box style={stylesFooter}>
          <Text type='Body' onClick={this.props.onLogin}>Already on Keybase?</Text><br />
          <Text type='BodyPrimaryLink' onClick={this.props.onLogin}>Log in</Text>
        </Box>
      </Box>
    )
  }

  render () {
    console.log('bootStatus:', this.props.bootStatus)
    switch (this.props.bootStatus) {
      case 'bootStatusLoading':
        return this._renderSplash()
      case 'bootStatusFailure':
        return this._renderFailure()
      case 'bootStatusBootstrapped':
        return this._render()
    }
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
  marginTop: globalMargins.xtiny,
}
const stylesMessage = {
  marginTop: globalMargins.small,
  marginLeft: globalMargins.large,
  marginRight: globalMargins.large,
  marginBottom: globalMargins.large,
  textAlign: 'center',
}
const stylesButton = {
  marginTop: globalMargins.medium,
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
