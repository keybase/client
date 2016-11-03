// @flow
import React, {Component} from 'react'
import {Alert, Clipboard, Image} from 'react-native'
import {connect} from 'react-redux'
import {Box, Button, Text} from '../common-adapters'
import {globalStyles, globalColors, globalMargins} from '../styles'

import PushNotification from 'react-native-push-notification'
import {PushNotificationIOS} from 'react-native'

import {pushPermissionsRequest, pushToken} from '../actions/settings'

import type {Props} from './configure'

class ConfigurePush extends Component<void, Props, void> {

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
        this.props.onRequestPermissions()
      } else {
        // This triggers a token registration, onRegister => onPushToken
        PushNotification.requestPermissions()
      }
    })
  }

  render () {
    return null
  }
}

export default connect(
  (state: any, ownProps) => {
    return ({})
  },
  (dispatch: any) => {
    return {
      onRequestPermissions: () => {
        dispatch(pushPermissionsRequest('requestPermissions'))
      },
      onPushToken: (token, tokenType) => {
        Clipboard.setString(token)
        Alert.alert('Registered push token (saved to clipboard):', token)
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
)(ConfigurePush)
