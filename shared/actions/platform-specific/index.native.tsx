import * as Chat2Gen from '../chat2-gen'
import * as Clipboard from 'expo-clipboard'
import * as ConfigConstants from '../../constants/config'
import * as ProfileConstants from '../../constants/profile'
import * as ChatConstants from '../../constants/chat2'
import * as Container from '../../util/container'
import * as DarkMode from '../../constants/darkmode'
import * as EngineGen from '../engine-gen-gen'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as MediaLibrary from 'expo-media-library'
import * as RPCChatTypes from '../../constants/types/rpc-chat-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as RouterConstants from '../../constants/router2'
import * as SettingsConstants from '../../constants/settings'
import * as Tabs from '../../constants/tabs'
import * as Types from '../../constants/types/chat2'
import NetInfo from '@react-native-community/netinfo'
import NotifyPopup from '../../util/notify-popup'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '../../logger'
import {Alert, Linking, ActionSheetIOS} from 'react-native'
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

const initAudioModes = () => {
  setupAudioMode(false)
    .then(() => {})
    .catch(() => {})
}

// if we are making the daemon wait then run this to cleanup
let afterStartupDetails = (_done: boolean) => {}

export const initPlatformListener = () => {
  let _lastPersist = ''
  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.persistRoute = (path?: Array<any>) => {
      const f = async () => {
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
      Z.ignorePromise(f())
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    let appFocused: boolean
    let logState: RPCTypes.MobileAppState
    switch (s.mobileAppState) {
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
  })

  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.copyToClipboard = s => {
      Clipboard.setStringAsync(s)
        .then(() => {})
        .catch(() => {})
    }
  })

  ConfigConstants.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return

    // loadStartupDetails finished already
    if (ConfigConstants.useConfigState.getState().startup.loaded) {
      afterStartupDetails = (_done: boolean) => {}
    } else {
      // Else we have to wait for the loadStartupDetails to finish
      const {wait} = ConfigConstants.useDaemonState.getState().dispatch
      const version = s.handshakeVersion
      const startupDetailsWaiting = 'platform.native-waitStartupDetails'
      afterStartupDetails = (done: boolean) => {
        wait(startupDetailsWaiting, version, done ? false : true)
      }
      afterStartupDetails(false)
    }

    if (isAndroid) {
      Container.ignorePromise(
        RPCChatTypes.localConfigureFileAttachmentDownloadLocalRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
      )
    }
  })

  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.onFilePickerError = error => {
      Alert.alert('Error', String(error))
    }
    s.dispatch.dynamic.openAppStore = () => {
      Linking.openURL(
        isAndroid
          ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
          : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
      ).catch(() => {})
    }
  })

  ProfileConstants.useState.setState(s => {
    s.dispatch.editAvatar = () => {
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync('photo')
          if (!result.canceled) {
            RouterConstants.useState
              .getState()
              .dispatch.navigateAppend({props: {image: result.assets[0]}, selected: 'profileEditAvatar'})
          }
        } catch (error) {
          ConfigConstants.useConfigState.getState().dispatch.filePickerError(new Error(String(error)))
        }
      }
      Z.ignorePromise(f())
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const f = async () => {
      const {type} = await NetInfo.fetch()
      ConfigConstants.useConfigState.getState().dispatch.osNetworkStatusChanged(type !== 'none', type, true)
    }
    Z.ignorePromise(f())
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    const type = s.networkStatus?.type
    if (!type) return
    const f = async () => {
      try {
        await RPCTypes.appStateUpdateMobileNetStateRpcPromise({state: type})
      } catch (err) {
        console.warn('Error sending mobileNetStateUpdate', err)
      }
    }
    Z.ignorePromise(f())
  })

  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.showShareActionSheet = (filePath: string, message: string, mimeType: string) => {
      const f = async () => {
        await showShareActionSheet({filePath, message, mimeType})
      }
      Z.ignorePromise(f())
    }
  })

  ConfigConstants.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'active') {
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
    DarkMode.useDarkModeState.subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      const {darkModePreference} = DarkMode.useDarkModeState.getState()
      androidAppColorSchemeChanged?.(darkModePreference)
    })
  }

  RouterConstants.useState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    const f = async () => {
      await Container.timeoutPromise(1000)
      const path = RouterConstants.getVisiblePath()
      ConfigConstants.useConfigState.getState().dispatch.dynamic.persistRoute?.(path)
    }
    Z.ignorePromise(f())
  })

  Container.listenAction(EngineGen.keybase1LogUiLog, onLog)

  // Start this immediately instead of waiting so we can do more things in parallel
  Container.spawn(loadStartupDetails, 'loadStartupDetails')
  initPushListener()

  NetInfo.addEventListener(({type}) => {
    ConfigConstants.useConfigState.getState().dispatch.osNetworkStatusChanged(type !== 'none', type)
  })
  Container.spawn(initAudioModes, 'initAudioModes')

  ConfigConstants.useConfigState.setState(s => {
    s.dispatch.dynamic.openAppSettings = () => {
      const f = async () => {
        if (isAndroid) {
          androidOpenSettings()
        } else {
          const settingsURL = 'app-settings:'
          const can = await Linking.canOpenURL(settingsURL)
          if (can) {
            await Linking.openURL(settingsURL)
          } else {
            logger.warn('Unable to open app settings')
          }
        }
      }
      Container.ignorePromise(f())
    }
  })

  RouterConstants.useState.setState(s => {
    s.dispatch.dynamic.tabLongPress = tab => {
      if (tab !== Tabs.peopleTab) return
      const accountRows = ConfigConstants.useConfigState.getState().configuredAccounts
      const current = ConfigConstants.useCurrentUserState.getState().username
      const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
      if (row) {
        ConfigConstants.useConfigState.getState().dispatch.setUserSwitching(true)
        ConfigConstants.useConfigState.getState().dispatch.login(row.username, '')
      }
    }
  })
}
