// @flow
import React from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const Splash = () => (
  <Box style={stylesLoginForm}>
    <Icon type='icon-keybase-logo-128' />
    <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
    <Text style={stylesHeaderSub} type='BodySmall'>Loading…</Text>
  </Box>
)

const Failure = (props: Props) => (
  <Box style={stylesLoginForm}>
    <Icon type='icon-keybase-logo-128' />
    <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
    <Text style={stylesMessage} type='Body'>
      <Text style={stylesMessage} type='Body'>
        Oops, we had a problem communicating with our services.
      </Text>
      <Text style={stylesMessage} type='Body'>
        This might be because you lost connectivity.
      </Text>
    </Text>
    <Button
      type='Primary'
      label='Reload'
      onClick={props.onRetry} />
  </Box>
)

const Intro = (props: Props) => (
  <Box style={{...stylesLoginForm, marginTop: props.justRevokedSelf || props.justDeletedSelf ? 0 : 55}}>
    {!!props.justRevokedSelf &&
      <Text type='BodySemiboldItalic' style={{...stylesRevoked}}>{props.justRevokedSelf}<Text type='BodySemiboldItalic' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text></Text>
    }
    {!!props.justDeletedSelf &&
      <Text type='BodySemiboldItalic' style={{...stylesRevoked}}>Your Keybase account "{props.justDeletedSelf}" has been deleted. Au revoir!</Text>
    }
    {!!props.justLoginFromRevokedDevice &&
      <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>has been revoked, please log in again.</Text>
    }
    <Icon type='icon-keybase-logo-128' />
    <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
    <Text style={stylesHeaderSub} type='Body'>Folders for anyone in the world.</Text>
    <Button style={stylesButton} type='Primary' onClick={props.onSignup} label='Create an account' />
    <Text style={stylesLoginHeader} type='Body' onClick={props.onLogin}>Already on Keybase?</Text>
    <Button style={stylesButton} type='Secondary' onClick={props.onLogin} label='Log in' />
  </Box>
)

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
}
const stylesHeader = {
  color: globalColors.orange,
  marginTop: 27,
}
const stylesMessage = {
  marginBottom: globalMargins.large,
  marginLeft: globalMargins.large,
  marginRight: globalMargins.large,
  marginTop: globalMargins.small,
  textAlign: 'center',
}
const stylesHeaderSub = {
  marginTop: 10,
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
  alignSelf: 'stretch',
  backgroundColor: globalColors.green,
  color: globalColors.white,
  marginBottom: 40,
  marginTop: 20,
  paddingBottom: 14,
  paddingLeft: 15,
  paddingRight: 15,
  paddingTop: 14,
  textAlign: 'center',
}

export {
  Intro,
  Failure,
  Splash,
}
