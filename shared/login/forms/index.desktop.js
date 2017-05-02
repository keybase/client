// @flow
import React from 'react'
import {Text, Icon, Button, Box} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const Splash = (props: Props) => (
  <Box style={stylesLoginForm}>
    <Icon type='icon-keybase-logo-128' />
    <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
    <Text style={stylesHeaderSub} type='BodySmall'>Loading…{props.retrying ? ' (still trying)' : ''}</Text>
  </Box>
)

const Failure = (props: Props) => (
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
      onClick={props.onRetry} />
  </Box>
)

const Intro = (props: Props) => (
  <Box style={{...stylesLoginForm, marginTop: props.justRevokedSelf || props.justDeletedSelf || props.justLoginFromRevokedDevice ? 0 : 45}}>
    {!!props.justRevokedSelf && <Box style={stylesRevoked}>
      <Text type='BodySemibold' style={{color: globalColors.white}}>{props.justRevokedSelf}</Text>
      <Text type='BodySemibold' style={{color: globalColors.white}}>&nbsp;was revoked successfully</Text>
    </Box>}
    {!!props.justDeletedSelf && <Box style={stylesRevoked}>
      <Text type='BodySemibold' style={{color: globalColors.white}}>Your Keybase account "{props.justDeletedSelf}" has been deleted. Au revoir!</Text>
    </Box>}
    {!!props.justLoginFromRevokedDevice && <Box style={{...stylesRevoked, backgroundColor: globalColors.blue}}>
      <Text type='BodySemibold' style={{color: globalColors.white}}>has been revoked, please log in again.</Text>
    </Box>}
    <Icon type='icon-keybase-logo-128' />
    <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
    <Text style={stylesHeaderSub} type='BodySemibold'>Public key crypto for everyone</Text>
    <Button style={stylesButton} type='Primary' onClick={props.onSignup} label='Create an account' />
    <Box style={stylesFooter}>
      <Text type='Body' onClick={props.onLogin}>Already on Keybase?</Text><br />
      <Text type='BodyPrimaryLink' onClick={props.onLogin}>Log in</Text>
    </Box>
  </Box>
)

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'center',
  marginTop: 20,
}
const stylesHeader = {
  color: globalColors.orange,
  marginTop: 27,
}
const stylesHeaderSub = {
  marginTop: globalMargins.xtiny,
}
const stylesMessage = {
  marginBottom: globalMargins.large,
  marginLeft: globalMargins.large,
  marginRight: globalMargins.large,
  marginTop: globalMargins.small,
  textAlign: 'center',
}
const stylesButton = {
  marginTop: globalMargins.medium,
}
const stylesFooter = {
  marginBottom: 15,
  marginTop: 91,
  textAlign: 'center',
}
const stylesRevoked = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.green,
  color: globalColors.white,
  height: 45,
  justifyContent: 'center',
  marginBottom: 40,
}

export {
  Intro,
  Failure,
  Splash,
}
