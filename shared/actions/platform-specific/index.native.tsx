import * as Chat2Gen from '../chat2-gen'
import * as Clipboard from 'expo-clipboard'
import * as ConfigConstants from '../../constants/config'
import * as ProfileConstants from '../../constants/profile'
import * as ChatConstants from '../../constants/chat2'
import * as ConfigGen from '../config-gen'
import * as Container from '../../util/container'
import * as DarkMode from '../../constants/darkmode'
import * as EngineGen from '../engine-gen-gen'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as MediaLibrary from 'expo-media-library'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouteTreeGen from '../route-tree-gen'
import * as RouterConstants from '../../constants/router2'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as Types from '../../constants/types/chat2'
import NetInfo from '@react-native-community/netinfo'
import NotifyPopup from '../../util/notify-popup'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '../../logger'
import {Alert, Linking, ActionSheetIOS} from 'react-native'
import {_getNavigator} from '../../constants/router2'
import {getEngine} from '../../engine/require'
import {isIOS, isAndroid} from '../../constants/platform'
import {launchImageLibraryAsync} from '../../util/expo-image-picker.native'
import {setupAudioMode} from '../../util/audio.native'
import {
  androidOpenSettings,
  androidShare,
  androidShareText,
  androidUnlink,
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
} from 'react-native-kb'
import {
  initPushListener,
  getStartupDetailsFromInitialPush,
  getStartupDetailsFromInitialShare,
} from './push.native'
import * as Z from '../../util/zustand'

const onLog = (_: unknown, action: EngineGen.Keybase1LogUiLogPayload) => {
  const {params} = action.payload
  const {level, text} = params
  logger.info('keybase.1.logUi.log:', params.text.data)
  if (level >= RPCTypes.LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}

export const requestPermissionsToWrite = async () => {
  if (isAndroid) {
    const p = await MediaLibrary.requestPermissionsAsync(false)
    return p.granted ? Promise.resolve() : Promise.reject('Unable to acquire storage permissions')
  }
  return Promise.resolve()
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
    try {
      // see it we can keep going anyways, android perms are needed sometimes and sometimes not w/ 33
      await requestPermissionsToWrite()
    } catch {}
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
  ConfigConstants.useConfigState.getState().dispatch.changedFocus(appFocused)
}

let _lastPersist = ''
const persistRoute = async (_state: Container.TypedState, action: ConfigGen.PersistRoutePayload) => {
  const {path} = action.payload
  let param = {}
  let routeName = Tabs.peopleTab

  if (path) {
    const cur = RouterConstants.getTab()
    if (cur) {
      routeName = cur
    }

    const ap = RouterConstants.getVisiblePath()
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
const loadStartupDetails = async () => {
  const [routeState, initialUrl, push, share] = await Promise.all([
    Container.neverThrowPromiseFunc(async () =>
      RPCTypes.configGuiGetValueRpcPromise({path: 'ui.routeState2'}).then(v => v.s || '')
    ),
    Container.neverThrowPromiseFunc(async () => Linking.getInitialURL()),
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

  let wasFromPush = false
  let conversation: Types.ConversationIDKey | undefined = undefined
  let pushPayload = ''
  let followUser = ''
  let link = ''
  let tab = ''
  let sharePath = ''
  let shareText = ''

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    wasFromPush = true
    conversation = push.startupConversation
    followUser = push.startupFollowUser ?? ''
    pushPayload = push.startupPushPayload ?? ''
  } else if (initialUrl) {
    logger.info('initialState: link', link)
    // Second priority, deep link
    link = initialUrl
  } else if (share?.fileUrl || share?.text) {
    logger.info('initialState: share')
    sharePath = share.fileUrl
    shareText = share.text
  } else if (routeState) {
    // Last priority, saved from last session
    try {
      const item = JSON.parse(routeState) as
        | undefined
        | {param?: {selectedConversationIDKey?: unknown}; routeName?: string}
      if (item) {
        const _convo = item.param?.selectedConversationIDKey || undefined
        if (typeof _convo === 'string') {
          conversation = _convo
          logger.info('initialState: routeState', conversation)
        }
        const _rn = item.routeName || undefined
        if (typeof _rn === 'string') {
          tab = _rn as any as typeof tab
        }
      }
    } catch (_) {
      logger.info('initialState: routeState parseFail')
      conversation = undefined
      tab = ''
    }
  }

  // never allow this case
  if (tab === 'blank') {
    tab = ''
  }

  const {setAndroidShare} = ConfigConstants.useConfigState.getState().dispatch

  if (sharePath) {
    setAndroidShare({type: RPCTypes.IncomingShareType.file, url: sharePath})
  } else if (shareText) {
    setAndroidShare({text: shareText, type: RPCTypes.IncomingShareType.text})
  }

  ConfigConstants.useConfigState.getState().dispatch.setStartupDetails({
    conversation: conversation ?? ChatConstants.noConversationIDKey,
    followUser,
    link,
    pushPayload,
    tab: tab as Tabs.Tab,
    wasFromPush,
  })
  afterStartupDetails(true)
}

const copyToClipboard = (_: unknown, action: ConfigGen.CopyToClipboardPayload) => {
  Clipboard.setStringAsync(action.payload.text)
    .then(() => {})
    .catch(() => {})
}

const openAppStore = async () =>
  Linking.openURL(
    isAndroid
      ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
      : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
  ).catch(() => {})

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
        accuracy: Math.floor(pos?.coords.accuracy ?? 0),
        lat: pos?.coords.latitude ?? 0,
        lon: pos?.coords.longitude ?? 0,
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
    cacheDirOverride: fsCacheDir,
    downloadDirOverride: fsDownloadDir,
  })

const onTabLongPress = (_: unknown, action: RouteTreeGen.TabLongPressPayload) => {
  if (action.payload.tab !== Tabs.peopleTab) return
  const accountRows = ConfigConstants.useConfigState.getState().configuredAccounts
  const current = ConfigConstants.useCurrentUserState.getState().username
  const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
  if (row) {
    ConfigConstants.useConfigState.getState().dispatch.setUserSwitching(true)
    ConfigConstants.useConfigState.getState().dispatch.login(row.username, '')
  }
  return
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
  const {wait} = ConfigConstants.useDaemonState.getState().dispatch
  wait(name, version, true)
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
    wait(name, version, false)
  }
}

const initAudioModes = () => {
  setupAudioMode(false)
    .then(() => {})
    .catch(() => {})
}

// if we are making the daemon wait then run this to cleanup
let afterStartupDetails = (_done: boolean) => {}

export const initPlatformListener = () => {
  Container.listenAction(ConfigGen.persistRoute, persistRoute)
  Container.listenAction(ConfigGen.mobileAppState, updateChangedFocus)
  Container.listenAction(ConfigGen.openAppSettings, openAppSettings)
  Container.listenAction(ConfigGen.copyToClipboard, copyToClipboard)
  Container.listenAction(ConfigGen.daemonHandshake, (_, action) => {
    // loadStartupDetails finished already
    if (ConfigConstants.useConfigState.getState().startup.loaded) {
      afterStartupDetails = (_done: boolean) => {}
    } else {
      // Else we have to wait for the loadStartupDetails to finish
      const {wait} = ConfigConstants.useDaemonState.getState().dispatch
      const {version} = action.payload
      const startupDetailsWaiting = 'platform.native-waitStartupDetails'
      afterStartupDetails = (done: boolean) => {
        wait(startupDetailsWaiting, version, done ? false : true)
      }
      afterStartupDetails(false)
    }
  })
  Container.listenAction(ConfigGen.openAppStore, openAppStore)

  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.onFilePickerError = error => {
      Alert.alert('Error', String(error))
    }
  })

  ProfileConstants.useState.setState(s => {
    s.dispatch.editAvatar = () => {
      const reduxDispatch = Z.getReduxDispatch()
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync('photo')
          if (!result.canceled) {
            reduxDispatch(
              RouteTreeGen.createNavigateAppend({
                path: [{props: {image: result.assets[0]}, selected: 'profileEditAvatar'}],
              })
            )
          }
        } catch (error) {
          ConfigConstants.useConfigState.getState().dispatch.filePickerError(new Error(String(error)))
        }
      }
      Z.ignorePromise(f())
    }
  })
  Container.listenAction(ConfigGen.loggedInChanged, initOsNetworkStatus)
  Container.listenAction(ConfigGen.osNetworkStatusChanged, updateMobileNetState)

  Container.listenAction(ConfigGen.showShareActionSheet, onShareAction)

  Container.listenAction(RouteTreeGen.tabLongPress, onTabLongPress)

  Container.listenAction(ConfigGen.mobileAppState, (_, action) => {
    if (action.payload.nextAppState === 'active') {
      // only reload on foreground
      SettingsConstants.useContactsState.getState().dispatch.loadContactPermissions()
    }
  })

  Container.listenAction(EngineGen.chat1ChatUiTriggerContactSync, () => {
    SettingsConstants.useContactsState.getState().dispatch.manageContactsCache()
  })

  // Location
  getEngine().registerCustomResponse('chat.1.chatUi.chatWatchPosition')
  Container.listenAction(EngineGen.chat1ChatUiChatWatchPosition, onChatWatchPosition)
  Container.listenAction(EngineGen.chat1ChatUiChatClearWatch, onChatClearWatch)
  if (isAndroid) {
    Container.listenAction(ConfigGen.daemonHandshake, configureFileAttachmentDownloadForAndroid)
  }

  Container.listenAction(ConfigGen.daemonHandshake, checkNav)
  Container.listenAction(ConfigGen.darkModePreferenceChanged, () => {
    if (isAndroid) {
      const {darkModePreference} = DarkMode.useDarkModeState.getState()
      androidAppColorSchemeChanged?.(darkModePreference ?? '')
    }
  })

  Container.listenAction(RouteTreeGen.onNavChanged, onPersistRoute)

  Container.listenAction(EngineGen.keybase1LogUiLog, onLog)

  // Start this immediately instead of waiting so we can do more things in parallel
  Container.spawn(loadStartupDetails, 'loadStartupDetails')
  initPushListener()
  Container.spawn(setupNetInfoWatcher, 'setupNetInfoWatcher')
  Container.spawn(initAudioModes, 'initAudioModes')
}
