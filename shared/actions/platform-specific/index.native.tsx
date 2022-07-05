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
import Geolocation from '@react-native-community/geolocation'
// @ts-ignore strict
import {AudioRecorder} from 'react-native-audio'
import * as Haptics from 'expo-haptics'
import {_getNavigator} from '../../constants/router2'
import type {RPCError} from '../../util/errors'
import type PermissionsType from 'expo-permissions'

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
  // TODO use expo-av etc and unify around that
  const Permissions = require('expo-permissions') as typeof PermissionsType
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
    const Permissions = require('expo-permissions') as typeof PermissionsType
    const {status, permissions} = await Permissions.getAsync(Permissions.LOCATION)
    switch (mode) {
      case RPCChatTypes.UIWatchPositionPerm.base:
        if (status === Permissions.PermissionStatus.DENIED) {
          throw new Error('Please allow Keybase to access your location in the phone settings.')
        }
        break
      case RPCChatTypes.UIWatchPositionPerm.always: {
        const perms = permissions[Permissions.LOCATION]
        if (perms?.scope !== 'always') {
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
      await NativeModules.Utils.androidUnlink?.(filePath)
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
        await NativeModules.AndroidShareFiles?.shareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch (_) {
        return {completed: false, method: ''}
      }
    }

    try {
      await NativeModules.AndroidShareFiles?.share(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch (_) {
      return {completed: false, method: ''}
    }
  }
}

const openAppSettings = async () => {
  if (isAndroid) {
    NativeModules.AndroidSettings?.open()
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
    Container.neverThrowPromiseFunc(() =>
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
  } catch (error_) {
    const error = error_ as any
    return ConfigGen.createFilePickerError({error: new Error(error)})
  }
}

const openAppStore = async () =>
  Linking.openURL(
    isAndroid
      ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
      : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
  ).catch(() => {})

const expoPermissionStatusMap = () => {
  const Permissions: typeof PermissionsType = require('expo-permissions')
  return {
    [Permissions.PermissionStatus.GRANTED]: 'granted' as const,
    [Permissions.PermissionStatus.DENIED]: 'never_ask_again' as const,
    [Permissions.PermissionStatus.UNDETERMINED]: 'undetermined' as const,
  }
}

const loadContactPermissionFromNative = async () => {
  if (isIOS) {
    const Permissions: typeof PermissionsType = require('expo-permissions')
    return expoPermissionStatusMap()[(await Permissions.getAsync(Permissions.CONTACTS)).status]
  }
  return (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_CONTACTS))
    ? 'granted'
    : 'undetermined'
}

const loadContactPermissions = async (
  state: Container.TypedState,
  action: SettingsGen.LoadedContactImportEnabledPayload | ConfigGen.MobileAppStatePayload
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
  const Permissions: typeof PermissionsType = require('expo-permissions')
  const {status} = await Permissions.askAsync(Permissions.CONTACTS)
  return expoPermissionStatusMap()[status]
}

const askForContactPermissions = async () => {
  return isAndroid ? askForContactPermissionsAndroid() : askForContactPermissionsIOS()
}

const requestContactPermissions = async (
  _: Container.TypedState,
  action: SettingsGen.RequestContactPermissionsPayload,
  listenerApi: Container.ListenerApi
) => {
  const {thenToggleImportOn} = action.payload
  listenerApi.dispatch(WaitingGen.createIncrementWaiting({key: SettingsConstants.importContactsWaitingKey}))
  const result = await askForContactPermissions()
  if (result === 'granted' && thenToggleImportOn) {
    listenerApi.dispatch(
      SettingsGen.createEditContactImportEnabled({enable: true, fromSettings: action.payload.fromSettings})
    )
  }
  listenerApi.dispatch(SettingsGen.createLoadedContactPermissions({status: result}))
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
  } catch (error_) {
    const error = error_ as RPCError
    logger.error(`error loading contacts: ${error.message}`)
    return SettingsGen.createSetContactImportedCount({error: error.message})
  }
  let defaultCountryCode: string = ''
  try {
    defaultCountryCode = await NativeModules.Utils.getDefaultCountryCode()
    if (__DEV__ && !defaultCountryCode) {
      // behavior of parsing can be unexpectedly different with no country code.
      // iOS sim + android emu don't supply country codes, so use this one.
      defaultCountryCode = 'us'
    }
  } catch (error_) {
    const error = error_ as RPCError
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
  } catch (error_) {
    const error = error_ as RPCError
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

const onChatWatchPosition = async (
  _: unknown,
  action: EngineGen.Chat1ChatUiChatWatchPositionPayload,
  listenerApi: Container.ListenerApi
) => {
  const response = action.payload.response
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (error_) {
    const error = error_ as Error
    logger.info('failed to get location perms: ' + error.message)
    return setPermissionDeniedCommandStatus(
      Types.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${error.message}`
    )
  }
  const watchID = Geolocation.watchPosition(
    pos => {
      listenerApi.dispatch(
        Chat2Gen.createUpdateLastCoord({
          coord: {accuracy: pos.coords.accuracy, lat: pos.coords.latitude, lon: pos.coords.longitude},
        })
      )
    },
    err => {
      logger.warn(err.message)
      if (err.code && err.code === 1) {
        listenerApi.dispatch(
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

const onChatClearWatch = (_: unknown, action: EngineGen.Chat1ChatUiChatClearWatchPayload) => {
  Geolocation.clearWatch(action.payload.params.id)
}

export const watchPositionForMap = async (dispatch: Container.TypedDispatch) => {
  await requestLocationPermission(RPCChatTypes.UIWatchPositionPerm.base)
  const watchID = Geolocation.watchPosition(
    pos => {
      dispatch(
        Chat2Gen.createUpdateLastCoord({
          coord: {
            accuracy: Math.floor(pos.coords.accuracy),
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          },
        })
      )
    },
    err => {
      if (err.code && err.code === 1) {
        throw new Error('watch failed')
      }
    },
    {distanceFilter: 10, enableHighAccuracy: isIOS, maximumAge: isIOS ? 0 : undefined}
  )
  return () => Geolocation.clearWatch(watchID)
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
  } catch (error_) {
    const error = error_ as RPCError
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

const onSendAudioRecording = (_: unknown, action: Chat2Gen.SendAudioRecordingPayload) => {
  if (!action.payload.fromStaged) {
    if (isIOS) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        .then(() => {})
        .catch(() => {})
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
  await AudioRecorder.startRecording()
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
