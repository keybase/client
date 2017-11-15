// @flow
import logger from '../logger'
import * as PushTypes from '../constants/types/push'
import * as PushConstants from '../constants/push'
import * as PushGen from './push-gen'
import * as PushNotifications from 'react-native-push-notification'
import {PushNotificationIOS, CameraRoll, ActionSheetIOS, AsyncStorage} from 'react-native'
import {eventChannel} from 'redux-saga'
import {isDevApplePushToken} from '../local-debug'
import {isIOS} from '../constants/platform'
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
    logger.warn('Sharing action not implemented in android')
    return Promise.resolve({completed: false, method: ''})
  }
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  let goodPath = filePath
  logger.debug('saveAttachment: ', goodPath)
  if (isIOS || isImageFileName(goodPath)) {
    if (!isIOS) {
      goodPath = 'file://' + goodPath
    }
    logger.debug('Saving to camera roll: ', goodPath)
    return CameraRoll.saveToCameraRoll(goodPath)
  }
  logger.debug('Android: Leaving at ', goodPath)
  return Promise.resolve(goodPath)
}

function clearAllNotifications() {
  PushNotifications.cancelAllLocalNotifications()
}

function displayNewMessageNotification(text: string, convID: ?string, badgeCount: ?number, myMsgID: ?number) {
  // Dismiss any non-plaintext notifications for the same message ID
  if (isIOS) {
    PushNotificationIOS.getDeliveredNotifications(param => {
      PushNotificationIOS.removeDeliveredNotifications(
        param.filter(p => p.userInfo && p.userInfo.msgID === myMsgID).map(p => p.identifier)
      )
    })

    PushNotificationIOS.getDeliveredNotifications(param => {
      const messages = []

      PushNotificationIOS.removeDeliveredNotifications(
        param
          .filter(p => {
            if (p.userInfo && p.userInfo.convID === convID) {
              messages.push(p.body)
              return true
            }
            return false
          })
          .map(p => p.identifier)
      )
      messages.push(text)

      const message = messages.join('\n')

      PushNotifications.localNotification({
        message,
        soundName: 'keybasemessage.wav',
        userInfo: {
          convID: convID,
          type: 'chat.newmessage',
        },
        number: badgeCount,
      })
    })
  }
}

function configurePush() {
  return eventChannel(dispatch => {
    PushNotifications.configure({
      onRegister: token => {
        let tokenType: ?PushTypes.TokenType
        switch (token.os) {
          case 'ios':
            tokenType = isDevApplePushToken ? PushConstants.tokenTypeAppleDev : PushConstants.tokenTypeApple
            break
          case 'android':
            tokenType = PushConstants.tokenTypeAndroidPlay
            break
        }
        if (tokenType) {
          dispatch(
            PushGen.createPushToken({
              token: token.token,
              tokenType,
            })
          )
        } else {
          dispatch(
            PushGen.createRegistrationError({
              error: new Error(`Unrecognized os for token: ${token}`),
            })
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
        dispatch(
          PushGen.createNotification({
            notification: merged,
          })
        )
      },
      onError: error => {
        dispatch(
          PushGen.createError({
            error,
          })
        )
      },
      // Don't request permissions for ios, we'll ask later, after showing UI
      requestPermissions: !isIOS,
    })
    // It doesn't look like there is a registrationError being set for iOS.
    // https://github.com/zo0r/react-native-push-notification/issues/261
    PushNotificationIOS.addEventListener('registrationError', error => {
      dispatch(
        PushGen.createRegistrationError({
          error,
        })
      )
    })

    logger.debug('Check push permissions')
    if (isIOS) {
      AsyncStorage.getItem('allowPush', (error, result) => {
        if (error || result !== 'false') {
          PushNotifications.checkPermissions(permissions => {
            logger.debug('Push checked permissions:', permissions)
            if (!permissions.alert) {
              // TODO(gabriel): Detect if we already showed permissions prompt and were denied,
              // in which case we should not show prompt or show different prompt about enabling
              // in Settings (for iOS)
              dispatch(
                PushGen.createPermissionsPrompt({
                  prompt: true,
                })
              )
            } else {
              // We have permissions, this triggers a token registration in
              // case it changed.
              dispatch(PushGen.createPermissionsRequest())
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
  clearAllNotifications,
}
