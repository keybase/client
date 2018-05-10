// @flow
import logger from '../logger'
import * as PushTypes from '../constants/types/push'
import * as PushConstants from '../constants/push'
import * as PushGen from './push-gen'
import * as PushNotifications from 'react-native-push-notification'
import * as mime from 'react-native-mime-types'
import RNFetchBlob from 'react-native-fetch-blob'
import {
  PushNotificationIOS,
  CameraRoll,
  ActionSheetIOS,
  AsyncStorage,
  Linking,
  NativeModules,
  NativeEventEmitter,
} from 'react-native'
import {eventChannel} from 'redux-saga'
import {isDevApplePushToken} from '../local-debug'
import {isIOS} from '../constants/platform'

const shownPushPrompt = 'shownPushPrompt'
// Used to listen to the java intent for notifications
let RNEmitter
// Push notifications on android are very messy. It works differently if we're entirely killed or if we're in the background
// If we're killed it all works. clicking on the notification launches us and we get the onNotify callback and it all works
// If we're backgrounded we get the silent or the silent and real. To work around this we:
// 1. Plumb through the intent from the java side if we relaunch due to push
// 2. We store the last push and re-use it when this event is emitted to just 'rerun' the push
if (!isIOS) {
  RNEmitter = new NativeEventEmitter(NativeModules.KeybaseEngine)
}

function requestPushPermissions(): Promise<*> {
  return isIOS ? PushNotifications.requestPermissions() : Promise.resolve()
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
  mimeType?: ?string,
}): Promise<{completed: boolean, method: string}> {
  if (isIOS) {
    return new Promise((resolve, reject) =>
      ActionSheetIOS.showShareActionSheetWithOptions(options, reject, resolve)
    )
  } else {
    return NativeModules.ShareFiles.share(options.url, options.mimeType).then(
      () => ({completed: true, method: ''}),
      () => ({completed: false, method: ''})
    )
  }
}

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  let goodPath = filePath
  logger.debug('saveAttachment: ', goodPath)
  return CameraRoll.saveToCameraRoll(goodPath)
}

function saveAttachmentToCameraRoll(fileURL: string, mimeType: string): Promise<void> {
  const logPrefix = '[saveAttachmentToCameraRoll] '
  if (isIOS) {
    logger.info(logPrefix + 'Saving to camera roll')
    return CameraRoll.saveToCameraRoll(fileURL)
  }
  return (
    RNFetchBlob.config({
      appendExt: mime.extension(mimeType),
      fileCache: true,
    })
      .fetch('GET', fileURL)
      // get just the path
      .then(res => {
        logger.info(logPrefix + 'Fetching success, getting local file path')
        return res.path()
      })
      // hold on to the path to delete later and save to camera roll
      .then(path => {
        logger.info(logPrefix + 'Got local file path, attempting to save')
        return [Promise.resolve(path), CameraRoll.saveToCameraRoll(`file://${path}`)]
      })
      // delete temp file
      .then(([res, newURI]) => {
        logger.info(logPrefix + 'Success, deleting tmp file')
        return RNFetchBlob.fs.unlink(res)
      })
  )
}

// Downloads a file, shows the shareactionsheet, and deletes the file afterwards
function downloadAndShowShareActionSheet(fileURL: string, mimeType: string): Promise<void> {
  const extension = mime.extension(mimeType)
  return RNFetchBlob.config({
    fileCache: true,
    appendExt: extension,
  })
    .fetch('GET', fileURL)
    .then(res => res.path())
    .then(path => Promise.all([showShareActionSheet({url: path}), Promise.resolve(path)]))
    .then(([_, path]) => RNFetchBlob.fs.unlink(path))
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

let lastPush = null
function configurePush() {
  return eventChannel(dispatch => {
    if (RNEmitter) {
      // If android launched due to push
      RNEmitter.addListener('androidIntentNotification', () => {
        if (lastPush) {
          // if plaintext is on we get this but not the real message if we're backgrounded, so convert it to a non-silent type
          if (lastPush.type === 'chat.newmessageSilent_2') {
            lastPush.type = 'chat.newmessage'
            // grab convo id
            lastPush.convID = lastPush.c
          }
          // emulate like the user clicked it while we're killed
          lastPush.userInteraction = true // force this true
          dispatch(
            PushGen.createNotification({
              notification: lastPush,
            })
          )
          lastPush = null
        }
      })
    }

    PushNotifications.configure({
      onRegister: token => {
        let tokenType: ?PushTypes.TokenType
        console.log('PUSH TOKEN', token)
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
              error: new Error(`Unrecognized OS for token: ${token}`),
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

        // bookkeep for android special handling
        lastPush = merged
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

function checkRPCOwnership(): Promise<*> {
  return Promise.resolve({})
}

export {
  openAppSettings,
  checkPermissions,
  displayNewMessageNotification,
  downloadAndShowShareActionSheet,
  getAppState,
  setAppState,
  requestPushPermissions,
  showMainWindow,
  configurePush,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  setShownPushPrompt,
  getShownPushPrompt,
  showShareActionSheet,
  clearAllNotifications,
  checkRPCOwnership,
}
