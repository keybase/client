// @flow
import * as PushNotifications from 'react-native-push-notification'
import {PushNotificationIOS, CameraRoll, ActionSheetIOS, AsyncStorage} from 'react-native'
import * as PushConstants from '../constants/push'
import {eventChannel} from 'redux-saga'
import {isIOS} from '../constants/platform'
import {isDevApplePushToken} from '../local-debug'
import {isImageFileName} from '../constants/chat'

function requestPushPermissions(): Promise<*> {
  return PushNotifications.requestPermissions()
}

function setNoPushPermissions(): Promise<*> {
  return new Promise((resolve, reject) => {
    AsyncStorage.setItem('allowPush', 'false', e => {
      resolve()
    })
  })
}

function showMainWindow() {
  return () => {
    // nothing
  }
}

function showShareActionSheet(options: {
  url?: ?any,
  message?: ?any,
}): Promise<{completed: boolean, method: string}> {
  if (isIOS) {
    return new Promise((resolve, reject) =>
      ActionSheetIOS.showShareActionSheetWithOptions(options, reject, resolve)
    )
  } else {
    console.warn('Sharing action not implemented in android')
    return Promise.resolve({completed: false, method: ''})
  }
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  console.log('saveAttachment: ', filePath)
  if (isIOS || isImageFileName(filePath)) {
    if (!isIOS) filePath = 'file://' + filePath
    console.log('Saving to camera roll: ', filePath)
    return CameraRoll.saveToCameraRoll(filePath)
  }
  console.log('Android: Leaving at ', filePath)
  return Promise.resolve(filePath)
}

function displayNewMessageNotification(text: string, convID: string, badgeCount: number, myMsgID: number) {
  // Dismiss any non-plaintext notifications for the same message ID
  if (isIOS) {
    PushNotificationIOS.getDeliveredNotifications(param => {
      PushNotificationIOS.removeDeliveredNotifications(
        param.filter(p => p.userInfo && p.userInfo.msgID === myMsgID).map(p => p.identifier)
      )
    })
  }

  PushNotifications.localNotification({
    message: text,
    soundName: 'keybasemessage.wav',
    userInfo: {
      convID: convID,
      type: 'chat.newmessage',
    },
    number: badgeCount,
  })
}

function configurePush() {
  return eventChannel(emitter => {
    PushNotifications.configure({
      onRegister: token => {
        let tokenType: ?PushConstants.TokenType
        switch (token.os) {
          case 'ios':
            tokenType = isDevApplePushToken ? PushConstants.tokenTypeAppleDev : PushConstants.tokenTypeApple
            break
          case 'android':
            tokenType = PushConstants.tokenTypeAndroidPlay
            break
        }
        if (tokenType) {
          emitter(
            ({
              payload: {
                token: token.token,
                tokenType,
              },
              type: 'push:pushToken',
            }: PushConstants.PushToken)
          )
        } else {
          emitter(
            ({
              payload: {
                error: new Error(`Unrecognized os for token: ${token}`),
              },
              type: 'push:registrationError',
            }: PushConstants.PushRegistrationError)
          )
        }
      },
      senderID: PushConstants.androidSenderID,
      onNotification: notification => {
        const merged = {
          ...notification,
          ...(notification.data || {}),
          data: undefined,
        }
        emitter(
          ({
            payload: merged,
            type: 'push:notification',
          }: PushConstants.PushNotificationAction)
        )
      },
      onError: error => {
        emitter(
          ({
            payload: {error},
            type: 'push:error',
          }: PushConstants.PushError)
        )
      },
      // Don't request permissions for ios, we'll ask later, after showing UI
      requestPermissions: !isIOS,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', error => {
      emitter(
        ({
          payload: {error},
          type: 'push:registrationError',
        }: PushConstants.PushRegistrationError)
      )
    })

    console.log('Check push permissions')
    if (isIOS) {
      AsyncStorage.getItem('allowPush', (error, result) => {
        if (error || result !== 'false') {
          PushNotifications.checkPermissions(permissions => {
            console.log('Push checked permissions:', permissions)
            if (!permissions.alert) {
              // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
              // in which case we should not show prompt or show different prompt about enabling
              // in Settings (for iOS)
              emitter(
                ({
                  payload: true,
                  type: 'push:permissionsPrompt',
                  logTransformer: action => ({
                    payload: action.payload,
                    type: action.type,
                  }),
                }: PushConstants.PushPermissionsPrompt)
              )
            } else {
              // We have permissions, this triggers a token registration in
              // case it changed.
              emitter(
                ({
                  payload: undefined,
                  type: 'push:permissionsRequest',
                }: PushConstants.PushPermissionsRequest)
              )
            }
          })
        }
      })
    }

    // TODO make some true unsubscribe function
    return () => {}
  })
}

export {
  displayNewMessageNotification,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachmentDialog,
  setNoPushPermissions,
  showShareActionSheet,
}
