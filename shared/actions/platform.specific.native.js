// @flow
import * as PushNotifications from 'react-native-push-notification'
import {PushNotificationIOS, CameraRoll, ActionSheetIOS} from 'react-native'
import * as PushConstants from '../constants/push'
import {eventChannel} from 'redux-saga'
import {isIOS} from '../constants/platform'
import {isDevApplePushToken} from '../local-debug'

function requestPushPermissions (): Promise<*> {
  return PushNotifications.requestPermissions()
}

function showMainWindow () {
  return () => {
    // nothing
  }
}

function showShareActionSheet (options: {url?: ?any, message?: ?any}): Promise<{completed: boolean, method: string}> {
  if (isIOS) {
    return new Promise((resolve, reject) => ActionSheetIOS.showShareActionSheetWithOptions(
      options,
      reject,
      resolve,
    ))
  } else {
    console.warn('Sharing action not implemented in android')
    return Promise.resolve({completed: false, method: ''})
  }
}

type NextURI = string
function saveAttachment (filePath: string): Promise<NextURI> {
  return CameraRoll.saveToCameraRoll(filePath)
}

function configurePush () {
  return eventChannel(emitter => {
    PushNotifications.configure({
      onRegister: (token) => {
        let tokenType: ?PushConstants.TokenType
        switch (token.os) {
          case 'ios': tokenType = isDevApplePushToken ? PushConstants.tokenTypeAppleDev : PushConstants.tokenTypeApple; break
          case 'android': tokenType = PushConstants.tokenTypeAndroidPlay; break
        }
        if (tokenType) {
          emitter(({
            payload: {
              token: token.token,
              tokenType,
            },
            type: 'push:pushToken',
          }: PushConstants.PushTokenAction))
        } else {
          emitter(({
            payload: {
              error: new Error('Unrecognized os for token:', token),
            },
            type: 'push:registrationError',
          }: PushConstants.PushRegistrationError))
        }
      },
      senderID: PushConstants.androidSenderID,
      onNotification: (notification) => {
        emitter(({
          payload: notification,
          type: 'push:notification',
        }: PushConstants.PushNotificationAction))
      },
      onError: (error) => {
        emitter(({
          payload: {error},
          type: 'push:error',
        }: PushConstants.PushError))
      },
      // Don't request permissions for ios, we'll ask later, after showing UI
      requestPermissions: !isIOS,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', (error) => {
      emitter(({
        payload: {error},
        type: 'push:registrationError',
      }: PushConstants.PushRegistrationError))
    })

    console.log('Check push permissions')
    if (isIOS) {
      PushNotifications.checkPermissions(permissions => {
        console.log('Push checked permissions:', permissions)
        if (!permissions.alert) {
          // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
          // in which case we should not show prompt or show different prompt about enabling
          // in Settings (for iOS)
          emitter(({
            payload: true,
            type: 'push:permissionsPrompt',
            logTransformer: action => ({
              payload: action.payload,
              type: action.type,
            }),
          }: PushConstants.PushPermissionsPromptAction))
        } else {
          // We have permissions, this triggers a token registration in
          // case it changed.
          emitter(({
            payload: undefined,
            type: 'push:permissionsRequest',
          }: PushConstants.PushPermissionsRequestAction))
        }
      })
    }

    // TODO make some true unsubscribe function
    return () => {}
  })
}

export {
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachment,
  showShareActionSheet,
}
