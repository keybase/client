// @flow
import logger from '../../logger'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as ConfigGen from '../config-gen'
import * as ProfileGen from '../profile-gen'
import * as GregorGen from '../gregor-gen'
import * as Chat2Gen from '../chat2-gen'
import * as Flow from '../../util/flow'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
// this CANNOT be an import *, totally screws up the packager
import {
  Alert,
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
import {showImagePicker, type Response} from 'react-native-image-picker'

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
    ? fetch(url, {headers: {Range: 'bytes=0-0'}, method: 'GET'}) // eslint-disable-line no-undef
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
          cb({contentType, disposition, statusCode})
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
          cb({contentType, disposition, statusCode: response.status})
        })
        .catch(error => {
          console.log(error)
          cb({error})
        })

const updateChangedFocus = (_, action) => {
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
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action.payload.nextAppState)
      appFocused = false
      logState = RPCTypes.appStateAppState.foreground
  }

  logger.info(`setting app state on service to: ${logState}`)
  return ConfigGen.createChangedFocus({appFocused})
}

function* clearRouteState() {
  yield Saga.spawn(() =>
    RPCTypes.configSetValueRpcPromise({path: 'ui.routeState', value: {isNull: false, s: ''}}).catch(() => {})
  )
}

function* persistRouteState(state) {
  // Put a delay in case we go to a route and crash immediately
  yield Saga.callUntyped(Saga.delay, 3000)
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
}

function* setupNetInfoWatcher() {
  const channel = Saga.eventChannel(emitter => {
    NetInfo.addEventListener('connectionChange', () => emitter('changed'))
    return () => {}
  }, Saga.buffers.dropping(1))
  while (true) {
    yield Saga.take(channel)
    yield Saga.put(GregorGen.createCheckReachability())
  }
}

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

function* waitForStartupDetails(state, action) {
  // loadStartupDetails finished already
  if (state.config.startupDetailsLoaded) {
    return
  }
  // Else we have to wait for the loadStartupDetails to finish
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
}

const copyToClipboard = (_, action) => {
  Clipboard.setString(action.payload.text)
}

const handleFilePickerError = (_, action) => {
  Alert.alert('Error', action.payload.error.message)
}

const editAvatar = () =>
  new Promise((resolve, reject) => {
    showImagePicker({mediaType: 'photo'}, (response: Response) => {
      if (response.didCancel) {
        resolve()
      } else if (response.error) {
        resolve(ConfigGen.createFilePickerError({error: new Error(response.error)}))
      } else {
        resolve(
          RouteTreeGen.createNavigateAppend({path: [{props: {image: response}, selected: 'editAvatar'}]})
        )
      }
    })
  })

function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<ConfigGen.MobileAppStatePayload>(ConfigGen.mobileAppState, updateChangedFocus)
  yield* Saga.chainGenerator<ConfigGen.LoggedOutPayload>(ConfigGen.loggedOut, clearRouteState)
  yield* Saga.chainGenerator<RouteTreeGen.SwitchToPayload | Chat2Gen.SelectConversationPayload>(
    [RouteTreeGen.switchTo, Chat2Gen.selectConversation],
    persistRouteState
  )
  yield* Saga.chainAction<ConfigGen.OpenAppSettingsPayload>(ConfigGen.openAppSettings, openAppSettings)
  yield* Saga.chainGenerator<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupNetInfoWatcher
  )
  yield* Saga.chainAction<ConfigGen.CopyToClipboardPayload>(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    waitForStartupDetails
  )
  yield* Saga.chainAction<ConfigGen.FilePickerErrorPayload>(ConfigGen.filePickerError, handleFilePickerError)
  yield* Saga.chainAction<ProfileGen.EditAvatarPayload>(ProfileGen.editAvatar, editAvatar)
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
