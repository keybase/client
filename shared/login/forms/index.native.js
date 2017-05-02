// @flow
import React from 'react'
import {Box, Button, Icon, Text} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const Splash = (props: Props) => (
  <Box style={{...stylesLoginForm, justifyContent: 'center'}}>
    <Icon type='icon-keybase-logo-80' />
    <Text style={stylesHeader} type='HeaderBig'>Keybase</Text>
    <Box style={globalStyles.flexBoxColumn}>
      <Text style={{marginTop: globalMargins.large}} type='BodySmall'>
        Keybase not starting up?
      </Text>
      <Button
        label='Let us know'
        onClick={props.onFeedback}
        small={true}
        style={{marginTop: globalMargins.small}}
        type='Primary' />
    </Box>
  </Box>
)

const Failure = (props: Props) => (
  <Box style={{...stylesLoginForm, marginTop: 0}}>
    <Box style={{...stylesBannerRed}}><Text type='BodySemibold' style={stylesTextBanner}>Oops, we had a problem communicating with our services. This might be because you lost connectivity.</Text></Box>
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Icon type='icon-keybase-logo-logged-out-80' />
      <Box style={globalStyles.flexBoxRow}>
        <Button
          type='Primary'
          label='Reload'
          onClick={props.onRetry}
          style={{marginTop: globalMargins.xlarge}} />
        <Button
          type='Secondary'
          label='Send us feedback'
          onClick={props.onFeedback}
          style={{marginLeft: globalMargins.small, marginTop: globalMargins.xlarge}} />
      </Box>
    </Box>
  </Box>
)

const Intro = (props: Props) => (
  <Box style={{...stylesLoginForm, marginTop: props.justRevokedSelf || props.justDeletedSelf || props.justLoginFromRevokedDevice ? 0 : 55}}>
    {!!props.justRevokedSelf &&
      <Box style={{...stylesBannerGreen}}><Text type='BodySemibold' style={stylesTextBanner}><Text type='BodySemiboldItalic' style={stylesTextBanner}>{props.justRevokedSelf}</Text>&nbsp;was revoked successfully.</Text></Box>
    }
    {!!props.justDeletedSelf &&
      <Box style={{...stylesBannerBlue}}><Text type='BodySemibold' style={stylesTextBanner}>Your Keybase account <Text type='BodySemiboldItalic' style={stylesTextBanner}>{props.justDeletedSelf}</Text>&nbsp;has been deleted.</Text></Box>
    }
    {!!props.justLoginFromRevokedDevice &&
      <Box style={{...stylesBannerBlue}}><Text type='BodySemibold' style={stylesTextBanner}>Your device has been revoked, please log in again.</Text></Box>
    }
    <Box style={{...globalStyles.flexBoxColumn, flex: 1, justifyContent: 'center', alignItems: 'center'}}>
      <Icon type='icon-keybase-logo-80' />
      <Text style={stylesHeader} type='HeaderBig'>Join Keybase</Text>
      <Text style={stylesHeaderSub} type='Body'>Folders for anyone in the world.</Text>
      <Button style={stylesButton} type='Primary' onClick={props.onSignup} label='Create an account' />
      <Text style={stylesLoginHeader} type='Body' onClick={props.onLogin}>Already on Keybase?</Text>
      <Text type='BodyBigLink' style={{marginTop: globalMargins.tiny}} onClick={props.onLogin}>Log in</Text>
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
  marginTop: globalMargins.small,
}

const stylesHeaderSub = {
  marginTop: globalMargins.tiny,
}
const stylesLoginHeader = {
  marginTop: 176,
  textAlign: 'center',
}
const stylesButton = {
  marginTop: globalMargins.medium,
}

const stylesBannerBlue = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  marginBottom: 40,
  marginTop: 20,
  minHeight: 40,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
  textAlign: 'center',
}

const stylesBannerGreen = {
  ...stylesBannerBlue,
  backgroundColor: globalColors.green,
}

const stylesBannerRed = {
  ...stylesBannerBlue,
  backgroundColor: globalColors.red,
}

const stylesTextBanner = {
  color: globalColors.white,
}

export {
  Intro,
  Failure,
  Splash,
}
