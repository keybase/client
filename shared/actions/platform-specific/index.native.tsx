import logger from '../../logger'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as SettingsConstants from '../../constants/settings'
import * as PushConstants from '../../constants/push'
import * as RouterConstants from '../../constants/router2'
import * as ChatConstants from '../../constants/chat2'
import * as ConfigGen from '../config-gen'
import * as Chat2Gen from '../chat2-gen'
import * as ProfileGen from '../profile-gen'
import * as SettingsGen from '../settings-gen'
import * as WaitingGen from '../waiting-gen'
import * as EngineGen from '../engine-gen-gen'
import * as Flow from '../../util/flow'
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import * as Saga from '../../util/saga'
import * as Types from '../../constants/types/chat2'
import {getEngine} from '../../engine/require'
// this CANNOT be an import *, totally screws up the packager
import {
  Alert,
  Linking,
  NativeModules,
  NativeEventEmitter,
  ActionSheetIOS,
  PermissionsAndroid,
  Clipboard,
  Vibration,
} from 'react-native'
import CameraRoll from '@react-native-community/cameraroll'
import NetInfo from '@react-native-community/netinfo'
// @ts-ignore strict
import * as PushNotifications from 'react-native-push-notification'
import {isIOS, isAndroid} from '../../constants/platform'
import pushSaga, {getStartupDetailsFromInitialPush, getStartupDetailsFromInitialShare} from './push.native'
import * as Container from '../../util/container'
import * as Contacts from 'expo-contacts'
import {launchImageLibraryAsync} from '../../util/expo-image-picker'
import Geolocation from '@react-native-community/geolocation'
// @ts-ignore strict
import {AudioRecorder} from 'react-native-audio'
import * as Haptics from 'expo-haptics'
import {_getNavigator} from '../../constants/router2'

const requestPermissionsToWrite = async () => {
  if (isAndroid) {
    const permissionStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      {
        buttonNegative: 'Cancel',
        buttonNeutral: 'Ask me later',
        buttonPositive: 'OK',
        message: 'Keybase needs access to your storage so we can download a file.',
        title: 'Keybase Storage Permission',
      }
    )
    return permissionStatus !== 'granted'
      ? Promise.reject(new Error('Unable to acquire storage permissions'))
      : Promise.resolve()
  }
  return Promise.resolve()
}

export const requestAudioPermission = async () => {
  let chargeForward = true
  const {Permissions} = require('react-native-unimodules')
  let {status} = await Permissions.getAsync(Permissions.AUDIO_RECORDING)
  if (status === Permissions.PermissionStatus.UNDETERMINED) {
    if (isIOS) {
      const askRes = await Permissions.askAsync(Permissions.AUDIO_RECORDING)
      status = askRes.status
    } else {
      const askRes = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
      switch (askRes) {
        case 'never_ask_again':
        case 'denied':
          status = Permissions.PermissionStatus.DENIED
      }
    }
    chargeForward = false
  }
  if (status === Permissions.PermissionStatus.DENIED) {
    throw new Error('Please allow Keybase to access the microphone in the phone settings.')
  }
  return chargeForward
}

export const requestLocationPermission = async (mode: RPCChatTypes.UIWatchPositionPerm) => {
  if (isIOS) {
    const {Permissions} = require('react-native-unimodules')
    const {status, permissions} = await Permissions.getAsync(Permissions.LOCATION)
    switch (mode) {
      case RPCChatTypes.UIWatchPositionPerm.base:
        if (status === Permissions.PermissionStatus.DENIED) {
          throw new Error('Please allow Keybase to access your location in the phone settings.')
        }
        break
      case RPCChatTypes.UIWatchPositionPerm.always: {
        const iOSPerms = permissions[Permissions.LOCATION].ios
        if (!iOSPerms || iOSPerms.scope !== 'always') {
          throw new Error(
            'Please allow Keybase to access your location even if the app is not running for live location.'
          )
        }
        break
      }
    }
  }
  if (isAndroid) {
    const permissionStatus = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
        message: 'Keybase needs access to your location in order to post it.',
        title: 'Keybase Location Permission',
      }
    )
    if (permissionStatus !== 'granted') {
      throw new Error('Unable to acquire location permissions')
    }
  }
}

export const saveAttachmentDialog = async (filePath: string) => {
  const goodPath = filePath
  logger.debug('saveAttachment: ', goodPath)
  await requestPermissionsToWrite()
  return CameraRoll.saveToCameraRoll(goodPath)
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  try {
    await requestPermissionsToWrite()
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
    try {
      require('rn-fetch-blob').default.fs.unlink(filePath)
    } catch (_) {
      logger.warn('failed to unlink')
    }
  }
}

const onShareAction = async (action: ConfigGen.ShowShareActionSheetPayload) => {
  const {filePath, message, mimeType} = action.payload
  await showShareActionSheet({filePath, message, mimeType})
}

export const showShareActionSheet = async (options: {
  filePath?: any | null
  message?: any | null
  mimeType: string
}) => {
  if (isIOS) {
    return new Promise((resolve, reject) =>
      ActionSheetIOS.showShareActionSheetWithOptions(
        {
          message: options.message,
          url: options.filePath,
        },
        reject,
        resolve
      )
    )
  } else {
    if (!options.filePath && options.message) {
      try {
        await NativeModules.ShareFiles.shareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (_) {
        return {completed: false, method: ''}
      }
    }

    try {
      await NativeModules.ShareFiles.share(options.filePath, options.mimeType)
      return {completed: true, method: ''}
    } catch (_) {
      return {completed: false, method: ''}
    }
  }
}

const openAppSettings = async () => {
  if (isAndroid) {
    NativeModules.NativeSettings.open()
  } else {
    const settingsURL = 'app-settings:'
    const can = await Linking.canOpenURL(settingsURL)
    if (can) {
      Linking.openURL(settingsURL)
    } else {
      logger.warn('Unable to open app settings')
    }
  }
}

const updateChangedFocus = (action: ConfigGen.MobileAppStatePayload) => {
  let appFocused: boolean
  let logState: RPCTypes.MobileAppState
  switch (action.payload.nextAppState) {
    case 'active':
      appFocused = true
      logState = RPCTypes.MobileAppState.foreground
      break
    case 'background':
      appFocused = false
      logState = RPCTypes.MobileAppState.background
      break
    case 'inactive':
      appFocused = false
      logState = RPCTypes.MobileAppState.inactive
      break
    default:
      Flow.ifFlowComplainsAboutThisFunctionYouHaventHandledAllCasesInASwitch(action.payload.nextAppState)
      appFocused = false
      logState = RPCTypes.MobileAppState.foreground
  }

  logger.info(`setting app state on service to: ${logState}`)
  return ConfigGen.createChangedFocus({appFocused})
}

let _lastPersist = ''
function* persistRoute(_state: Container.TypedState, action: ConfigGen.PersistRoutePayload) {
  const path = action.payload.path
  const mainOrModal = path && path[1] && path[1].routeName

  let param = {}
  let routeName = ''
  if (mainOrModal === 'Main') {
    const tab = path && path[2] // real top is the root of the tab (aka chatRoot) and not the tab itself
    if (!tab) return
    // top level tab?
    if (tab.routeName === 'tabs.chatTab') {
      const convo = path && path[path.length - 1]
      // a specific convo?
      if (convo.routeName === 'chatConversation') {
        routeName = convo.routeName
        param = {selectedConversationIDKey: convo.params?.conversationIDKey}
      } else {
        // just the inbox
        routeName = tab.routeName
      }
    } else if (Tabs.isValidInitialTabString(tab.routeName)) {
      routeName = tab.routeName
    } else {
      return // don't write, keep the last
    }
  } else {
    // info panel
    if (mainOrModal === 'chatInfoPanel') {
      routeName = 'chatConversation'
      param = {selectedConversationIDKey: path && path[1].params.conversationIDKey}
    } else {
      // no path or unknown, default to people
      routeName = 'tabs.peopleTab'
    }
  }

  const s = JSON.stringify({param, routeName})
  // don't keep rewriting
  if (_lastPersist === s) {
    return
  }
  yield Saga.spawn(() =>
    RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s},
    })
      .then(() => {
        _lastPersist = s
      })
      .catch(() => {})
  )
}

// only send when different, we get called a bunch where this doesn't actually change
let _lastNetworkType: ConfigGen.OsNetworkStatusChangedPayload['payload']['type'] | undefined
const updateMobileNetState = async (action: ConfigGen.OsNetworkStatusChangedPayload) => {
  try {
    const {type} = action.payload
    if (type === _lastNetworkType) {
      return false as const
    }
    _lastNetworkType = type
    await RPCTypes.appStateUpdateMobileNetStateRpcPromise({state: type})
  } catch (err) {
    console.warn('Error sending mobileNetStateUpdate', err)
  }
  return false as const
}

const initOsNetworkStatus = async () => {
  const {type} = await NetInfo.fetch()
  return ConfigGen.createOsNetworkStatusChanged({isInit: true, online: type !== 'none', type})
}

function* setupNetInfoWatcher() {
  const channel = Saga.eventChannel(emitter => {
    NetInfo.addEventListener(({type}) => emitter(type))
    return () => {}
  }, Saga.buffers.sliding(1))

  while (true) {
    const status = yield Saga.take(channel)
    yield Saga.put(ConfigGen.createOsNetworkStatusChanged({online: status !== 'none', type: status}))
  }
}

// TODO rewrite this, v slow
function* loadStartupDetails() {
  let startupWasFromPush = false
  let startupConversation = undefined
  let startupPushPayload = undefined
  let startupFollowUser = ''
  let startupLink = ''
  let startupTab = undefined
  let startupSharePath = undefined
  let startupShareText = undefined

  const routeStateTask = yield Saga._fork(async () => {
    try {
      const v = await RPCTypes.configGuiGetValueRpcPromise({path: 'ui.routeState2'})
      return v.s || ''
    } catch (_) {
      return undefined
    }
  })
  const linkTask = yield Saga._fork(Linking.getInitialURL)
  const initialPush = yield Saga._fork(getStartupDetailsFromInitialPush)
  const initialShare = yield Saga._fork(getStartupDetailsFromInitialShare)
  const [routeState, link, push, share] = yield Saga.join([
    routeStateTask,
    linkTask,
    initialPush,
    initialShare,
  ])

  logger.info('routeState load', routeState)

  // Clear last value to be extra safe bad things don't hose us forever
  yield Saga._fork(async () => {
    try {
      await RPCTypes.configGuiSetValueRpcPromise({
        path: 'ui.routeState2',
        value: {isNull: false, s: ''},
      })
    } catch (_) {}
  })

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    startupWasFromPush = true
    startupConversation = push.startupConversation
    startupFollowUser = push.startupFollowUser
    startupPushPayload = push.startupPushPayload
  } else if (link) {
    logger.info('initialState: link', link)
    // Second priority, deep link
    startupLink = link
  } else if (share?.fileUrl || share?.text) {
    logger.info('initialState: share')
    startupSharePath = share.fileUrl || undefined
    startupShareText = share.text || undefined
  } else if (routeState) {
    // Last priority, saved from last session
    try {
      const item = JSON.parse(routeState)
      if (item) {
        startupConversation = (item.param && item.param.selectedConversationIDKey) || undefined
        logger.info('initialState: routeState', startupConversation)
        startupTab = item.routeName || undefined
      }
    } catch (_) {
      logger.info('initialState: routeState parseFail')
      startupConversation = undefined
      startupTab = undefined
    }
  }

  yield Saga.put(
    ConfigGen.createSetStartupDetails({
      startupConversation,
      startupFollowUser,
      startupLink,
      startupPushPayload,
      startupSharePath,
      startupShareText,
      startupTab,
      startupWasFromPush,
    })
  )
}

function* waitForStartupDetails(state: Container.TypedState, action: ConfigGen.DaemonHandshakePayload) {
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

const copyToClipboard = (action: ConfigGen.CopyToClipboardPayload) => {
  Clipboard.setString(action.payload.text)
}

const handleFilePickerError = (action: ConfigGen.FilePickerErrorPayload) => {
  Alert.alert('Error', action.payload.error.message)
}

const editAvatar = async () => {
  try {
    const result = await launchImageLibraryAsync('photo')
    return result.cancelled === true
      ? null
      : RouteTreeGen.createNavigateAppend({
          path: [{props: {image: result}, selected: 'profileEditAvatar'}],
        })
  } catch (error) {
    return ConfigGen.createFilePickerError({error: new Error(error)})
  }
}

const openAppStore = () =>
  Linking.openURL(
    isAndroid
      ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
      : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
  ).catch(() => {})

const expoPermissionStatusMap = () => {
  const {Permissions} = require('react-native-unimodules')
  return {
    [Permissions.PermissionStatus.GRANTED]: 'granted' as const,
    [Permissions.PermissionStatus.DENIED]: 'never_ask_again' as const,
    [Permissions.PermissionStatus.UNDETERMINED]: 'undetermined' as const,
  }
}

const loadContactPermissionFromNative = async () => {
  if (isIOS) {
    const {Permissions} = require('react-native-unimodules')
    return expoPermissionStatusMap()[(await Permissions.getAsync(Permissions.CONTACTS)).status]
  }
  return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS))
    ? 'granted'
    : 'undetermined'
}

const loadContactPermissions = async (
  state: Container.TypedState,
  action: SettingsGen.LoadedContactImportEnabledPayload | ConfigGen.MobileAppStatePayload,
  logger: Saga.SagaLogger
) => {
  if (action.type === ConfigGen.mobileAppState && action.payload.nextAppState !== 'active') {
    // only reload on foreground
    return
  }
  const status = await loadContactPermissionFromNative()
  logger.info(`OS status: ${status}`)
  if (
    isAndroid &&
    status === 'undetermined' &&
    ['never_ask_again', 'undetermined'].includes(state.settings.contacts.permissionStatus)
  ) {
    // Workaround PermissionsAndroid.check giving only a boolean. If
    // `requestPermissions` previously told us never_ask_again that is still the
    // status
    return null
  }
  return SettingsGen.createLoadedContactPermissions({status})
}

const askForContactPermissionsAndroid = async () => {
  const status = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_CONTACTS)
  // status is 'granted' | 'denied' | 'never_ask_again'
  // map 'denied' -> 'undetermined' since 'undetermined' means we can show the prompt again
  return status === 'denied' ? 'undetermined' : status
}

const askForContactPermissionsIOS = async () => {
  const {Permissions} = require('react-native-unimodules')
  const {status} = await Permissions.askAsync(Permissions.CONTACTS)
  return expoPermissionStatusMap()[status]
}

const askForContactPermissions = () => {
  return isAndroid ? askForContactPermissionsAndroid() : askForContactPermissionsIOS()
}

function* requestContactPermissions(
  _: Container.TypedState,
  action: SettingsGen.RequestContactPermissionsPayload
) {
  const {thenToggleImportOn} = action.payload
  yield Saga.put(WaitingGen.createIncrementWaiting({key: SettingsConstants.importContactsWaitingKey}))
  const result: Saga.RPCPromiseType<typeof askForContactPermissions> = yield askForContactPermissions()
  if (result === 'granted' && thenToggleImportOn) {
    yield Saga.put(
      SettingsGen.createEditContactImportEnabled({enable: true, fromSettings: action.payload.fromSettings})
    )
  }
  yield Saga.sequentially([
    Saga.put(SettingsGen.createLoadedContactPermissions({status: result})),
    Saga.put(WaitingGen.createDecrementWaiting({key: SettingsConstants.importContactsWaitingKey})),
  ])
}

const manageContactsCache = async (
  state: Container.TypedState,
  _: SettingsGen.LoadedContactImportEnabledPayload | EngineGen.Chat1ChatUiTriggerContactSyncPayload,
  logger: Saga.SagaLogger
) => {
  if (state.settings.contacts.importEnabled === false) {
    await RPCTypes.contactsSaveContactListRpcPromise({contacts: []})
    return SettingsGen.createSetContactImportedCount({})
  }

  // get permissions if we haven't loaded them for some reason
  let {permissionStatus} = state.settings.contacts
  if (permissionStatus === 'unknown') {
    permissionStatus = await loadContactPermissionFromNative()
  }
  const perm = permissionStatus === 'granted'

  const enabled = state.settings.contacts.importEnabled
  if (!enabled || !perm) {
    if (enabled && !perm) {
      logger.info('contact import enabled but no contact permissions')
    }
    if (enabled === null) {
      logger.info("haven't loaded contact import enabled")
    }
    return
  }

  // feature enabled and permission granted
  let contacts: Contacts.ContactResponse
  try {
    contacts = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    })
  } catch (e) {
    logger.error(`error loading contacts: ${e.message}`)
    return SettingsGen.createSetContactImportedCount({error: e.message})
  }
  let defaultCountryCode: string = ''
  try {
    defaultCountryCode = await NativeModules.Utils.getDefaultCountryCode()
    if (__DEV__ && !defaultCountryCode) {
      // behavior of parsing can be unexpectedly different with no country code.
      // iOS sim + android emu don't supply country codes, so use this one.
      defaultCountryCode = 'us'
    }
  } catch (e) {
    logger.warn(`Error loading default country code: ${e.message}`)
  }

  const mapped = SettingsConstants.nativeContactsToContacts(contacts, defaultCountryCode)
  logger.info(`Importing ${mapped.length} contacts.`)
  const actions: Array<Container.TypedActions> = []
  try {
    const {newlyResolved, resolved} = await RPCTypes.contactsSaveContactListRpcPromise({contacts: mapped})
    logger.info(`Success`)
    actions.push(
      SettingsGen.createSetContactImportedCount({count: mapped.length}),
      SettingsGen.createLoadedUserCountryCode({code: defaultCountryCode})
    )
    if (newlyResolved && newlyResolved.length) {
      PushNotifications.localNotification({
        message: PushConstants.makeContactsResolvedMessage(newlyResolved),
      })
    }
    if (state.settings.contacts.waitingToShowJoinedModal && resolved) {
      actions.push(SettingsGen.createShowContactsJoinedModal({resolved}))
    }
  } catch (e) {
    logger.error('Error saving contacts list: ', e.message)
    actions.push(SettingsGen.createSetContactImportedCount({error: e.message}))
  }
  return actions
}

const showContactsJoinedModal = (action: SettingsGen.ShowContactsJoinedModalPayload) =>
  action.payload.resolved.length
    ? [RouteTreeGen.createNavigateAppend({path: ['settingsContactsJoined']})]
    : []

function* setupDarkMode() {
  const NativeAppearance = NativeModules.Appearance
  if (NativeAppearance) {
    // eslint-disable-next-line no-inner-declarations
    function* handleGotChangeEvent(action: any) {
      yield Saga.delay(500)
      yield Saga.put(action)
    }

    const channel = Saga.eventChannel(emitter => {
      const nativeEventEmitter = new NativeEventEmitter(NativeAppearance)
      nativeEventEmitter.addListener('appearanceChanged', ({colorScheme}) => {
        emitter(colorScheme)
      })
      return () => {}
    }, Saga.buffers.sliding(1))

    let task: any
    while (true) {
      const mode = yield Saga.take(channel)
      // iOS takes snapshots of the app in light/dark mode and this causes us to get a light/dark call no matter what. so
      // throttle a bit and ignore this
      if (task) {
        yield Saga.cancel(task)
      }
      task = yield Saga._fork(
        handleGotChangeEvent,
        ConfigGen.createSetSystemDarkMode({dark: mode === 'dark'})
      )
    }
  }
}

let locationEmitter: ((input: unknown) => void) | null = null

function* setupLocationUpdateLoop() {
  if (locationEmitter) {
    return
  }
  const locationChannel = yield Saga.eventChannel(emitter => {
    locationEmitter = emitter
    // we never unsubscribe
    return () => {}
  }, Saga.buffers.expanding(10))
  while (true) {
    const action = yield Saga.take(locationChannel)
    yield Saga.put(action)
  }
}

const setPermissionDeniedCommandStatus = (conversationIDKey: Types.ConversationIDKey, text: string) =>
  Chat2Gen.createSetCommandStatusInfo({
    conversationIDKey,
    info: {
      actions: [RPCChatTypes.UICommandStatusActionTyp.appsettings],
      displayText: text,
      displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
    },
  })

const onChatWatchPosition = async (
  action: EngineGen.Chat1ChatUiChatWatchPositionPayload,
  logger: Saga.SagaLogger
) => {
  const response = action.payload.response
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (err) {
    logger.info('failed to get location perms: ' + err)
    return setPermissionDeniedCommandStatus(
      Types.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${err.message}`
    )
  }
  const watchID = Geolocation.watchPosition(
    pos => {
      if (locationEmitter) {
        locationEmitter(
          Chat2Gen.createUpdateLastCoord({
            coord: {accuracy: pos.coords.accuracy, lat: pos.coords.latitude, lon: pos.coords.longitude},
          })
        )
      }
    },
    err => {
      logger.warn(err.message)
      if (err.code && err.code === 1 && locationEmitter) {
        locationEmitter(
          setPermissionDeniedCommandStatus(
            Types.conversationIDToKey(action.payload.params.convID),
            `Failed to access location. ${err.message}`
          )
        )
      }
    },
    {distanceFilter: 65, enableHighAccuracy: isIOS, maximumAge: isIOS ? 0 : undefined}
  )
  response.result(watchID)
  return []
}

export const clearWatchPosition = (watchID: number) => {
  Geolocation.clearWatch(watchID)
}

const onChatClearWatch = (action: EngineGen.Chat1ChatUiChatClearWatchPayload) => {
  clearWatchPosition(action.payload.params.id)
}

export const watchPositionForMap = async (errFn: () => void): Promise<number> => {
  try {
    await requestLocationPermission(RPCChatTypes.UIWatchPositionPerm.base)
  } catch (e) {
    errFn()
    return 0
  }
  const watchID = Geolocation.watchPosition(
    pos => {
      if (locationEmitter) {
        locationEmitter(
          Chat2Gen.createUpdateLastCoord({
            coord: {
              accuracy: Math.floor(pos.coords.accuracy),
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            },
          })
        )
      }
    },
    err => {
      if (err.code && err.code === 1) {
        errFn()
      }
    },
    {distanceFilter: 10, enableHighAccuracy: isIOS, maximumAge: isIOS ? 0 : undefined}
  )
  return watchID
}

const configureFileAttachmentDownloadForAndroid = () =>
  RPCChatTypes.localConfigureFileAttachmentDownloadLocalRpcPromise({
    // Android's cache dir is (when I tried) [app]/cache but Go side uses
    // [app]/.cache by default, which can't be used for sharing to other apps.
    cacheDirOverride: require('rn-fetch-blob').default.fs.dirs.CacheDir,
    downloadDirOverride: require('rn-fetch-blob').default.fs.dirs.DownloadDir,
  })

const stopAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.StopAudioRecordingPayload,
  logger: Saga.SagaLogger
) => {
  const conversationIDKey = action.payload.conversationIDKey
  if (state.chat2.audioRecording) {
    // don't do anything if we are recording and are in locked mode.
    const audio = state.chat2.audioRecording.get(conversationIDKey)
    if (audio && ChatConstants.showAudioRecording(audio) && audio.isLocked) {
      return false
    }
  }
  logger.info('stopAudioRecording: stopping recording')
  try {
    AudioRecorder.stopRecording().catch(() => {})
  } catch (e) {}
  AudioRecorder.onProgress = null

  if (!state.chat2.audioRecording) {
    return false
  }
  const audio = state.chat2.audioRecording.get(conversationIDKey)
  if (!audio) {
    logger.info('stopAudioRecording: no audio record, not sending')
    return false
  }
  if (
    audio.status === Types.AudioRecordingStatus.CANCELLED ||
    action.payload.stopType === Types.AudioStopType.CANCEL
  ) {
    logger.info('stopAudioRecording: recording cancelled, bailing out')
    await RPCChatTypes.localCancelUploadTempFileRpcPromise({outboxID: audio.outboxID})
    return false
  }
  if (ChatConstants.audioRecordingDuration(audio) < 500 || audio.path.length === 0) {
    logger.info('stopAudioRecording: recording too short, skipping')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    return Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL})
  }

  if (audio.status === Types.AudioRecordingStatus.STAGED) {
    logger.info('stopAudioRecording: in staged mode, not sending')
    return false
  }
  return Chat2Gen.createSendAudioRecording({conversationIDKey, fromStaged: false, info: audio})
}

const onAttemptAudioRecording = async (
  action: Chat2Gen.AttemptAudioRecordingPayload,
  logger: Saga.SagaLogger
) => {
  let chargeForward = true
  try {
    chargeForward = await requestAudioPermission()
  } catch (err) {
    logger.info('failed to get audio perms: ' + err)
    return setPermissionDeniedCommandStatus(
      action.payload.conversationIDKey,
      `Failed to access audio. ${err.message}`
    )
  }
  if (!chargeForward) {
    return false
  }
  return Chat2Gen.createEnableAudioRecording({
    conversationIDKey: action.payload.conversationIDKey,
    meteringCb: action.payload.meteringCb,
  })
}

const onEnableAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.EnableAudioRecordingPayload,
  logger: Saga.SagaLogger
) => {
  const conversationIDKey = action.payload.conversationIDKey
  const audio = state.chat2.audioRecording.get(conversationIDKey)
  if (!audio || ChatConstants.isCancelledAudioRecording(audio)) {
    logger.info('enableAudioRecording: no recording info set, bailing')
    return false
  }

  if (isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  } else {
    Vibration.vibrate(50)
  }
  const outboxID = ChatConstants.generateOutboxID()
  const audioPath = await RPCChatTypes.localGetUploadTempFileRpcPromise({filename: 'audio.m4a', outboxID})
  AudioRecorder.prepareRecordingAtPath(audioPath, {
    AudioEncoding: 'aac',
    AudioEncodingBitRate: 32000,
    AudioQuality: 'Low',
    Channels: 1,
    MeteringEnabled: true,
    SampleRate: 22050,
  })
  AudioRecorder.onProgress = null
  AudioRecorder.onFinished = () => {
    logger.info('onEnableAudioRecording: recording finished')
  }
  AudioRecorder.onProgress = (data: any) => {
    action.payload.meteringCb(data.currentMetering)
  }
  logger.info('onEnableAudioRecording: setting recording info')
  return Chat2Gen.createSetAudioRecordingPostInfo({conversationIDKey, outboxID, path: audioPath})
}

const onSendAudioRecording = (action: Chat2Gen.SendAudioRecordingPayload) => {
  if (!action.payload.fromStaged) {
    if (isIOS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    } else {
      Vibration.vibrate(50)
    }
  }
}

const onSetAudioRecordingPostInfo = async (
  state: Container.TypedState,
  action: Chat2Gen.SetAudioRecordingPostInfoPayload,
  logger: Saga.SagaLogger
) => {
  const audio = state.chat2.audioRecording.get(action.payload.conversationIDKey)
  if (!audio || audio.status !== Types.AudioRecordingStatus.RECORDING) {
    logger.info('onSetAudioRecordingPostInfo: not in recording mode anymore, bailing')
    return
  }
  await AudioRecorder.startRecording()
}

const onPersistRoute = async () => {
  await Container.timeoutPromise(1000)
  const path = RouterConstants.getVisiblePath()
  return ConfigGen.createPersistRoute({path})
}

function* checkNav(
  _state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  logger: Saga.SagaLogger
) {
  // have one
  if (_getNavigator()) {
    return
  }

  const name = 'mobileNav'
  const {version} = action.payload

  yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: true, name, version}))
  while (true) {
    logger.info('Waiting on nav')
    yield Saga.take(ConfigGen.setNavigator)
    if (_getNavigator()) {
      break
    }
  }
  yield Saga.put(ConfigGen.createDaemonHandshakeWait({increment: false, name, version}))
}

export function* platformConfigSaga() {
  yield* Saga.chainGenerator<ConfigGen.PersistRoutePayload>(ConfigGen.persistRoute, persistRoute)
  yield* Saga.chainAction(ConfigGen.mobileAppState, updateChangedFocus)
  yield* Saga.chainAction2(ConfigGen.openAppSettings, openAppSettings)
  yield* Saga.chainAction(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    waitForStartupDetails
  )
  yield* Saga.chainAction2(ConfigGen.openAppStore, openAppStore)
  yield* Saga.chainAction(ConfigGen.filePickerError, handleFilePickerError)
  yield* Saga.chainAction2(ProfileGen.editAvatar, editAvatar)
  yield* Saga.chainAction2(ConfigGen.loggedIn, initOsNetworkStatus)
  yield* Saga.chainAction(ConfigGen.osNetworkStatusChanged, updateMobileNetState)

  yield* Saga.chainAction(ConfigGen.showShareActionSheet, onShareAction)

  // Contacts
  yield* Saga.chainAction2(
    [SettingsGen.loadedContactImportEnabled, ConfigGen.mobileAppState],
    loadContactPermissions
  )
  yield* Saga.chainGenerator<SettingsGen.RequestContactPermissionsPayload>(
    SettingsGen.requestContactPermissions,
    requestContactPermissions
  )
  yield* Saga.chainAction2(
    [SettingsGen.loadedContactImportEnabled, EngineGen.chat1ChatUiTriggerContactSync],
    manageContactsCache
  )
  yield* Saga.chainAction(SettingsGen.showContactsJoinedModal, showContactsJoinedModal)

  // Location
  getEngine().registerCustomResponse('chat.1.chatUi.chatWatchPosition')
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatWatchPosition, onChatWatchPosition)
  yield* Saga.chainAction(EngineGen.chat1ChatUiChatClearWatch, onChatClearWatch)
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(
    ConfigGen.daemonHandshake,
    setupLocationUpdateLoop
  )
  if (isAndroid) {
    yield* Saga.chainAction2(ConfigGen.daemonHandshake, configureFileAttachmentDownloadForAndroid)
  }

  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, checkNav)

  // Audio
  yield* Saga.chainAction2(Chat2Gen.stopAudioRecording, stopAudioRecording)
  yield* Saga.chainAction(Chat2Gen.attemptAudioRecording, onAttemptAudioRecording)
  yield* Saga.chainAction2(Chat2Gen.enableAudioRecording, onEnableAudioRecording)
  yield* Saga.chainAction(Chat2Gen.sendAudioRecording, onSendAudioRecording)
  yield* Saga.chainAction2(Chat2Gen.setAudioRecordingPostInfo, onSetAudioRecordingPostInfo)
  yield* Saga.chainAction(RouteTreeGen.onNavChanged, onPersistRoute)

  // Start this immediately instead of waiting so we can do more things in parallel
  yield Saga.spawn(loadStartupDetails)
  yield Saga.spawn(pushSaga)
  yield Saga.spawn(setupNetInfoWatcher)
  yield Saga.spawn(setupDarkMode)
}
