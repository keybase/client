// @flow
import React, {Component} from 'react'
import {Clipboard, Image, PushNotificationIOS, NativeModules} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'
import * as PushNotifications from 'react-native-push-notification'
import {permissionsPrompt, permissionsRequest, pushNotification, pushToken} from '../actions/push'

import type {Props} from './push'
import * as Constants from '../constants/push'
import type {TokenType} from '../constants/push'

const nativeBridge = NativeModules.KeybaseEngine || NativeModules.ObjcEngine

class Push extends Component<void, Props, void> {
  componentDidMount () {
    if (nativeBridge.usingSimulator === '1') {
      console.log('Skipping push config due to simulator')
      return
    }
    this.configurePush()
  }

  configurePush () {
    PushNotifications.configure({
      onRegister: (token) => {
        let tokenType: ?TokenType
        switch (token.os) {
          case 'ios': tokenType = Constants.tokenTypeApple; break
          case 'android': tokenType = Constants.tokenTypeAndroidPlay; break
        }
        if (tokenType) {
          this.props.onPushToken(token.token, tokenType)
        } else {
          this.props.onPushRegistrationError(new Error('Unrecognized os for token:', token))
        }
      },
      onNotification: (notification) => this.props.onPushNotification(notification),
      onError: (err) => this.props.onPushError(err),
      // Don't request permissions now, we'll ask later, after showing UI
      requestPermissions: false,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', (err) => {
      this.props.onPushRegistrationError(err)
    })

    console.log('Check push permissions')
    PushNotifications.checkPermissions(permissions => {
      console.log('Push checked permissions:', permissions)
      if (!permissions.alert) {
        // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
        // in which case we should not show prompt or show different prompt about enabling
        // in Settings (for iOS)
        this.props.onShowPrompt()
      } else {
        // We have permissions, this triggers a token registration in
        // case it changed.
        this.props.onRequestPermissions()
      }
    })
  }

  render () {
    if (!this.props.prompt) {
      return null
    }
    return (
      <Box style={{...globalStyles.flexBoxColumn, ...modal, flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: globalColors.white}}>
        <Box style={{...globalStyles.flexBoxColumn, alignItems: 'stretch', margin: globalMargins.small}}>

          <Box style={{marginLeft: 8, marginRight: 8, marginTop: 40}}>
            <Text type='Header' style={{textAlign: 'center'}}>
              Please turn on notifications!
            </Text>

            {/* The image is wider and will stretch the parent flex box, so we'll
               position absolute, and then specify a "filler" height. */}
            <Box style={{marginTop: 41}} />
            <Image
              style={{position: 'absolute', left: 10}}
              source={require('../images/illustrations/illustration-turn-on-notifications-527-x-294.png')}
              />
            <Box style={{height: 294, marginBottom: 23}} />

            <Text type='BodySemibold' style={{textAlign: 'center'}}>It''s <Text type='BodySemiboldItalic'>very</Text> important you enable notifications.</Text>
            <Text type='Body' style={{textAlign: 'center', marginTop: 20}}>
                This phone may need to perform crypto for you, which the Keybase servers cannot do. For example, if you provision a new device, this phone will be contacted.
            </Text>
          </Box>
          <Box style={{marginTop: 24, flex: 1}}>
            <Button type='Primary' onClick={() => this.props.onRequestPermissions()} label='Got it' waiting={this.props.permissionsRequesting} />
          </Box>
        </Box>
      </Box>
    )
  }
}

const modal = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
}

export default connect(
  (state: any) => {
    const {permissionsRequesting} = state.push
    return ({
      permissionsRequesting,
    })
  },
  (dispatch: any) => {
    return {
      onRequestPermissions: () => {
        dispatch(permissionsRequest())
      },
      onShowPrompt: () => {
        console.log('Showing push prompt')
        dispatch(permissionsPrompt(true))
      },
      onPushToken: (token: string, tokenType: TokenType) => {
        Clipboard.setString(token)
        console.warn('Registered push token (saved to clipboard):', token, tokenType)
        dispatch(pushToken(token, tokenType))
      },
      onPushNotification: (notification) => {
        dispatch(pushNotification(notification))
      },
      onPushRegistrationError: (err) => {
        console.warn('Push registration error:', err)
        dispatch(permissionsPrompt(false))
      },
      onPushError: (err) => {
        console.warn('Push notification error:', err)
      },
    }
  }
)(Push)
