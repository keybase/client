// @flow
import React, {Component} from 'react'
import {
  Box,
  Button,
  ButtonBar,
  Icon,
  Text,
  NativeScrollView,
  HOCTimers,
  type PropsWithTimer,
} from '../../common-adapters/mobile.native'
import {globalColors, globalStyles, globalMargins} from '../../styles'

import type {Props} from '.'

const Scroller = (props: any) => (
  <NativeScrollView style={{height: '100%', width: '100%'}}>{props.children}</NativeScrollView>
)

const Failure = (props: Props) => (
  <Scroller>
    <Box style={{...stylesLoginForm, justifyContent: 'center'}}>
      <Box style={stylesBannerRed}>
        <Text type="BodySemibold" style={stylesTextBanner}>
          Oops, we had a problem communicating with our services. This might be because you lost connectivity.
        </Text>
      </Box>
      <Box
        style={{...globalStyles.flexBoxColumn, flexGrow: 1, justifyContent: 'center', alignItems: 'center'}}
      >
        <Icon type="" />
        <Box style={globalStyles.flexBoxRow}>
          <Button
            type="Primary"
            label="Reload"
            onClick={props.onRetry}
            style={{marginTop: globalMargins.xlarge}}
          />
          <Button
            type="Secondary"
            label="Send us feedback"
            onClick={props.onFeedback}
            style={{marginLeft: globalMargins.small, marginTop: globalMargins.xlarge}}
          />
        </Box>
      </Box>
    </Box>
  </Scroller>
)

const Intro = (props: Props) => (
  <Scroller>
    <Box
      style={{
        ...stylesLoginForm,
        ...globalStyles.flexBoxColumn,
        justifyContent: 'center',
      }}
    >
      {!!props.justRevokedSelf && (
        <Box style={stylesBannerGreen}>
          <Text type="BodySemibold" style={stylesTextBanner}>
            <Text type="BodySemiboldItalic" style={stylesTextBanner}>
              {props.justRevokedSelf}
            </Text>
            &nbsp;was revoked successfully.
          </Text>
        </Box>
      )}
      {!!props.justDeletedSelf && (
        <Box style={stylesBannerBlue}>
          <Text type="BodySemibold" style={stylesTextBanner}>
            Your Keybase account{' '}
            <Text type="BodySemiboldItalic" style={stylesTextBanner}>
              {props.justDeletedSelf}
            </Text>
            &nbsp;has been deleted.
          </Text>
        </Box>
      )}
      {!!props.justLoginFromRevokedDevice && (
        <Box style={stylesBannerBlue}>
          <Text type="BodySemibold" style={stylesTextBanner}>
            Your device has been revoked, please log in again.
          </Text>
        </Box>
      )}
      <Box
        style={{
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 55,
          width: '100%',
        }}
      >
        <Icon type="icon-keybase-logo-80" />
        <Text style={stylesHeader} type="HeaderBig">
          Join Keybase
        </Text>
        <Text style={stylesHeaderSub} type="Body">
          Folders for anyone in the world.
        </Text>
        <Button
          style={stylesSignupButton}
          type="Primary"
          onClick={props.onSignup}
          label="Create an account"
        />
        <Box style={{minHeight: 100, width: 1}} />
        <Text style={stylesLoginHeader} type="Body" onClick={props.onLogin}>
          Already on Keybase?
        </Text>
        <ButtonBar>
          <Button type="Secondary" onClick={props.onLogin} label="Log in" />
        </ButtonBar>
        <Text style={stylesFeedback} type="BodySmallSecondaryLink" onClick={props.onFeedback}>
          Problems logging in?
        </Text>
      </Box>
    </Box>
  </Scroller>
)

const stylesFeedback = {
  alignSelf: 'center',
  margin: globalMargins.tiny,
}

const stylesLoginForm = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
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
  textAlign: 'center',
}

const stylesSignupButton = {
  marginTop: globalMargins.medium,
}

const stylesBannerBlue = {
  ...globalStyles.flexBoxRow,
  alignItems: 'center',
  alignSelf: 'stretch',
  backgroundColor: globalColors.blue,
  justifyContent: 'center',
  minHeight: 40,
  paddingBottom: globalMargins.tiny,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  paddingTop: globalMargins.tiny,
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
  textAlign: 'center',
}

export {Intro, Failure, Splash}
