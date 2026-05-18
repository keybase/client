// links all the stores together, stores never import this
import * as Chat from '@/constants/chat'
import {ignorePromise, neverThrowPromiseFunc} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useRouterState} from '@/stores/router'
import {useShellState, type ConnectionType} from '@/stores/shell'
import {useSettingsContactsState} from '@/stores/settings-contacts'
import * as T from '@/constants/types'
import type * as EngineGen from '@/constants/rpc'
import type * as Tabs from '@/constants/tabs'
import {NotifyPopup} from '@/util/misc'
import logger from '@/logger'
import {getEngine} from '@/engine'
import {afterKbfsDaemonRpcStatusChanged} from '@/fs/common/lifecycle'
import {logState, setThreadInputCommandStatus} from '@/constants/router'
import {initSharedSubscriptions, _onEngineIncoming, onEngineConnected as onSharedEngineConnected} from './shared'
import {noConversationIDKey} from '../types/chat/common'
import {noKBFSFailReason} from '@/constants/config'
import {dumpLogs, persistRoute} from '@/util/storeless-actions'

// ─── Desktop-only imports (runtime-guarded) ──────────────────────────────────
import type {KB2} from '@/util/electron'

const _getDesktop = () => {
  const KB2default = (require('@/util/electron') as {default: KB2}).default
  const InputMonitor = (require('@/util/platform-specific/input-monitor.desktop') as {default: new () => {notifyActive: (userActive: boolean) => void}}).default
  const {kbfsNotification} = require('@/util/platform-specific/kbfs-notifications') as {kbfsNotification: (notification: unknown, np: (title: string, opts?: {body?: string; sound?: boolean}, onClick?: () => void) => void) => void}
  const {skipAppFocusActions} = require('@/local-debug') as {skipAppFocusActions: boolean}
  const {isLinux, isWindows} = require('@/constants/platform') as {isLinux: boolean; isWindows: boolean}
  return {InputMonitor, KB2: KB2default, isLinux, isWindows, kbfsNotification, skipAppFocusActions}
}

const _getOpenAtLoginKey = () =>
  (require('@/stores/shell') as {openAtLoginKey: string}).openAtLoginKey

// ─── Native-only imports (runtime-guarded) ────────────────────────────────────

// Use require() instead of await import() to avoid triggering Metro's importAll,
// which iterates all lazy getters (including PushNotificationIOS) before native modules are registered.
const _getNative = () => {
  const ExpoLocation = require('expo-location') as ExpoLocationModule
  const ExpoTaskManager = require('expo-task-manager') as ExpoTaskManagerModule
  const NetInfo = require('@react-native-community/netinfo') as NetInfoModule
  const {Linking} = require('react-native') as {Linking: {getInitialURL: () => Promise<string | null>}}
  const {setupAudioMode} = require('@/util/audio.native') as {setupAudioMode: (allowRecord: boolean) => Promise<void>}
  const {requestLocationPermission} = require('@/util/platform-specific') as {requestLocationPermission: (perm?: unknown) => Promise<void>}
  const {
    fsCacheDir,
    fsDownloadDir,
    androidAppColorSchemeChanged,
    guiConfig,
    shareListenersRegistered,
  } = require('react-native-kb') as {
    fsCacheDir: string
    fsDownloadDir: string
    androidAppColorSchemeChanged: (mode: string) => void
    guiConfig: string
    shareListenersRegistered: () => void
  }
  return {ExpoLocation, ExpoTaskManager, Linking, NetInfo, androidAppColorSchemeChanged, fsCacheDir, fsDownloadDir, guiConfig, requestLocationPermission, setupAudioMode, shareListenersRegistered}
}

const _getNativeSync = () => {
  const {
    fsCacheDir,
    fsDownloadDir,
    androidAppColorSchemeChanged,
    guiConfig,
    shareListenersRegistered,
  } = require('react-native-kb') as {
    fsCacheDir: string
    fsDownloadDir: string
    androidAppColorSchemeChanged: (mode: string) => void
    guiConfig: string
    shareListenersRegistered: () => void
  }
  return {androidAppColorSchemeChanged, fsCacheDir, fsDownloadDir, guiConfig, shareListenersRegistered}
}

// ─── Location tracking (native only) ─────────────────────────────────────────

type ExpoLocationObject = {coords: {accuracy: number | null; latitude: number; longitude: number}}
type ExpoLocationModule = {
  startLocationUpdatesAsync: (taskName: string, options: object) => Promise<void>
  stopLocationUpdatesAsync: (taskName: string) => Promise<void>
}
type NetInfoModule = {
  fetch: () => Promise<{type: ConnectionType}>
  addEventListener: (cb: (state: {type: ConnectionType}) => void) => () => void
  NetInfoStateType: {none: ConnectionType}
}
type ExpoTaskManagerModule = {
  defineTask: (taskName: string, cb: (params: {data: unknown; error: unknown}) => Promise<void>) => void
}

const locationTaskName = 'background-location-task'
let locationRefs = 0
let madeBackgroundTask = false

const ensureBackgroundTask = (ExpoTaskManager: ExpoTaskManagerModule) => {
  if (madeBackgroundTask) return
  madeBackgroundTask = true

  ExpoTaskManager.defineTask(locationTaskName, async ({data, error}: {data: unknown; error: unknown}) => {
    if (error) return Promise.resolve()
    if (!data) return Promise.resolve()
    const d = data as {locations?: Array<ExpoLocationObject>}
    const locations = d.locations
    if (!locations?.length) return Promise.resolve()
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
  setThreadInputCommandStatus(conversationIDKey, {
    actions: [T.RPCChat.UICommandStatusActionTyp.appsettings],
    displayText: text,
    displayType: T.RPCChat.UICommandStatusDisplayTyp.error,
  })
}

const onChatWatchPosition = async (
  action: EngineGen.EngineAction<'chat.1.chatUi.chatWatchPosition'>
) => {
  const {ExpoLocation, ExpoTaskManager, requestLocationPermission} = _getNative()
  const response = action.payload.response
  response.result(0)
  try {
    await requestLocationPermission(action.payload.params.perm)
  } catch (_error) {
    const error = _error as {message?: string}
    const message = String(error.message)
    logger.info('failed to get location perms: ' + message)
    setPermissionDeniedCommandStatus(
      T.Chat.conversationIDToKey(action.payload.params.convID),
      `Failed to access location. ${message}`
    )
  }

  locationRefs++

  if (locationRefs === 1) {
    try {
      logger.info('[location] location watch start due to ', T.Chat.conversationIDToKey(action.payload.params.convID))
      ensureBackgroundTask(ExpoTaskManager)
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
  const {ExpoLocation, ExpoTaskManager} = _getNative()
  locationRefs--
  if (locationRefs <= 0) {
    try {
      logger.info('[location] end start')
      ensureBackgroundTask(ExpoTaskManager)
      await ExpoLocation.stopLocationUpdatesAsync(locationTaskName)
      logger.info('[location] end success')
    } catch {
      logger.info('[location] end failed')
    }
  }
}

// ─── Startup details (native only) ───────────────────────────────────────────

const loadStartupDetails = async () => {
  logger.info('[Startup] loadStartupDetails: starting')
  const {guiConfig, Linking} = _getNative()
  const {getStartupDetailsFromInitialPush} = await import('./push-listener.native')

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

  if (push) {
    logger.info('initialState: push', push.startupConversation, push.startupFollowUser)
    conversation = push.startupConversation
    followUser = push.startupFollowUser ?? ''
  } else if (initialUrl) {
    link = initialUrl
  } else if (routeState) {
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

  if (tab === 'blank') tab = ''

  useConfigState.getState().dispatch.setStartupDetails({
    conversation: conversation ?? noConversationIDKey,
    followUser,
    link,
    tab: tab as Tabs.Tab,
  })

  ignorePromise(
    T.RPCGen.configGuiSetValueRpcPromise({
      path: 'ui.routeState2',
      value: {isNull: false, s: ''},
    }).catch(() => {})
  )
}

// ─── onEngineIncoming ─────────────────────────────────────────────────────────

export const onEngineIncoming = (action: EngineGen.Actions) => {
  _onEngineIncoming(action)

  if (isMobile) {
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
  } else {
    const {isWindows, kbfsNotification} = _getDesktop()
    switch (action.type) {
      case 'keybase.1.logsend.prepareLogsend': {
        const f = async () => {
          const response = action.payload.response
          try {
            await dumpLogs()
          } finally {
            response.result()
          }
        }
        ignorePromise(f())
        break
      }
      case 'keybase.1.NotifyApp.exit':
        console.log('App exit requested')
        _getDesktop().KB2.functions.exitApp?.(0)
        break
      case 'keybase.1.NotifyFS.FSActivity':
        kbfsNotification(action.payload.params.notification, (title, opts, onClick) => { NotifyPopup(title, opts, -1, undefined, onClick) })
        break
      case 'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': {
        const f = async () => {
          try {
            await T.RPCGen.pgpPgpStorageDismissRpcPromise()
          } catch (err) {
            console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
          }
        }
        ignorePromise(f())
        break
      }
      case 'keybase.1.NotifyService.shutdown': {
        const {code} = action.payload.params
        if (isWindows && code !== (T.RPCGen.ExitCode.restart as number)) {
          console.log('Quitting due to service shutdown with code: ', code)
          _getDesktop().KB2.functions.quitApp?.()
        }
        break
      }
      case 'keybase.1.logUi.log': {
        const {params} = action.payload
        const {level, text} = params
        logger.info('keybase.1.logUi.log:', params.text.data)
        if (level >= T.RPCGen.LogLevel.error) {
          NotifyPopup(text.data)
        }
        break
      }
      case 'keybase.1.NotifySession.clientOutOfDate': {
        const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
        const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
        NotifyPopup('Client out of date!', {body}, 60 * 60)
        useConfigState
          .getState()
          .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
        break
      }
      case 'keybase.1.NotifySession.loggedOut': {
        if (useConfigState.getState().userSwitching) {
          logger.info('Resetting renderer engine for account switch logout')
          getEngine().reset()
        }
        break
      }
      case 'keybase.1.NotifySession.loggedIn': {
        if (useConfigState.getState().userSwitching) {
          logger.info('Refreshing renderer session registration for account switch login')
          getEngine().reset()
          onSharedEngineConnected()
        }
        break
      }
      default:
    }
  }
}

// ─── initPlatformListener ─────────────────────────────────────────────────────

const _platformUnsubs: Array<() => void> = __DEV__
  ? (globalThis.__hmr_platformUnsubs ??= [])
  : []

let _oneTimeInitDone: boolean = __DEV__
  ? (globalThis.__hmr_oneTimeInitDone ?? false)
  : false

export const initPlatformListener = () => {
  if (isMobile) {
    _initNativePlatformListener()
  } else {
    _initDesktopPlatformListener()
  }
}

const _initNativePlatformListener = () => {
  useShellState.subscribe((s, old) => {
    if (s.mobileAppState === old.mobileAppState) return
    let appFocused: boolean
    let logStateVal: T.RPCGen.MobileAppState
    switch (s.mobileAppState) {
      case 'active':
        appFocused = true
        logStateVal = T.RPCGen.MobileAppState.foreground
        break
      case 'background':
        appFocused = false
        logStateVal = T.RPCGen.MobileAppState.background
        persistRoute(false, true, () => useConfigState.getState().startup.loaded)
        break
      case 'inactive':
        appFocused = false
        logStateVal = T.RPCGen.MobileAppState.inactive
        break
      default:
        appFocused = false
        logStateVal = T.RPCGen.MobileAppState.foreground
    }

    logger.info(`setting app state on service to: ${logStateVal}`)
    s.dispatch.changedFocus(appFocused)
  })

  const configureAndroidCacheDir = () => {
    const {fsCacheDir, fsDownloadDir} = _getNativeSync()
    if (isAndroid && fsCacheDir && fsDownloadDir) {
      ignorePromise(
        T.RPCChat.localConfigureFileAttachmentDownloadLocalRpcPromise({
          cacheDirOverride: fsCacheDir,
          downloadDirOverride: fsDownloadDir,
        })
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
      const {NetInfo} = _getNative()
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
      useSettingsContactsState.getState().dispatch.loadContactPermissions()
    }
  })

  if (isAndroid) {
    const {useDarkModeState} = require('@/stores/darkmode') as {useDarkModeState: {subscribe: (cb: (s: {darkModePreference: string}, old: {darkModePreference: string}) => void) => void}}
    useDarkModeState.subscribe((s, old) => {
      if (s.darkModePreference === old.darkModePreference) return
      const {androidAppColorSchemeChanged} = _getNativeSync()
      androidAppColorSchemeChanged(s.darkModePreference)
    })
  }

  let calledShareListenersRegistered = false
  useRouterState.subscribe((s, old) => {
    const next = s.navState
    const prev = old.navState
    if (next === prev) return
    persistRoute(false, false, () => useConfigState.getState().startup.loaded)

    if (!calledShareListenersRegistered && logState().loggedIn) {
      calledShareListenersRegistered = true
      const {shareListenersRegistered} = _getNativeSync()
      shareListenersRegistered()
    }
  })

  if (isAndroid) {
    const ScreenCapture = require('expo-screen-capture') as {preventScreenCaptureAsync: (tag: string) => Promise<void>}
    ignorePromise(ScreenCapture.preventScreenCaptureAsync('screenprotector'))
    useDaemonState.subscribe((s, old) => {
      if (s.handshakeState !== 'done' || old.handshakeState === 'done') return
      const f = async () => {
        const {getSecureFlagSetting} = await import('@/constants/platform')
        const secure = await getSecureFlagSetting()
        if (!secure) {
          const SC = await import('expo-screen-capture')
          await SC.allowScreenCaptureAsync('screenprotector')
        }
      }
      ignorePromise(f())
    })
  }

  ignorePromise(loadStartupDetails())

  const {initPushListener} = require('./push-listener.native') as {initPushListener: () => void}
  initPushListener()

  const {NetInfo} = _getNative()
  NetInfo.addEventListener(({type}) => {
    useShellState.getState().dispatch.osNetworkStatusChanged(type !== NetInfo.NetInfoStateType.none, type)
  })

  const {setupAudioMode} = _getNative()
  ignorePromise(setupAudioMode(false))

  if (isAndroid) {
    const daemonState = useDaemonState.getState()
    if (daemonState.handshakeState === 'done' || daemonState.handshakeVersion > 0) {
      configureAndroidCacheDir()
    }
    afterKbfsDaemonRpcStatusChanged()
  }

  initSharedSubscriptions()
}

const _initDesktopPlatformListener = () => {
  // HMR cleanup: unsubscribe old store subscriptions before re-subscribing
  for (const unsub of _platformUnsubs) unsub()
  _platformUnsubs.length = 0

  const {isLinux, isWindows} = _getDesktop()

  const {maybePauseVideos, setupWindowEventListeners} = require('./desktop-dom-helpers.desktop') as {
    maybePauseVideos: () => void
    setupWindowEventListeners: (onFocus: () => void, onBlur: () => void, onOnline: () => void, onOffline: () => void) => void
  }

  const openAtLoginKey = _getOpenAtLoginKey()
  const {KB2, skipAppFocusActions, InputMonitor} = _getDesktop()
  const {setOpenAtLogin} = KB2.functions

  _platformUnsubs.push(useConfigState.subscribe((s, old) => {
    if (s.loggedIn !== old.loggedIn) {
      useShellState.getState().dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
    }
  }))

  _platformUnsubs.push(useShellState.subscribe((s, old) => {
    if (s.appFocused !== old.appFocused) {
      maybePauseVideos()
    }

    if (s.openAtLogin !== old.openAtLogin) {
      const {openAtLogin} = s
      const f = async () => {
        if (__DEV__) {
          console.log('onSetOpenAtLogin disabled for dev mode')
          return
        } else {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: openAtLoginKey,
            value: {b: openAtLogin, isNull: false},
          })
        }
        if (isLinux || isWindows) {
          const enabled =
            (await T.RPCGen.ctlGetOnLoginStartupRpcPromise()) === T.RPCGen.OnLoginStartupStatus.enabled
          if (enabled !== openAtLogin) {
            try {
              await T.RPCGen.ctlSetOnLoginStartupRpcPromise({enabled: openAtLogin})
            } catch (error_) {
              const error = error_ as {message?: string}
              logger.warn(`Error in sending ctlSetOnLoginStartup: ${error.message}`)
            }
          }
        } else {
          logger.info(`Login item settings changed! now ${openAtLogin ? 'on' : 'off'}`)
          await setOpenAtLogin?.(openAtLogin)
        }
      }
      ignorePromise(f())
    }
  }))

  if (!_oneTimeInitDone) {
    _oneTimeInitDone = true
    if (__DEV__) globalThis.__hmr_oneTimeInitDone = true

    const handle = (appFocused: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        useShellState.getState().dispatch.changedFocus(appFocused)
      }
    }
    setupWindowEventListeners(
      () => handle(true),
      () => handle(false),
      () => useShellState.getState().dispatch.osNetworkStatusChanged(true, 'notavailable'),
      () => useShellState.getState().dispatch.osNetworkStatusChanged(false, 'notavailable')
    )

    if (isLinux) {
      useShellState.getState().dispatch.initUseNativeFrame()
    }

    const initializeInputMonitor = () => {
      const inputMonitor = new InputMonitor()
      inputMonitor.notifyActive = (userActive: boolean) => {
        if (skipAppFocusActions) {
          console.log('Skipping app focus actions!')
        } else {
          useShellState.getState().dispatch.setActive(userActive)
          KB2.functions.activeChanged?.(Date.now(), userActive)
        }
      }
    }
    initializeInputMonitor()
  }

  _platformUnsubs.push(useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion !== old.handshakeVersion) {
      if (!isWindows) return

      const f = async () => {
        const waitKey = 'pipeCheckFail'
        const version = s.handshakeVersion
        const {wait} = s.dispatch
        wait(waitKey, version, true)
        try {
          logger.info('Checking RPC ownership')
          if (KB2.functions.winCheckRPCOwnership) {
            await KB2.functions.winCheckRPCOwnership()
          }
          wait(waitKey, version, false)
        } catch (error_) {
          getEngine().reset()
          const error = error_ as {message?: string}
          wait(waitKey, version, false, error.message || 'windows pipe owner fail', true)
        }
      }
      ignorePromise(f())
    }

    if (s.handshakeState !== old.handshakeState && s.handshakeState === 'done') {
      useConfigState.getState().dispatch.setStartupDetails({
        conversation: Chat.noConversationIDKey,
        followUser: '',
        link: '',
        tab: undefined,
      })
    }
  }))

  useDaemonState.setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = useDaemonState.getState()
      if (isWindows && handshakeFailedReason === noKBFSFailReason) {
        KB2.functions.requestWindowsStartService?.()
      }
    }
  })

  if (!isLinux) {
    afterKbfsDaemonRpcStatusChanged()
  }

  initSharedSubscriptions()
}

export {onEngineConnected, onEngineDisconnected} from './shared'
