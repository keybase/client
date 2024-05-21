import * as C from '..'
import * as T from '../types'
import * as Clipboard from 'expo-clipboard'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import * as MediaLibrary from 'expo-media-library'
import * as Tabs from '../tabs'
import * as NetInfo from '@react-native-community/netinfo'
import NotifyPopup from '@/util/notify-popup'
import PushNotificationIOS from '@react-native-community/push-notification-ios'
import logger from '@/logger'
import {Alert, Linking, ActionSheetIOS} from 'react-native'
import {isIOS, isAndroid} from '../platform'
import {launchImageLibraryAsync} from '@/util/expo-image-picker.native'
import {setupAudioMode} from '@/util/audio.native'
import {
  androidOpenSettings,
  androidShare,
  androidShareText,
  androidUnlink,
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
  guiConfig,
} from 'react-native-kb'
import {
  initPushListener,
  getStartupDetailsFromInitialPush,
  getStartupDetailsFromInitialShare,
} from './push.native'

export const requestPermissionsToWrite = async () => {
  if (isAndroid) {
    const p = await MediaLibrary.requestPermissionsAsync(false)
    return p.granted ? Promise.resolve() : Promise.reject(new Error('Unable to acquire storage permissions'))
  }
  return Promise.resolve()
}

export const requestLocationPermission = async (mode: T.RPCChat.UIWatchPositionPerm) => {
  if (isIOS) {
    logger.info('[location] Requesting location perms', mode)
    switch (mode) {
      case T.RPCChat.UIWatchPositionPerm.base:
        {
          const iosFGPerms = await ExpoLocation.requestForegroundPermissionsAsync()
          if (iosFGPerms.ios?.scope === 'none') {
            throw new Error('Please allow Keybase to access your location in the phone settings.')
          }
        }
        break
      case T.RPCChat.UIWatchPositionPerm.always: {
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
        id: Math.floor(Math.random() * 2 ** 32).toString(),
      })
    logger.debug(logPrefix + 'failed to save: ' + e)
    throw e
  } finally {
    try {
      await androidUnlink(filePath)
    } catch {
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
    return new Promise((resolve, reject) => {
      ActionSheetIOS.showShareActionSheetWithOptions(
        {
          message: options.message,
          url: options.filePath,
        },
        reject,
        resolve
      )
    })
  } else {
    if (!options.filePath && options.message) {
      try {
        await androidShareText(options.message, options.mimeType)
        return {completed: true, method: ''}
      } catch {
        return {completed: false, method: ''}
      }
    }

    try {
      await androidShare(options.filePath ?? '', options.mimeType)
      return {completed: true, method: ''}
    } catch {
      return {completed: false, method: ''}
    }
  }
}

// TODO rewrite this, v slow
const loadStartupDetails = async () => {
  const [routeState, initialUrl, push, share] = await Promise.all([
    C.neverThrowPromiseFunc(async () => {
      try {
        const config = JSON.parse(guiConfig) as {ui?: {routeState2?: string}} | undefined
        return Promise.resolve(config?.ui?.routeState2 ?? '')
      } catch {
        return Promise.resolve('')
      }
    }),
    C.neverThrowPromiseFunc(async () => Linking.getInitialURL()),
    C.neverThrowPromiseFunc(getStartupDetailsFromInitialPush),
    C.neverThrowPromiseFunc(getStartupDetailsFromInitialShare),
  ] as const)

  // Clear last value to be extra safe bad things don't hose us forever
  try {
    await T.RPCGen.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    })
  } catch {}

  let conversation: T.Chat.ConversationIDKey | undefined
  let followUser = ''
  let link = ''
  let tab = ''
  let sharePaths = new Array<string>()
  let shareText = ''

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    conversation = push.startupConversation
    followUser = push.startupFollowUser ?? ''
  } else if (initialUrl) {
    logger.info('initialState: link', link)
    // Second priority, deep link
    link = initialUrl
  } else if (share?.fileUrls || share?.text) {
    logger.info('initialState: share')
    sharePaths = share.fileUrls
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
    } catch {
      logger.info('initialState: routeState parseFail')
      conversation = undefined
      tab = ''
    }
  }

  // never allow this case
  if (tab === 'blank') {
    tab = ''
  }

  const {setAndroidShare} = C.useConfigState.getState().dispatch

  if (sharePaths.length) {
    setAndroidShare({type: T.RPCGen.IncomingShareType.file, urls: sharePaths})
  } else if (shareText) {
    setAndroidShare({text: shareText, type: T.RPCGen.IncomingShareType.text})
  }

  C.useConfigState.getState().dispatch.setStartupDetails({
    conversation: conversation ?? C.Chat.noConversationIDKey,
    followUser,
    link,
    tab: tab as Tabs.Tab,
  })

  afterStartupDetails(false)
}

const setPermissionDeniedCommandStatus = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  C.getConvoState(conversationIDKey).dispatch.setCommandStatusInfo({
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: text,
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  })
}

const onChatWatchPosition = async (action: EngineGen.Chat1ChatUiChatWatchPositionPayload) => {
  const response = action.payload.response
  response.result(0)
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location perms: ' + error.message)
    setPermissionDeniedCommandStatus(
      T.Chat.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${error.message}`
    )
  }

  locationRefs++

  if (locationRefs === 1) {
    try {
      logger.info(
        '[location] location watch start due to ',
        T.Chat.conversationIDToKey(action.payload.params.convID)
      )
      ensureBackgroundTask()
      await ExpoLocation.startLocationUpdatesAsync(locationTaskName, {
        deferredUpdatesDistance: 65,
        pausesUpdatesAutomatically: true,
        showsBackgroundLocationIndicator: true,
      })
      logger.info('[location] start success')
    } catch {
      logger.info('[location] start failed')
      locationRefs--
    }
  }
}

const onChatClearWatch = async () => {
  locationRefs--
  if (locationRefs <= 0) {
    try {
      logger.info('[location] end start')
      ensureBackgroundTask()
      await ExpoLocation.stopLocationUpdatesAsync(locationTaskName)
      logger.info('[location] end success')
    } catch {
      logger.info('[location] end failed')
    }
  }
}

const locationTaskName = 'background-location-task'
let locationRefs = 0
let madeBackgroundTask = false

const ensureBackgroundTask = () => {
  if (madeBackgroundTask) return
  madeBackgroundTask = true

  ExpoTaskManager.defineTask(locationTaskName, ({data, error}) => {
    if (error) {
      // check `error.message` for more details.
      return
    }

    if (!data) {
      return
    }
    const d = data as {locations?: Array<ExpoLocation.LocationObject>}
    const locations = d.locations
    if (!locations?.length) {
      return
    }
    const pos = locations.at(-1)
    const coord = {
      accuracy: Math.floor(pos?.coords.accuracy ?? 0),
      lat: pos?.coords.latitude ?? 0,
      lon: pos?.coords.longitude ?? 0,
    }

    C.useChatState.getState().dispatch.updateLastCoord(coord)
  })
}

export const watchPositionForMap = async (conversationIDKey: T.Chat.ConversationIDKey) => {
  try {
    logger.info('[location] perms check due to map')
    await requestLocationPermission(T.RPCChat.UIWatchPositionPerm.base)
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location perms: ' + error.message)
    setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
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
        C.useChatState.getState().dispatch.updateLastCoord(coord)
      }
    )
    return () => sub.remove()
  } catch (_error) {
    const error = _error as {message?: string}
    logger.info('failed to get location: ' + error.message)
    setPermissionDeniedCommandStatus(conversationIDKey, `Failed to access location. ${error.message}`)
    return () => {}
  }
}

// if we are making the daemon wait then run this to cleanup
let afterStartupDetails = (_done: boolean) => {}

export const initPlatformListener = () => {
  let _lastPersist = ''
  C.useConfigState.setState(s => {
    s.dispatch.dynamic.persistRoute = C.wrapErrors((path?: ReadonlyArray<any>) => {
      const f = async () => {
        let param = {}
        let routeName = Tabs.peopleTab
        if (path) {
          const cur = C.Router2.getTab()
          if (cur) {
            routeName = cur
          }
          const ap = C.Router2.getVisiblePath()
          ap.some(r => {
            if (r.name === 'chatConversation') {
              const rParams = r.params as undefined | {conversationIDKey?: T.Chat.ConversationIDKey}
              param = {selectedConversationIDKey: rParams?.conversationIDKey}
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
        _lastPersist = s
        await T.RPCGen.configGuiSetValueRpcPromise({
          path: 'ui.routeState2',
          value: {isNull: false, s},
        })
      }
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.onEngineIncomingNative = C.wrapErrors((action: EngineGen.Actions) => {
      switch (action.type) {
        default:
      }
    })
  })

  C.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    let appFocused: boolean
    let logState: T.RPCGen.MobileAppState
    switch (s.mobileAppState) {
      case 'active':
        appFocused = true
        logState = T.RPCGen.MobileAppState.foreground
        break
      case 'background':
        appFocused = false
        logState = T.RPCGen.MobileAppState.background
        break
      case 'inactive':
        appFocused = false
        logState = T.RPCGen.MobileAppState.inactive
        break
      default:
        appFocused = false
        logState = T.RPCGen.MobileAppState.foreground
    }

    logger.info(`setting app state on service to: ${logState}`)
    C.useConfigState.getState().dispatch.changedFocus(appFocused)
  })

  C.useConfigState.setState(s => {
    s.dispatch.dynamic.copyToClipboard = C.wrapErrors((s: string) => {
      Clipboard.setStringAsync(s)
        .then(() => {})
        .catch(() => {})
    })
  })

  C.useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion === old.handshakeVersion) return

    // loadStartupDetails finished already
    if (C.useConfigState.getState().startup.loaded) {
      afterStartupDetails = (_inc: boolean) => {}
    } else {
      // Else we have to wait for the loadStartupDetails to finish
      const {wait} = C.useDaemonState.getState().dispatch
      const version = s.handshakeVersion
      const startupDetailsWaiting = 'platform.native-waitStartupDetails'
      afterStartupDetails = (inc: boolean) => {
        wait(startupDetailsWaiting, version, inc)
      }
      afterStartupDetails(true)
    }

    if (isAndroid) {
      C.ignorePromise(
        T.RPCChat.localConfigureFileAttachmentDownloadLocalRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
      )
    }
  })

  C.useConfigState.setState(s => {
    s.dispatch.dynamic.onFilePickerError = C.wrapErrors((error: Error) => {
      Alert.alert('Error', String(error))
    })
    s.dispatch.dynamic.openAppStore = C.wrapErrors(() => {
      Linking.openURL(
        isAndroid
          ? 'http://play.google.com/store/apps/details?id=io.keybase.ossifrage'
          : 'https://itunes.apple.com/us/app/keybase-crypto-for-everyone/id1044461770?mt=8'
      ).catch(() => {})
    })
  })

  C.useProfileState.setState(s => {
    s.dispatch.editAvatar = () => {
      const f = async () => {
        try {
          const result = await launchImageLibraryAsync('photo')
          if (!result.canceled) {
            C.useRouterState
              .getState()
              .dispatch.navigateAppend({props: {image: result.assets[0]}, selected: 'profileEditAvatar'})
          }
        } catch (error) {
          C.useConfigState.getState().dispatch.filePickerError(new Error(String(error)))
        }
      }
      C.ignorePromise(f())
    }
  })

  C.useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const f = async () => {
      const {type} = await NetInfo.fetch()
      C.useConfigState
        .getState()
        .dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type, true)
    }
    C.ignorePromise(f())
  })

  C.useConfigState.subscribe((s, old) => {
    if (s.networkStatus === old.networkStatus) return
    const type = s.networkStatus?.type
    if (!type) return
    const f = async () => {
      try {
        await T.RPCGen.appStateUpdateMobileNetStateRpcPromise({state: type})
      } catch (err) {
        console.warn('Error sending mobileNetStateUpdate', err)
      }
    }
    C.ignorePromise(f())
  })

  C.useConfigState.setState(s => {
    s.dispatch.dynamic.showShareActionSheet = C.wrapErrors(
      (filePath: string, message: string, mimeType: string) => {
        const f = async () => {
          await showShareActionSheet({filePath, message, mimeType})
        }
        C.ignorePromise(f())
      }
    )
  })

  C.useConfigState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'active') {
      // only reload on foreground
      C.useSettingsContactsState.getState().dispatch.loadContactPermissions()
    }
  })

  // Location
  if (isAndroid) {
    C.useDarkModeState.subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      const {darkModePreference} = C.useDarkModeState.getState()
      androidAppColorSchemeChanged(darkModePreference)
    })
  }

  C.useRouterState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    const f = async () => {
      await C.timeoutPromise(1000)
      const path = C.Router2.getVisiblePath()
      C.useConfigState.getState().dispatch.dynamic.persistRoute?.(path)
    }
    C.ignorePromise(f())
  })

  // Start this immediately instead of waiting so we can do more things in parallel
  C.ignorePromise(loadStartupDetails())
  initPushListener()

  NetInfo.addEventListener(({type}) => {
    C.useConfigState.getState().dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type)
  })

  const initAudioModes = () => {
    C.ignorePromise(setupAudioMode(false))
  }
  initAudioModes()

  C.useConfigState.setState(s => {
    s.dispatch.dynamic.openAppSettings = C.wrapErrors(() => {
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
      C.ignorePromise(f())
    })

    s.dispatch.dynamic.onEngineIncomingNative = C.wrapErrors((action: EngineGen.Actions) => {
      switch (action.type) {
        case EngineGen.chat1ChatUiTriggerContactSync:
          C.useSettingsContactsState.getState().dispatch.manageContactsCache()
          break
        case EngineGen.keybase1LogUiLog: {
          const {params} = action.payload
          const {level, text} = params
          logger.info('keybase.1.logUi.log:', params.text.data)
          if (level >= T.RPCGen.LogLevel.error) {
            NotifyPopup(text.data)
          }
          break
        }
        case EngineGen.chat1ChatUiChatWatchPosition:
          C.ignorePromise(onChatWatchPosition(action))
          break
        case EngineGen.chat1ChatUiChatClearWatch:
          C.ignorePromise(onChatClearWatch())
          break
        default:
      }
    })
  })

  C.useRouterState.setState(s => {
    s.dispatch.dynamic.tabLongPress = C.wrapErrors((tab: string) => {
      if (tab !== Tabs.peopleTab) return
      const accountRows = C.useConfigState.getState().configuredAccounts
      const current = C.useCurrentUserState.getState().username
      const row = accountRows.find(a => a.username !== current && a.hasStoredSecret)
      if (row) {
        C.useConfigState.getState().dispatch.setUserSwitching(true)
        C.useConfigState.getState().dispatch.login(row.username, '')
      }
    })
  })
}
