// @flow
import logger from '../logger'
import * as PushTypes from '../constants/types/push'
import * as PushConstants from '../constants/push'
import * as PushGen from './push-gen'
import * as PushNotifications from 'react-native-push-notification'
import {PushNotificationIOS, CameraRoll, ActionSheetIOS, AsyncStorage, Linking} from 'react-native'
import {eventChannel} from 'redux-saga'
import {isDevApplePushToken} from '../local-debug'
import {isIOS} from '../constants/platform'
import {isImageFileName} from '../constants/chat'

const allowPush = 'allowPush'
const shownPushPrompt = 'shownPushPrompt'

function requestPushPermissions(): Promise<*> {
  return PushNotifications.requestPermissions()
}

function setNoPushPermissions(): Promise<*> {
  return new Promise((resolve, reject) => {
    AsyncStorage.setItem(allowPush, 'false', e => {
      resolve()
    })
  })
}

function setYesPushPermissions(): Promise<*> {
  return new Promise((resolve, reject) => {
    AsyncStorage.setItem(allowPush, 'true', e => {
      resolve()
    })
  })
}

// Sets that we've shown the push prompt in local storage
function setShownPushPrompt(): Promise<*> {
  return new Promise((resolve, reject) => {
    logger.info('Setting shownPushPrompt to true in local storage')
    AsyncStorage.setItem(shownPushPrompt, 'true', e => {
      resolve()
    })
  })
}

function getShownPushPrompt(): Promise<string> {
  return AsyncStorage.getItem(shownPushPrompt)
}

function checkPermissions(): Promise<*> {
  return new Promise((resolve, reject) => PushNotifications.checkPermissions(resolve))
}

function showMainWindow() {
  return () => {
    // nothing
  }
}

function getAppState(): Promise<*> {
  return Promise.resolve({})
}

function setAppState(toMerge: Object) {
  throw new Error('setAppState not implemented in mobile')
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
        // On iOS, some fields are in notification.data. Also, the
        // userInfo field from the local notification spawned in
        // displayNewMessageNotification gets renamed to
        // data. However, on Android, all fields are in the top level,
        // but the userInfo field is not renamed.
        //
        // Therefore, just pull out all fields from data and userInfo.
        const merged = {
          ...notification,
          ...(notification.data || {}),
          ...(notification.userInfo || {}),
          data: undefined,
          userInfo: undefined,
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

    // TODO make some true unsubscribe function
    return () => {}
  })
}

function openAppSettings() {
  Linking.openURL('app-settings:')
}

export {
  openAppSettings,
  checkPermissions,
  displayNewMessageNotification,
  getAppState,
  setAppState,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachmentDialog,
  setNoPushPermissions,
  setYesPushPermissions,
  setShownPushPrompt,
  getShownPushPrompt,
  showShareActionSheet,
  clearAllNotifications,
}
