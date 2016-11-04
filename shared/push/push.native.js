// @flow
import React, {Component} from 'react'
import {Alert, Clipboard, Image, PushNotificationIOS} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import PushNotification from 'react-native-push-notification'
import {pushPermissionsPrompt, pushPermissionsRequest, pushToken} from '../actions/settings'

import type {Props} from './push'

class Push extends Component<void, Props, void> {

  componentDidMount () {
    this.configurePush()
  }

  configurePush () {
    PushNotification.configure({
      onRegister: (token) => this.props.onPushToken(token.token, token.os),
      onNotification: (notification) => this.props.onPushNotification(notification),
      onError: (err) => this.props.onPushError(err),
      // Don't request permissions now, we'll ask later, after showing UI
      requestPermissions: false,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', (err) => {
      this.props.onPushError(err)
    })

    PushNotification.checkPermissions(permissions => {
      console.log('Push checked permissions:', permissions)
      if (!permissions.alert) {
        // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
        // in which case we should not show prompt or show different prompt about enabling
        // in Settings (for iOS)
        console.log('Showing push permissions prompt')
        this.props.onShowPrompt()
      } else {
        // We have permissions, this triggers a token registration in
        // case it changed.
        PushNotification.requestPermissions()
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
  (state: any, ownProps) => {
    const {permissionsRequesting} = state.settings.push
    return ({
      permissionsRequesting,
    })
  },
  (dispatch: any) => {
    return {
      onRequestPermissions: () => {
        dispatch(pushPermissionsRequest())
      },
      onShowPrompt: () => {
        console.log('Showing push prompt')
        dispatch(pushPermissionsPrompt(true))
      },
      onPushToken: (token, tokenType) => {
        Clipboard.setString(token)
        console.warn('Registered push token (saved to clipboard):', token, tokenType)
        dispatch(pushToken(token, tokenType))
      },
      onPushNotification: (notification) => {
        // TODO(gabriel): Craft notification for  app
        Alert.alert('Push notification', notification.message)
      },
      onPushError: (err) => {
        console.warn('Push notification error:', err)
      },
    }
  }
)(Push)
