// links all the stores together, stores never import this
import {ignorePromise, neverThrowPromiseFunc} from '../utils'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useDarkModeState} from '@/stores/darkmode'
import {useFSState} from '@/stores/fs'
import {useRouterState} from '@/stores/router'
import {useShellState} from '@/stores/shell'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import * as ExpoLocation from 'expo-location'
import * as ExpoTaskManager from 'expo-task-manager'
import type * as Tabs from '@/constants/tabs'
import * as NetInfo from '@react-native-community/netinfo'
import {NotifyPopup} from '@/util/misc'
import logger from '@/logger'
import {Linking} from 'react-native'
import {isAndroid} from '@/constants/platform.native'
import {logState} from '@/constants/router'
import {setupAudioMode} from '@/util/audio.native'
import {
  fsCacheDir,
  fsDownloadDir,
  androidAppColorSchemeChanged,
  guiConfig,
  shareListenersRegistered,
} from 'react-native-kb'
import {initPushListener, getStartupDetailsFromInitialPush} from './push-listener.native'
import {initSharedSubscriptions, _onEngineIncoming} from './shared'
import {noConversationIDKey} from '../types/chat/common'
import {getSelectedConversation} from '../chat/common'
import {getConvoState, getConvoUIState} from '@/stores/convostate'
import {requestLocationPermission} from '@/util/platform-specific/index.native'
import * as ScreenCapture from 'expo-screen-capture'
import {getSecureFlagSetting} from '@/constants/platform.native'
import {persistRoute} from '@/util/storeless-actions'

const loadStartupDetails = async () => {
  logger.info('[Startup] loadStartupDetails: starting')
  const [routeState, initialUrl, push] = await Promise.all([
    neverThrowPromiseFunc(async () => {
      try {
        const config = JSON.parse(guiConfig) as {ui?: {routeState2?: string}} | undefined
        return Promise.resolve(config?.ui?.routeState2 ?? '')
      } catch {
        return Promise.resolve('')
      }
    }),
    neverThrowPromiseFunc(async () => {
      const linkingStart = Date.now()
      logger.info('[Startup] loadStartupDetails: calling Linking.getInitialURL')
      const url = await Linking.getInitialURL()
      const elapsed = Date.now() - linkingStart
      if (url === null) {
        logger.warn(`[Startup] loadStartupDetails: Linking.getInitialURL returned null in ${elapsed}ms`)
      } else {
        logger.info(`[Startup] loadStartupDetails: Linking.getInitialURL returned in ${elapsed}ms: ${url}`)
      }
      return url
    }),
    neverThrowPromiseFunc(getStartupDetailsFromInitialPush),
  ] as const)

  let conversation: T.Chat.ConversationIDKey | undefined
  let followUser = ''
  let link = ''
  let tab = ''

  // Top priority, push
  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    conversation = push.startupConversation
    followUser = push.startupFollowUser ?? ''
  } else if (initialUrl) {
    // Second priority, deep link
    link = initialUrl
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
          tab = _rn as unknown as typeof tab
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

  useConfigState.getState().dispatch.setStartupDetails({
    conversation: conversation ?? noConversationIDKey,
    followUser,
    link,
    tab: tab as Tabs.Tab,
  })

  // Clear last value to be extra safe bad things don't hose us forever (don't block startup)
  ignorePromise(
    T.RPCGen.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    }).catch(() => {})
  )
}

const locationTaskName = 'background-location-task'
let locationRefs = 0
let madeBackgroundTask = false

const ensureBackgroundTask = () => {
  if (madeBackgroundTask) return
  madeBackgroundTask = true

  ExpoTaskManager.defineTask(locationTaskName, async ({data, error}) => {
    if (error) {
      // check `error.message` for more details.
      return Promise.resolve()
    }

    if (!data) {
      return Promise.resolve()
    }
    const d = data as {locations?: Array<ExpoLocation.LocationObject>}
    const locations = d.locations
    if (!locations?.length) {
      return Promise.resolve()
    }
    const pos = locations.at(-1)
    const coord = {
      accuracy: Math.floor(pos?.coords.accuracy ?? 0),
      lat: pos?.coords.latitude ?? 0,
      lon: pos?.coords.longitude ?? 0,
    }

    try {
      await T.RPCChat.localLocationUpdateRpcPromise({coord})
    } catch (error) {
      logger.info('background location update failed: ' + String(error))
    }
    return Promise.resolve()
  })
}

const setPermissionDeniedCommandStatus = (conversationIDKey: T.Chat.ConversationIDKey, text: string) => {
  getConvoUIState(conversationIDKey).dispatch.setCommandStatusInfo({
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: text,
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  })
}

const onChatWatchPosition = async (
  action: EngineGen.EngineAction<'chat.1.chatUi.chatWatchPosition'>
) => {
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

export const onEngineIncoming = (action: EngineGen.Actions) => {
  _onEngineIncoming(action)
  switch (action.type) {
    case 'chat.1.chatUi.triggerContactSync':
      useSettingsContactsState.getState().dispatch.manageContactsCache()
      break
    case 'keybase.1.logUi.log': {
      const {params} = action.payload
      const {level, text} = params
      logger.info('keybase.1.logUi.log:', params.text.data)
      if (level >= T.RPCGen.LogLevel.error) {
        NotifyPopup(text.data)
      }
      break
    }
    case 'chat.1.chatUi.chatWatchPosition':
      ignorePromise(onChatWatchPosition(action))
      break
    case 'chat.1.chatUi.chatClearWatch':
      ignorePromise(onChatClearWatch())
      break
    default:
  }
}

export const initPlatformListener = () => {
  useShellState.subscribe((s, old) => {
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
        persistRoute(false, true, () => useConfigState.getState().startup.loaded)
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
    s.dispatch.changedFocus(appFocused)

    if (appFocused && old.mobileAppState !== 'active') {
      const {dispatch} = getConvoState(getSelectedConversation())
      dispatch.loadMoreMessages({reason: 'foregrounding'})
      dispatch.markThreadAsRead()
    }
  })

  const configureAndroidCacheDir = () => {
    if (isAndroid && fsCacheDir && fsDownloadDir) {
      ignorePromise(
        T.RPCChat.localConfigureFileAttachmentDownloadLocalRpcPromise({
          // Android's cache dir is (when I tried) [app]/cache but Go side uses
          // [app]/.cache by default, which can't be used for sharing to other apps.
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
          .then(() => {})
          .catch((e: unknown) => {
            logger.error(`[Android cache override] Failed to configure: ${String(e)}`)
          })
      )
    } else if (isAndroid) {
      logger.warn(
        `[Android cache override] Missing dirs - cacheDir: ${fsCacheDir}, downloadDir: ${fsDownloadDir}`
      )
    }
  }

  useDaemonState.subscribe((s, old) => {
    const versionChanged = s.handshakeVersion !== old.handshakeVersion
    const stateChanged = s.handshakeState !== old.handshakeState
    const justBecameReady = stateChanged && s.handshakeState === 'done' && old.handshakeState !== 'done'

    if (versionChanged || justBecameReady) {
      configureAndroidCacheDir()
    }
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn === old.loggedIn) return
    const f = async () => {
      const {type} = await NetInfo.fetch()
      useShellState.getState().dispatch.osNetworkStatusChanged(
        type !== NetInfo.NetInfoStateType.none,
        type,
        true
      )
    }
    ignorePromise(f())
  })

  useShellState.subscribe((s, old) => {
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
    ignorePromise(f())
  })

  useShellState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    if (s.mobileAppState === 'active') {
      // only reload on foreground
      useSettingsContactsState.getState().dispatch.loadContactPermissions()
    }
  })

  // Location
  if (isAndroid) {
    useDarkModeState.subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      androidAppColorSchemeChanged(s.darkModePreference)
    })
  }

  // we call this when we're logged in.
  let calledShareListenersRegistered = false

  useRouterState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    persistRoute(false, false, () => useConfigState.getState().startup.loaded)

    if (!calledShareListenersRegistered && logState().loggedIn) {
      calledShareListenersRegistered = true
      shareListenersRegistered()
    }
  })

  // Default to screen capture prevention on Android (matches native default of secure).
  // Once daemon is ready, sync with the user's saved preference.
  if (isAndroid) {
    ignorePromise(ScreenCapture.preventScreenCaptureAsync('screenprotector'))
    useDaemonState.subscribe((s, old) => {
      if (s.handshakeState !== 'done' || old.handshakeState === 'done') return
      const f = async () => {
        const secure = await getSecureFlagSetting()
        if (!secure) {
          await ScreenCapture.allowScreenCaptureAsync('screenprotector')
        }
      }
      ignorePromise(f())
    })
  }

  // Start this immediately instead of waiting so we can do more things in parallel
  ignorePromise(loadStartupDetails())
  initPushListener()

  NetInfo.addEventListener(({type}) => {
    useShellState.getState().dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type)
  })

  const initAudioModes = () => {
    ignorePromise(setupAudioMode(false))
  }
  initAudioModes()

  if (isAndroid) {
    const daemonState = useDaemonState.getState()
    if (daemonState.handshakeState === 'done' || daemonState.handshakeVersion > 0) {
      configureAndroidCacheDir()
    }
  }

  if (isAndroid) {
    useFSState.getState().dispatch.afterKbfsDaemonRpcStatusChanged()
  }

  initSharedSubscriptions()
}

export {onEngineConnected, onEngineDisconnected} from './shared'
