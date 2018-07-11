// @flow
import logger from '../logger'
import * as RPCTypes from '../constants/types/rpc-gen'
import * as Chat2Gen from './chat2-gen'
import * as ConfigGen from './config-gen'
import * as PushTypes from '../constants/types/push'
import * as PushConstants from '../constants/push'
import * as PushGen from './push-gen'
import * as PushNotifications from 'react-native-push-notification'
import * as mime from 'react-native-mime-types'
import * as Saga from '../util/saga'
import RNFetchBlob from 'react-native-fetch-blob'
import {
  PushNotificationIOS,
  CameraRoll,
  ActionSheetIOS,
  Linking,
  NativeModules,
  NativeEventEmitter,
  PermissionsAndroid,
} from 'react-native'
import {eventChannel} from 'redux-saga'
import {isDevApplePushToken} from '../local-debug'
import {isIOS, isAndroid} from '../constants/platform'

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

function requestPushPermissions() {
  return isIOS ? PushNotifications.requestPermissions() : Promise.resolve()
}

function getShownPushPrompt(): Promise<boolean> {
  const PushPrompt = NativeModules.PushPrompt
  return PushPrompt.getHasShownPushPrompt()
}

function checkPermissions() {
  return new Promise((resolve, reject) => PushNotifications.checkPermissions(resolve))
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

async function saveAttachmentToCameraRoll(fileURL: string, mimeType: string): Promise<void> {
  const logPrefix = '[saveAttachmentToCameraRoll] '
  if (isIOS) {
    logger.info(logPrefix + 'Saving to camera roll')
    await CameraRoll.saveToCameraRoll(fileURL)
    return
  }
  const permissionStatus = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    {
      title: 'Keybase Storage Permission',
      message: 'Keybase needs access to your storage so we can download an attachment.',
    }
  )
  if (permissionStatus !== 'granted') {
    logger.error(logPrefix + 'Unable to acquire storage permissions')
    throw new Error('Unable to acquire storage permissions')
  }
  const download = await RNFetchBlob.config({
    appendExt: mime.extension(mimeType),
    fileCache: true,
  }).fetch('GET', fileURL)
  logger.info(logPrefix + 'Fetching success, getting local file path')
  const path = download.path()
  try {
    logger.info(logPrefix + 'Attempting to save')
    await CameraRoll.saveToCameraRoll(`file://${path}`)
    logger.info(logPrefix + 'Success')
  } catch (err) {
    logger.error(logPrefix + 'Failed:', err)
    throw err
  } finally {
    logger.info(logPrefix + 'Deleting tmp file')
    await RNFetchBlob.fs.unlink(path)
  }
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

function displayNewMessageNotification(
  text: string,
  convID: ?string,
  badgeCount: ?number,
  myMsgID: ?number,
  soundName: ?string
) {
  // Dismiss any non-plaintext notifications for the same message ID
  if (isIOS) {
    PushNotificationIOS.getDeliveredNotifications(param => {
      PushNotificationIOS.removeDeliveredNotifications(
        param.filter(p => p.userInfo && p.userInfo.msgID === myMsgID).map(p => p.identifier)
      )
    })
  }

  logger.info(`Got push notification with soundName '${soundName || ''}'`)
  PushNotifications.localNotification({
    message: text,
    soundName,
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

const getContentTypeFromURL = (
  url: string,
  cb: ({error?: any, statusCode?: number, contentType?: string}) => void
) =>
  // For some reason HEAD doesn't work on Android. So just GET one byte.
  // TODO: fix HEAD for Android and get rid of this hack.
  isAndroid
    ? fetch(url, {method: 'GET', headers: {Range: 'bytes=0-0'}}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          let statusCode = response.status
          if (
            statusCode === 200 ||
            statusCode === 206 ||
            // 416 can happen if the file is empty.
            statusCode === 416
          ) {
            contentType = response.headers.get('Content-Type')
            statusCode = 200 // Treat 200, 206, and 416 as 200.
          }
          cb({statusCode, contentType})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })
    : fetch(url, {method: 'HEAD'}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          if (response.status === 200) {
            contentType = response.headers.get('Content-Type')
          }
          cb({statusCode: response.status, contentType})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })

const updateChangedFocus = (action: ConfigGen.MobileAppStatePayload) => {
  let appFocused
  let logState
  switch (action.payload.nextAppState) {
    case 'active':
      appFocused = true
      logState = RPCTypes.appStateAppState.foreground
      break
    case 'background':
      appFocused = false
      logState = RPCTypes.appStateAppState.background
      break
    case 'inactive':
      appFocused = false
      logState = RPCTypes.appStateAppState.inactive
      break
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (v: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(action.payload.nextAppState);
      */
      appFocused = false
      logState = RPCTypes.appStateAppState.foreground
  }

  logger.info(`setting app state on service to: ${logState}`)
  return Saga.put(ConfigGen.createChangedFocus({appFocused}))
}

const setStartedDueToPush = (action: Chat2Gen.SelectConversationPayload) =>
  action.payload.reason === 'push' ? Saga.put(ConfigGen.createSetStartedDueToPush()) : undefined

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ConfigGen.mobileAppState, updateChangedFocus)
  yield Saga.safeTakeEveryPure(Chat2Gen.selectConversation, setStartedDueToPush)
}

export {
  openAppSettings,
  checkPermissions,
  displayNewMessageNotification,
  downloadAndShowShareActionSheet,
  requestPushPermissions,
  configurePush,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  getShownPushPrompt,
  showShareActionSheet,
  clearAllNotifications,
  getContentTypeFromURL,
  platformConfigSaga,
}
