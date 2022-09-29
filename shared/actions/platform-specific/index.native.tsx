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
import * as Tabs from '../../constants/tabs'
import * as RouteTreeGen from '../route-tree-gen'
import * as LoginGen from '../login-gen'
import * as Types from '../../constants/types/chat2'
import * as MediaLibrary from 'expo-media-library'
import type * as FsTypes from '../../constants/types/fs'
import {getEngine} from '../../engine/require'
// this CANNOT be an import *, totally screws up the packager
import {Alert, Linking, ActionSheetIOS, PermissionsAndroid, Vibration} from 'react-native'
import {NativeModules} from '../../util/native-modules.native'
import Clipboard from '@react-native-clipboard/clipboard'
import NetInfo from '@react-native-community/netinfo'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import {isIOS, isAndroid} from '../../constants/platform'
import {
  initPushListener,
  getStartupDetailsFromInitialPush,
  getStartupDetailsFromInitialShare,
} from './push.native'
import * as Container from '../../util/container'
import * as Contacts from 'expo-contacts'
import {launchImageLibraryAsync} from '../../util/expo-image-picker'
import * as Haptics from 'expo-haptics'
import {_getNavigator} from '../../constants/router2'
import {Audio} from 'expo-av'
import * as ExpoLocation from 'expo-location'
import * as FileSystem from 'expo-file-system'
import * as ExpoTaskManager from 'expo-task-manager'
import {
  getDefaultCountryCode,
  androidOpenSettings,
  androidShare,
  androidShareText,
  androidUnlink,
} from 'react-native-kb'

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
  let {status} = await Audio.getPermissionsAsync()
  if (status === Audio.PermissionStatus.UNDETERMINED) {
    const askRes = await Audio.requestPermissionsAsync()
    status = askRes.status
    chargeForward = false
  }
  if (status === Audio.PermissionStatus.DENIED) {
    throw new Error('Please allow Keybase to access the microphone in the phone settings.')
  }
  return chargeForward
}

export const requestLocationPermission = async (mode: RPCChatTypes.UIWatchPositionPerm) => {
  if (isIOS) {
    switch (mode) {
      case RPCChatTypes.UIWatchPositionPerm.base:
        {
          const iosFGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
          if (iosFGPerms.ios?.scope === 'none') {
            throw new Error('Please allow Keybase to access your location in the phone settings.')
          }
        }
        break
      case RPCChatTypes.UIWatchPositionPerm.always: {
        const iosBGPerms = await ExpoLocation.requestBackgroundPermissionsAsync()
        if (iosBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
          throw new Error(
            'Please allow Keybase to access your location even if the app is not running for live location.'
          )
        }
        break
      }
    }
  } else if (isAndroid) {
    const androidBGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
    if (androidBGPerms.status !== ExpoLocation.PermissionStatus.GRANTED) {
      throw new Error('Unable to acquire location permissions')
    }
  }
}

export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  const fileURL = 'file://' + filePath
  const saveType: 'video' | 'photo' = mimeType.startsWith('video') ? 'video' : 'photo'
  const logPrefix = '[saveAttachmentToCameraRoll] '
  try {
    await requestPermissionsToWrite()
    logger.info(logPrefix + `Attempting to save as ${saveType}`)
    await MediaLibrary.saveToLibraryAsync(fileURL)
    logger.info(logPrefix + 'Success')
  } catch (e) {
    // This can fail if the user backgrounds too quickly, so throw up a local notification
    // just in case to get their attention.
    isIOS &&
      PushNotificationIOS.addNotificationRequest({
        body: `Failed to save ${saveType} to camera roll`,
        id: Math.floor(Math.random() * Math.pow(2, 32)).toString(),
      })
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    try {
      await androidUnlink(filePath)
    } catch (_) {
      logger.warn('failed to unlink')
    }
  }
}

const onShareAction = async (_: unknown, action: ConfigGen.ShowShareActionSheetPayload) => {
  const {filePath, message, mimeType} = action.payload
  await showShareActionSheet({filePath, message, mimeType})
}

export const showShareActionSheet = async (options: {
  filePath?: string
  message?: string
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
        await androidShareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (_) {
        return {completed: false, method: ''}
      }
    }

    try {
      await androidShare(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch (_) {
      return {completed: false, method: ''}
    }
  }
}

const openAppSettings = async () => {
  if (isAndroid) {
    androidOpenSettings()
  } else {
    const settingsURL = 'app-settings:'
    const can = await Linking.canOpenURL(settingsURL)
    if (can) {
      return Linking.openURL(settingsURL)
    } else {
      logger.warn('Unable to open app settings')
    }
  }
}

const updateChangedFocus = (_: unknown, action: ConfigGen.MobileAppStatePayload) => {
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
      appFocused = false
      logState = RPCTypes.MobileAppState.foreground
  }

  logger.info(`setting app state on service to: ${logState}`)
  return ConfigGen.createChangedFocus({appFocused})
}

let _lastPersist = ''
const persistRoute = async (_state: Container.TypedState, action: ConfigGen.PersistRoutePayload) => {
  const path = action.payload.path
  let param = {}
  let routeName = Tabs.peopleTab

  if (path) {
    const cur = RouterConstants.getCurrentTab()
    if (cur) {
      routeName = cur
    }

    const ap = RouterConstants.getAppPath()
    ap.some(r => {
      if (r.name == 'chatConversation') {
        param = {
          // @ts-ignore TODO better param typing
          selectedConversationIDKey: r.params?.conversationIDKey as Types.ConversationIDKey | undefined,
        }
        return true
      }
      return false
    })
  }

  const s = JSON.stringify({param, routeName})
  // don't keep rewriting
  if (_lastPersist === s) {
    return
  }
  await RPCTypes.configGuiSetValueRpcPromise({
    path: 'ui.routeState2',
    value: {isNull: false, s},
  })
  _lastPersist = s
}

// only send when different, we get called a bunch where this doesn't actually change
let _lastNetworkType: ConfigGen.OsNetworkStatusChangedPayload['payload']['type'] | undefined
const updateMobileNetState = async (_: unknown, action: ConfigGen.OsNetworkStatusChangedPayload) => {
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

const setupNetInfoWatcher = (listenerApi: Container.ListenerApi) => {
  NetInfo.addEventListener(({type}) => {
    listenerApi.dispatch(ConfigGen.createOsNetworkStatusChanged({online: type !== 'none', type}))
  })
}

// TODO rewrite this, v slow
const loadStartupDetails = async (listenerApi: Container.ListenerApi) => {
  let startupWasFromPush = false
  let startupConversation: Types.ConversationIDKey | undefined = undefined
  let startupPushPayload: string | undefined = undefined
  let startupFollowUser: string = ''
  let startupLink: string = ''
  let startupTab: Tabs.Tab | 'blank' | undefined = undefined
  let startupSharePath: FsTypes.LocalPath | undefined = undefined
  let startupShareText: string | undefined = undefined

  const [routeState, link, push, share] = await Promise.all([
    Container.neverThrowPromiseFunc(async () =>
      RPCTypes.configGuiGetValueRpcPromise({path: 'ui.routeState2'}).then(v => v.s || '')
    ),
    Container.neverThrowPromiseFunc(Linking.getInitialURL),
    Container.neverThrowPromiseFunc(getStartupDetailsFromInitialPush),
    Container.neverThrowPromiseFunc(getStartupDetailsFromInitialShare),
  ] as const)
  logger.info('routeState load', routeState)

  // Clear last value to be extra safe bad things don't hose us forever
  try {
    await RPCTypes.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    })
  } catch (_) {}

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    startupWasFromPush = true
    startupConversation = push.startupConversation
    startupFollowUser = push.startupFollowUser ?? ''
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

  // never allow this case
  if (startupTab === 'blank') {
    startupTab = undefined
  }

  listenerApi.dispatch(
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

const waitForStartupDetails = async (
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  // loadStartupDetails finished already
  if (state.config.startupDetailsLoaded) {
    return
  }
  // Else we have to wait for the loadStartupDetails to finish
  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({
      increment: true,
      name: 'platform.native-waitStartupDetails',
      version: action.payload.version,
    })
  )
  await listenerApi.take(action => action.type === ConfigGen.setStartupDetails)
  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({
      increment: false,
      name: 'platform.native-waitStartupDetails',
      version: action.payload.version,
    })
  )
}

const copyToClipboard = (_: unknown, action: ConfigGen.CopyToClipboardPayload) => {
  Clipboard.setString(action.payload.text)
}

const handleFilePickerError = (_: unknown, action: ConfigGen.FilePickerErrorPayload) => {
  Alert.alert('Error', action.payload.error.message)
}

const editAvatar = async () => {
  try {
    const result = await launchImageLibraryAsync('photo')
    return result.cancelled
      ? null
      : RouteTreeGen.createNavigateAppend({
          path: [{props: {image: result}, selected: 'profileEditAvatar'}],
        })
  } catch (error) {
    return ConfigGen.createFilePickerError({error: new Error(error as any)})
  }
}

const openAppStore = async () =>
  Linking.openURL(
    isAndroid
      ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
      : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
  ).catch(() => {})

const loadContactPermissions = async (
  _s: unknown,
  action: SettingsGen.LoadedContactImportEnabledPayload | ConfigGen.MobileAppStatePayload
) => {
  if (action.type === ConfigGen.mobileAppState && action.payload.nextAppState !== 'active') {
    // only reload on foreground
    return
  }
  const {status} = await Contacts.getPermissionsAsync()
  logger.info(`OS status: ${status}`)
  return SettingsGen.createLoadedContactPermissions({status})
}

const requestContactPermissions = async (
  _: Container.TypedState,
  action: SettingsGen.RequestContactPermissionsPayload,
  listenerApi: Container.ListenerApi
) => {
  const {thenToggleImportOn} = action.payload
  listenerApi.dispatch(WaitingGen.createIncrementWaiting({key: SettingsConstants.importContactsWaitingKey}))
  const {status} = await Contacts.requestPermissionsAsync()

  if (status === Contacts.PermissionStatus.GRANTED && thenToggleImportOn) {
    listenerApi.dispatch(
      SettingsGen.createEditContactImportEnabled({enable: true, fromSettings: action.payload.fromSettings})
    )
  }
  listenerApi.dispatch(SettingsGen.createLoadedContactPermissions({status}))
  listenerApi.dispatch(WaitingGen.createDecrementWaiting({key: SettingsConstants.importContactsWaitingKey}))
}

const manageContactsCache = async (
  state: Container.TypedState,
  _action: SettingsGen.LoadedContactImportEnabledPayload | EngineGen.Chat1ChatUiTriggerContactSyncPayload
) => {
  if (state.settings.contacts.importEnabled === false) {
    await RPCTypes.contactsSaveContactListRpcPromise({contacts: []})
    return SettingsGen.createSetContactImportedCount({})
  }

  // get permissions if we haven't loaded them for some reason
  let {permissionStatus} = state.settings.contacts
  if (permissionStatus === 'unknown') {
    permissionStatus = (await Contacts.getPermissionsAsync()).status
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
  } catch (_error) {
    const error = _error as any
    logger.error(`error loading contacts: ${error.message}`)
    return SettingsGen.createSetContactImportedCount({error: error.message})
  }
  let defaultCountryCode: string = ''
  try {
    defaultCountryCode = await getDefaultCountryCode()
    if (__DEV__ && !defaultCountryCode) {
      // behavior of parsing can be unexpectedly different with no country code.
      // iOS sim + android emu don't supply country codes, so use this one.
      defaultCountryCode = 'us'
    }
  } catch (_error) {
    const error = _error as any
    logger.warn(`Error loading default country code: ${error.message}`)
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
      isIOS &&
        PushNotificationIOS.addNotificationRequest({
          body: PushConstants.makeContactsResolvedMessage(newlyResolved),
          id: Math.floor(Math.random() * Math.pow(2, 32)).toString(),
        })
    }
    if (state.settings.contacts.waitingToShowJoinedModal && resolved) {
      actions.push(SettingsGen.createShowContactsJoinedModal({resolved}))
    }
  } catch (_error) {
    const error = _error as any
    logger.error('Error saving contacts list: ', error.message)
    actions.push(SettingsGen.createSetContactImportedCount({error: error.message}))
  }
  return actions
}

const showContactsJoinedModal = (_: unknown, action: SettingsGen.ShowContactsJoinedModalPayload) =>
  action.payload.resolved.length
    ? [RouteTreeGen.createNavigateAppend({path: ['settingsContactsJoined']})]
    : []

const setPermissionDeniedCommandStatus = (conversationIDKey: Types.ConversationIDKey, text: string) =>
  Chat2Gen.createSetCommandStatusInfo({
    conversationIDKey,
    info: {
      actions: [RPCChatTypes.UICommandStatusActionTyp.appsettings],
      displayText: text,
      displayType: RPCChatTypes.UICommandStatusDisplayTyp.error,
    },
  })

const onChatWatchPosition = async (_: unknown, action: EngineGen.Chat1ChatUiChatWatchPositionPayload) => {
  const response = action.payload.response
  response.result(0)
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (_error) {
    const error = _error as any
    logger.info('failed to get location perms: ' + error.message)
    return setPermissionDeniedCommandStatus(
      Types.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${error.message}`
    )
  }

  locationRefs++

  if (locationRefs === 1) {
    try {
      logger.info('location start')
      await ExpoLocation.startLocationUpdatesAsync(locationTaskName, {
        deferredUpdatesDistance: 65,
        pausesUpdatesAutomatically: true,
      })
      logger.info('location start success')
    } catch {
      logger.info('location start failed')
      locationRefs--
    }
  }
  return []
}

const onChatClearWatch = async () => {
  locationRefs--
  if (locationRefs <= 0) {
    try {
      logger.info('location end start')
      await ExpoLocation.stopLocationUpdatesAsync(locationTaskName)
      logger.info('location end success')
    } catch {
      logger.info('location end failed')
    }
  }
}

const locationTaskName = 'background-location-task'
let locationRefs = 0
ExpoTaskManager.defineTask(locationTaskName, ({data, error}) => {
  if (error) {
    // check `error.message` for more details.
    return
  }

  if (!data) {
    return
  }
  const locations = (data as any).locations as Array<ExpoLocation.LocationObject>
  if (!locations.length) {
    return
  }
  const pos = locations[locations.length - 1]

  // a hack to get a naked dispatch instead of storing it multiple times, just reach in here
  // @ts-ignore
  getEngine()._dispatch(
    Chat2Gen.createUpdateLastCoord({
      coord: {
        accuracy: Math.floor(pos.coords.accuracy ?? 0),
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
      },
    })
  )
})

export const watchPositionForMap = async (
  dispatch: Container.TypedDispatch,
  conversationIDKey: Types.ConversationIDKey
) => {
  try {
    logger.info('location perms check')
    await requestLocationPermission(RPCChatTypes.UIWatchPositionPerm.base)
  } catch (_error) {
    const error = _error as any
    logger.info('failed to get location perms: ' + error.message)
    dispatch(
      setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
    )
    return () => {}
  }

  try {
    const sub = await ExpoLocation.watchPositionAsync(
      {accuracy: ExpoLocation.LocationAccuracy.Highest},
      location => {
        const coord = {
          accuracy: Math.floor(location.coords.accuracy ?? 0),
          lat: location.coords.latitude,
          lon: location.coords.longitude,
        }
        dispatch(Chat2Gen.createUpdateLastCoord({coord}))
      }
    )
    return () => sub.remove()
  } catch (_error) {
    const error = _error as any
    logger.info('failed to get location: ' + error.message)
    dispatch(
      setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
    )
    return () => {}
  }
}

const configureFileAttachmentDownloadForAndroid = async () =>
  RPCChatTypes.localConfigureFileAttachmentDownloadLocalRpcPromise({
    // Android's cache dir is (when I tried) [app]/cache but Go side uses
    // [app]/.cache by default, which can't be used for sharing to other apps.
    cacheDirOverride: NativeModules.KeybaseEngine.fsCacheDir,
    downloadDirOverride: NativeModules.KeybaseEngine.fsDownloadDir,
  })

const stopAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.StopAudioRecordingPayload
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
  recording?.setOnRecordingStatusUpdate(null)
  try {
    await recording?.stopAndUnloadAsync()
  } catch (e) {
    console.log('Recoding stopping fail', e)
  } finally {
    recording = undefined
  }

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
    try {
      if (audio.path) {
        await FileSystem.deleteAsync(audio.path, {idempotent: true})
      }
    } catch (e) {
      console.log('Recording delete failed', e)
    }
    return false
  }
  if (ChatConstants.audioRecordingDuration(audio) < 500 || audio.path.length === 0) {
    logger.info('stopAudioRecording: recording too short, skipping')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      .then(() => {})
      .catch(() => {})
    return Chat2Gen.createStopAudioRecording({conversationIDKey, stopType: Types.AudioStopType.CANCEL})
  }

  if (audio.status === Types.AudioRecordingStatus.STAGED) {
    logger.info('stopAudioRecording: in staged mode, not sending')
    return false
  }

  return Chat2Gen.createSendAudioRecording({conversationIDKey, fromStaged: false, info: audio})
}

const onAttemptAudioRecording = async (_: unknown, action: Chat2Gen.AttemptAudioRecordingPayload) => {
  let chargeForward = true
  try {
    chargeForward = await requestAudioPermission()
  } catch (_error) {
    const error = _error as any
    logger.info('failed to get audio perms: ' + error.message)
    return setPermissionDeniedCommandStatus(
      action.payload.conversationIDKey,
      `Failed to access audio. ${error.message}`
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

let recording: Audio.Recording | undefined
const onEnableAudioRecording = async (
  state: Container.TypedState,
  action: Chat2Gen.EnableAudioRecordingPayload
) => {
  const conversationIDKey = action.payload.conversationIDKey
  const audio = state.chat2.audioRecording.get(conversationIDKey)
  if (!audio || ChatConstants.isCancelledAudioRecording(audio)) {
    logger.info('enableAudioRecording: no recording info set, bailing')
    return false
  }

  if (isIOS) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      .then(() => {})
      .catch(() => {})
  } else {
    Vibration.vibrate(50)
  }
  const outboxID = ChatConstants.generateOutboxID()
  if (recording) {
    try {
      recording?.setOnRecordingStatusUpdate(null)
    } catch {}
    try {
      await recording?.stopAndUnloadAsync()
    } catch {}
    recording = undefined
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
    interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
    playThroughEarpieceAndroid: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    staysActiveInBackground: false,
  })
  const r = new Audio.Recording()
  await r.prepareToRecordAsync({
    android: {
      audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
      bitRate: 32000,
      extension: '.m4a',
      numberOfChannels: 1,
      outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
      sampleRate: 22050,
    },
    ios: {
      audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MIN,
      bitRate: 32000,
      extension: '.m4a',
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
      numberOfChannels: 1,
      outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
      sampleRate: 22050,
    },
    isMeteringEnabled: true,
    web: {},
  })
  const audioPath = r.getURI()?.substring('file://'.length)
  if (!audioPath) {
    throw new Error("Couldn't start audio recording")
  }
  recording = r
  recording?.setProgressUpdateInterval(100)
  recording?.setOnRecordingStatusUpdate((status: Audio.RecordingStatus) => {
    status.metering !== undefined && action.payload.meteringCb(status.metering)
  })
  logger.info('onEnableAudioRecording: setting recording info')
  return Chat2Gen.createSetAudioRecordingPostInfo({conversationIDKey, outboxID, path: audioPath})
}

const onSendAudioRecording = async (_: unknown, action: Chat2Gen.SendAudioRecordingPayload) => {
  if (!action.payload.fromStaged) {
    if (isIOS) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      } catch {}
    } else {
      Vibration.vibrate(50)
    }
  }
}

const onTabLongPress = (state: Container.TypedState, action: RouteTreeGen.TabLongPressPayload) => {
  if (action.payload.tab !== Tabs.peopleTab) return
  const accountRows = state.config.configuredAccounts
  const current = state.config.username
  const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
  if (row) {
    return [
      ConfigGen.createSetUserSwitching({userSwitching: true}),
      LoginGen.createLogin({password: new Container.HiddenString(''), username: row.username}),
    ]
  }
  return undefined
}

const onSetAudioRecordingPostInfo = async (
  state: Container.TypedState,
  action: Chat2Gen.SetAudioRecordingPostInfoPayload
) => {
  const audio = state.chat2.audioRecording.get(action.payload.conversationIDKey)
  if (!audio || audio.status !== Types.AudioRecordingStatus.RECORDING) {
    logger.info('onSetAudioRecordingPostInfo: not in recording mode anymore, bailing')
    return
  }
  await recording?.startAsync()
}

const onPersistRoute = async () => {
  await Container.timeoutPromise(1000)
  const path = RouterConstants.getVisiblePath()
  return ConfigGen.createPersistRoute({path})
}

const checkNav = async (
  _state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  // have one
  if (_getNavigator()) {
    return
  }

  const name = 'mobileNav'
  const {version} = action.payload

  listenerApi.dispatch(ConfigGen.createDaemonHandshakeWait({increment: true, name, version}))
  try {
    // eslint-disable-next-line
    while (true) {
      logger.info('Waiting on nav')
      await listenerApi.take(action => action.type === ConfigGen.setNavigator)
      if (_getNavigator()) {
        break
      }
      logger.info('Waiting on nav, got setNavigator but nothing in constants?')
    }
  } finally {
    listenerApi.dispatch(ConfigGen.createDaemonHandshakeWait({increment: false, name, version}))
  }
}

const notifyNativeOfDarkModeChange = (state: Container.TypedState) => {
  if (isAndroid) {
    NativeModules.KeybaseEngine.androidAppColorSchemeChanged?.(state.config.darkModePreference ?? '')
  }
}

export const initPlatformListener = () => {
  Container.listenAction(ConfigGen.persistRoute, persistRoute)
  Container.listenAction(ConfigGen.mobileAppState, updateChangedFocus)
  Container.listenAction(ConfigGen.openAppSettings, openAppSettings)
  Container.listenAction(ConfigGen.copyToClipboard, copyToClipboard)
  Container.listenAction(ConfigGen.daemonHandshake, waitForStartupDetails)
  Container.listenAction(ConfigGen.openAppStore, openAppStore)
  Container.listenAction(ConfigGen.filePickerError, handleFilePickerError)
  Container.listenAction(ProfileGen.editAvatar, editAvatar)
  Container.listenAction(ConfigGen.loggedIn, initOsNetworkStatus)
  Container.listenAction(ConfigGen.osNetworkStatusChanged, updateMobileNetState)

  Container.listenAction(ConfigGen.showShareActionSheet, onShareAction)

  Container.listenAction(RouteTreeGen.tabLongPress, onTabLongPress)

  // Contacts
  Container.listenAction(
    [SettingsGen.loadedContactImportEnabled, ConfigGen.mobileAppState],
    loadContactPermissions
  )

  Container.listenAction(SettingsGen.requestContactPermissions, requestContactPermissions)
  Container.listenAction(
    [SettingsGen.loadedContactImportEnabled, EngineGen.chat1ChatUiTriggerContactSync],
    manageContactsCache
  )
  Container.listenAction(SettingsGen.showContactsJoinedModal, showContactsJoinedModal)

  // Location
  getEngine().registerCustomResponse('chat.1.chatUi.chatWatchPosition')
  Container.listenAction(EngineGen.chat1ChatUiChatWatchPosition, onChatWatchPosition)
  Container.listenAction(EngineGen.chat1ChatUiChatClearWatch, onChatClearWatch)
  if (isAndroid) {
    Container.listenAction(ConfigGen.daemonHandshake, configureFileAttachmentDownloadForAndroid)
  }

  Container.listenAction(ConfigGen.daemonHandshake, checkNav)
  Container.listenAction(ConfigGen.setDarkModePreference, notifyNativeOfDarkModeChange)

  // Audio
  Container.listenAction(Chat2Gen.stopAudioRecording, stopAudioRecording)
  Container.listenAction(Chat2Gen.attemptAudioRecording, onAttemptAudioRecording)
  Container.listenAction(Chat2Gen.enableAudioRecording, onEnableAudioRecording)
  Container.listenAction(Chat2Gen.sendAudioRecording, onSendAudioRecording)
  Container.listenAction(Chat2Gen.setAudioRecordingPostInfo, onSetAudioRecordingPostInfo)
  Container.listenAction(RouteTreeGen.onNavChanged, onPersistRoute)

  // Start this immediately instead of waiting so we can do more things in parallel
  Container.spawn(loadStartupDetails, 'loadStartupDetails')
  initPushListener()
  Container.spawn(setupNetInfoWatcher, 'setupNetInfoWatcher')
}
