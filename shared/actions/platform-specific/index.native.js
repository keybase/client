// @flow
import logger from '../../logger'
import {type TypedState} from '../../constants/reducer'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as ConfigGen from '../config-gen'
import * as GregorGen from '../gregor-gen'
import * as Chat2Gen from '../chat2-gen'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
// this CANNOT be an import *, totally screws up the packager
import {
  NetInfo,
  Linking,
  NativeModules,
  ActionSheetIOS,
  CameraRoll,
  PermissionsAndroid,
  Clipboard,
} from 'react-native'
import {getPath} from '../../route-tree'
import RNFetchBlob from 'rn-fetch-blob'
import * as PushNotifications from 'react-native-push-notification'
import {isIOS, isAndroid} from '../../constants/platform'
import pushSaga, {getStartupDetailsFromInitialPush} from './push.native'

type NextURI = string
function saveAttachmentDialog(filePath: string): Promise<NextURI> {
  let goodPath = filePath
  logger.debug('saveAttachment: ', goodPath)
  return CameraRoll.saveToCameraRoll(goodPath)
}

async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  if (!isIOS) {
    const permissionStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        message: 'Keybase needs access to your storage so we can download an attachment.',
        title: 'Keybase Storage Permission',
      }
    )
    if (permissionStatus !== 'granted') {
      logger.error(logPrefix + 'Unable to acquire storage permissions')
      throw new Error('Unable to acquire storage permissions')
    }
  }
  try {
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await CameraRoll.saveToCameraRoll(fileURL, saveType)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    // This can fail if the user backgrounds too quickly, so throw up a local notification
    // just in case to get their attention.
    PushNotifications.localNotification({
      message: `Failed to save ${saveType} to camera roll`,
    })
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    RNFetchBlob.fs.unlink(filePath)
  }
}

function showShareActionSheetFromURL(options: {
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

// Shows the shareactionsheet for a file, and deletes the file afterwards
function showShareActionSheetFromFile(filePath: string): Promise<void> {
  return showShareActionSheetFromURL({url: 'file://' + filePath}).then(() => RNFetchBlob.fs.unlink(filePath))
}

const openAppSettings = () => {
  if (isAndroid) {
    NativeModules.NativeSettings.open()
  } else {
    const settingsURL = 'app-settings:'
    Linking.canOpenURL(settingsURL).then(can => {
      if (can) {
        Linking.openURL(settingsURL)
      } else {
        logger.warn('Unable to open app settings')
      }
    })
  }
}

const getContentTypeFromURL = (
  url: string,
  cb: ({error?: any, statusCode?: number, contentType?: string, disposition?: string}) => void
) =>
  // For some reason HEAD doesn't work on Android. So just GET one byte.
  // TODO: fix HEAD for Android and get rid of this hack.
  isAndroid
    ? fetch(url, {method: 'GET', headers: {Range: 'bytes=0-0'}}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          let disposition = ''
          let statusCode = response.status
          if (
            statusCode === 200 ||
            statusCode === 206 ||
            // 416 can happen if the file is empty.
            statusCode === 416
          ) {
            contentType = response.headers.get('Content-Type') || ''
            disposition = response.headers.get('Content-Disposition') || ''
            statusCode = 200 // Treat 200, 206, and 416 as 200.
          }
          cb({statusCode, contentType, disposition})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })
    : fetch(url, {method: 'HEAD'}) // eslint-disable-line no-undef
        .then(response => {
          let contentType = ''
          let disposition = ''
          if (response.status === 200) {
            contentType = response.headers.get('Content-Type') || ''
            disposition = response.headers.get('Content-Disposition') || ''
          }
          cb({statusCode: response.status, contentType, disposition})
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

const clearRouteState = () =>
  Saga.spawn(() =>
    RPCTypes.configSetValueRpcPromise({path: 'ui.routeState', value: {isNull: false, s: ''}}).catch(() => {})
  )

const persistRouteState = (state: TypedState) =>
  Saga.call(function*() {
    // Put a delay in case we go to a route and crash immediately
    yield Saga.call(Saga.delay, 3000)
    const routePath = getPath(state.routeTree.routeState)
    const selectedTab = routePath.first()
    if (Tabs.isValidInitialTabString(selectedTab)) {
      const item = {
        // in a conversation and not on the inbox
        selectedConversationIDKey:
          selectedTab === Tabs.chatTab && routePath.size > 1 ? state.chat2.selectedConversation : null,
        tab: selectedTab,
      }

      yield Saga.spawn(() =>
        RPCTypes.configSetValueRpcPromise({
          path: 'ui.routeState',
          value: {isNull: false, s: JSON.stringify(item)},
        }).catch(() => {})
      )
    } else {
      yield clearRouteState()
    }
  })

const setupNetInfoWatcher = () =>
  Saga.call(function*() {
    const channel = Saga.eventChannel(emitter => {
      NetInfo.addEventListener('connectionChange', () => emitter('changed'))
      return () => {}
    }, Saga.buffers.dropping(1))
    while (true) {
      yield Saga.take(channel)
      yield Saga.put(GregorGen.createCheckReachability())
    }
  })

function* loadStartupDetails() {
  let startupWasFromPush = false
  let startupConversation = null
  let startupFollowUser = ''
  let startupLink = ''
  let startupTab = null

  const routeStateTask = yield Saga._fork(() =>
    RPCTypes.configGetValueRpcPromise({path: 'ui.routeState'})
      .then(v => v.s || '')
      .catch(e => {})
  )
  const linkTask = yield Saga._fork(Linking.getInitialURL)
  const initialPush = yield Saga._fork(getStartupDetailsFromInitialPush)
  const [routeState, link, push] = yield Saga.join(routeStateTask, linkTask, initialPush)

  // Top priority, push
  if (push) {
    startupWasFromPush = true
    startupConversation = push.startupConversation
    startupFollowUser = push.startupFollowUser
  }

  // Second priority, deep link
  if (!startupWasFromPush && link) {
    startupLink = link
  }

  // Third priority, saved from last session
  if (!startupWasFromPush && !startupLink && routeState) {
    try {
      const item = JSON.parse(routeState)
      if (item) {
        startupConversation = item.selectedConversationIDKey
        startupTab = item.tab
      }

      // immediately clear route state in case this is a bad route
      yield clearRouteState()
    } catch (_) {
      startupConversation = null
      startupTab = null
    }
  }

  yield Saga.put(
    ConfigGen.createSetStartupDetails({
      startupConversation,
      startupFollowUser,
      startupLink,
      startupTab,
      startupWasFromPush,
    })
  )
}

const waitForStartupDetails = (state: TypedState, action: ConfigGen.DaemonHandshakePayload) => {
  // loadStartupDetails finished already
  if (state.config.startupDetailsLoaded) {
    return
  }
  // Else we have to wait for the loadStartupDetails to finish
  return Saga.call(function*() {
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({
        increment: true,
        name: 'platform.native-waitStartupDetails',
        version: action.payload.version,
      })
    )
    yield Saga.take(ConfigGen.setStartupDetails)
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({
        increment: false,
        name: 'platform.native-waitStartupDetails',
        version: action.payload.version,
      })
    )
  })
}

const copyToClipboard = (_: any, action: ConfigGen.CopyToClipboardPayload) => {
  Clipboard.setString(action.payload.text)
}

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(ConfigGen.mobileAppState, updateChangedFocus)
  yield Saga.actionToAction(ConfigGen.loggedOut, clearRouteState)
  yield Saga.actionToAction([RouteTreeGen.switchTo, Chat2Gen.selectConversation], persistRouteState)
  yield Saga.actionToAction(ConfigGen.openAppSettings, openAppSettings)
  yield Saga.actionToAction(ConfigGen.setupEngineListeners, setupNetInfoWatcher)
  yield Saga.actionToAction(ConfigGen.copyToClipboard, copyToClipboard)

  yield Saga.actionToAction(ConfigGen.daemonHandshake, waitForStartupDetails)
  // Start this immediately instead of waiting so we can do more things in parallel
  yield Saga.spawn(loadStartupDetails)

  yield Saga.spawn(pushSaga)
}

export {
  showShareActionSheetFromFile,
  showShareActionSheetFromURL,
  saveAttachmentDialog,
  saveAttachmentToCameraRoll,
  getContentTypeFromURL,
  platformConfigSaga,
}
