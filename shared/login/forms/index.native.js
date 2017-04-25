// @flow
import React from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const Splash = () => (
  <Box style={stylesLoginForm}>
    <Icon type='icon-keybase-logo-80' />
    <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
    <Text style={{...stylesHeaderSub, marginTop: globalMargins.small}} type='BodySmall'>Loading…</Text>
  </Box>
)

const Failure = (props: Props) => (
  <Box style={stylesLoginForm}>
    <Icon type='icon-keybase-logo-80' />
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
  <Box style={{...stylesLoginForm, marginTop: props.justRevokedSelf || props.justDeletedSelf ? 0 : 128}}>
    {!!props.justRevokedSelf &&
      <Text type='BodySemibold' style={{...stylesRevoked}}><Text type='BodySemiboldItalic' style={{color: globalColors.white}}>{props.justRevokedSelf}</Text>&nbsp;was revoked successfully</Text>

    }
    {!!props.justDeletedSelf &&
      <Text type='BodySemibold' style={{...stylesDeleted}}>Your Keybase account <Text type='BodySemiboldItalic' style={{color: globalColors.white}}>{props.justDeletedSelf}</Text>&nbsp;has been deleted.</Text>

    }
    {!!props.justLoginFromRevokedDevice &&
      <Text type='BodySemibold' style={{color: globalColors.white}}>has been revoked, please log in again.</Text>
    }
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Icon type='icon-keybase-logo-80' />
      <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
      <Text style={stylesHeaderSub} type='Body'>Folders for anyone in the world.</Text>
      <Button style={stylesButton} type='Primary' onClick={props.onSignup} label='Create an account' />
      <Text style={stylesLoginHeader} type='Body' onClick={props.onLogin}>Already on Keybase?</Text>
      <Button style={stylesButton} type='Secondary' onClick={props.onLogin} label='Log in' />
    </Box>
  </Box>
)

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  flex: 1,
  justifyContent: 'flex-start',
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
  minHeight: 40,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  textAlign: 'center',
}

const stylesDeleted = {
  ...stylesRevoked,
  backgroundColor: globalColors.blue,
}

export {
  Intro,
  Failure,
  Splash,
}
