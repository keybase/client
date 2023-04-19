import * as ConfigConstants from '../../constants/config'
import * as ConfigGen from '../config-gen'
import * as Container from '../../util/container'
import * as EngineGen from '../engine-gen-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import InputMonitor from './input-monitor.desktop'
import KB2 from '../../util/electron.desktop'
import logger from '../../logger'
import type {RPCError} from '../../util/errors'
import {_getNavigator} from '../../constants/router2'
import {getEngine} from '../../engine'
import {isLinux, isWindows, defaultUseNativeFrame} from '../../constants/platform.desktop'
import {kbfsNotification} from './kbfs-notifications'
import {skipAppFocusActions} from '../../local-debug.desktop'
import NotifyPopup from '../../util/notify-popup'

const {showMainWindow, activeChanged, requestWindowsStartService, dumpNodeLogger} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, ctlQuit, copyToClipboard} = KB2.functions

const onLog = (_: unknown, action: EngineGen.Keybase1LogUiLogPayload) => {
  const {params} = action.payload
  const {level, text} = params
  logger.info('keybase.1.logUi.log:', params.text.data)
  if (level >= RPCTypes.LogLevel.error) {
    NotifyPopup(text.data, {})
  }
}

export const requestPermissionsToWrite = async () => {
  return Promise.reject(new Error('Requets permissions - unsupported on this platform'))
}

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  return Promise.reject(new Error('Save Attachment to camera roll - unsupported on this platform'))
}

export function displayNewMessageNotification() {
  throw new Error('Display new message notification not available on this platform')
}

export function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

const handleWindowFocusEvents = (listenerApi: Container.ListenerApi) => {
  const handle = (appFocused: boolean) => {
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      listenerApi.dispatch(ConfigGen.createChangedFocus({appFocused}))
    }
  }
  window.addEventListener('focus', () => handle(true))
  window.addEventListener('blur', () => handle(false))
}

const initializeInputMonitor = (listenerApi: Container.ListenerApi) => {
  const inputMonitor = new InputMonitor()
  inputMonitor.notifyActive = (userActive: boolean) => {
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      listenerApi.dispatch(ConfigGen.createChangedActive({userActive}))
      // let node thread save file
      activeChanged?.(Date.now(), userActive)
    }
  }
}

export const dumpLogs = async (_?: unknown, action?: ConfigGen.DumpLogsPayload) => {
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  // quit as soon as possible
  if (action && action.payload.reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

const checkRPCOwnership = async (
  _: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  const waitKey = 'pipeCheckFail'
  listenerApi.dispatch(
    ConfigGen.createDaemonHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
  )
  try {
    logger.info('Checking RPC ownership')

    if (KB2.functions.winCheckRPCOwnership) {
      await KB2.functions.winCheckRPCOwnership()
    }
    listenerApi.dispatch(
      ConfigGen.createDaemonHandshakeWait({
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  } catch (error_) {
    // error will be logged in bootstrap check
    getEngine().reset()
    const error = error_ as RPCError
    listenerApi.dispatch(
      ConfigGen.createDaemonHandshakeWait({
        failedFatal: true,
        failedReason: error.message || 'windows pipe owner fail',
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  }
}

const initOsNetworkStatus = () =>
  ConfigGen.createOsNetworkStatusChanged({isInit: true, online: navigator.onLine, type: 'notavailable'})

const setupReachabilityWatcher = (listenerApi: Container.ListenerApi) => {
  const handler = (online: boolean) => {
    listenerApi.dispatch(ConfigGen.createOsNetworkStatusChanged({online, type: 'notavailable'}))
  }
  window.addEventListener('online', () => handler(true))
  window.addEventListener('offline', () => handler(false))
}

const onExit = () => {
  console.log('App exit requested')
  exitApp?.(0)
}

const onFSActivity = (state: Container.TypedState, action: EngineGen.Keybase1NotifyFSFSActivityPayload) => {
  kbfsNotification(action.payload.params.notification, NotifyPopup, state)
}

const onPgpgKeySecret = async () =>
  RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })

const onShutdown = (_: unknown, action: EngineGen.Keybase1NotifyServiceShutdownPayload) => {
  const {code} = action.payload.params
  if (isWindows && code !== RPCTypes.ExitCode.restart) {
    console.log('Quitting due to service shutdown with code: ', code)
    // Quit just the app, not the service
    quitApp?.()
  }
}

const onConnected = () => {
  // Introduce ourselves to the service
  RPCTypes.configHelloIAmRpcPromise({details: KB2.constants.helloDetails}).catch(() => {})
}

const onOutOfDate = (_: unknown, action: EngineGen.Keybase1NotifySessionClientOutOfDatePayload) => {
  const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
  const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
  NotifyPopup('Client out of date!', {body}, 60 * 60)
  // This is from the API server. Consider notifications from API server
  // always critical.
  return ConfigGen.createUpdateInfo({critical: true, isOutOfDate: true, message: upgradeMsg})
}

const prepareLogSend = async (_: unknown, action: EngineGen.Keybase1LogsendPrepareLogsendPayload) => {
  const response = action.payload.response
  try {
    await dumpLogs()
  } finally {
    response?.result()
  }
}

const onCopyToClipboard = (_: unknown, action: ConfigGen.CopyToClipboardPayload) => {
  copyToClipboard?.(action.payload.text)
}

const sendWindowsKBServiceCheck = (
  state: Container.TypedState,
  action: ConfigGen.DaemonHandshakeWaitPayload
) => {
  if (
    isWindows &&
    action.payload.version === state.config.daemonHandshakeVersion &&
    state.config.daemonHandshakeWaiters.size === 0 &&
    state.config.daemonHandshakeFailedReason === ConfigConstants.noKBFSFailReason
  ) {
    requestWindowsStartService?.()
  }
}

const startOutOfDateCheckLoop = async (listenerApi: Container.ListenerApi) => {
  // eslint-disable-next-line
  while (true) {
    try {
      const action = await checkForUpdate()
      listenerApi.dispatch(action)
    } catch (err) {
      logger.warn('error getting update info: ', err)
    }
    await listenerApi.delay(3_600_000) // 1 hr
  }
}

const checkForUpdate = async () => {
  const {status, message} = await RPCTypes.configGetUpdateInfoRpcPromise()
  return ConfigGen.createUpdateInfo({
    critical: status === RPCTypes.UpdateInfoStatus.criticallyOutOfDate,
    isOutOfDate: status !== RPCTypes.UpdateInfoStatus.upToDate,
    message,
  })
}

const updateNow = async () => {
  await RPCTypes.configStartUpdateIfNeededRpcPromise()
  // * If user choose to update:
  //   We'd get killed and it doesn't matter what happens here.
  // * If user hits "Ignore":
  //   Note that we ignore the snooze here, so the state shouldn't change,
  //   and we'd back to where we think we still need an update. So we could
  //   have just unset the "updating" flag.However, in case server has
  //   decided to pull out the update between last time we asked the updater
  //   and now, we'd be in a wrong state if we didn't check with the service.
  //   Since user has interacted with it, we still ask the service to make
  //   sure.
  return ConfigGen.createCheckForUpdate()
}

const nativeFrameKey = 'useNativeFrame'

const saveUseNativeFrame = async (state: Container.TypedState) => {
  const {useNativeFrame} = state.config
  await RPCTypes.configGuiSetValueRpcPromise({
    path: nativeFrameKey,
    value: {
      b: useNativeFrame,
      isNull: false,
    },
  })
}

const initializeUseNativeFrame = async (listenerApi: Container.ListenerApi) => {
  try {
    const val = await RPCTypes.configGuiGetValueRpcPromise({path: nativeFrameKey})
    const useNativeFrame = val.b === undefined || val.b === null ? defaultUseNativeFrame : val.b
    listenerApi.dispatch(ConfigGen.createSetUseNativeFrame({useNativeFrame}))
  } catch (_) {}
}

const windowStateKey = 'windowState'
const saveWindowState = async (state: Container.TypedState) => {
  const {windowState} = state.config
  await RPCTypes.configGuiSetValueRpcPromise({
    path: windowStateKey,
    value: {
      isNull: false,
      s: JSON.stringify(windowState),
    },
  })
}

const notifySoundKey = 'notifySound'
const initializeNotifySound = async (listenerApi: Container.ListenerApi) => {
  try {
    const val = await RPCTypes.configGuiGetValueRpcPromise({path: notifySoundKey})
    const notifySound: boolean | undefined = val.b || undefined
    const state = listenerApi.getState()
    if (notifySound !== undefined && notifySound !== state.config.notifySound) {
      listenerApi.dispatch(ConfigGen.createSetNotifySound({notifySound}))
    }
  } catch (_) {}
}

const setNotifySound = async (state: Container.TypedState) => {
  const {notifySound} = state.config
  await RPCTypes.configGuiSetValueRpcPromise({
    path: notifySoundKey,
    value: {
      b: notifySound,
      isNull: false,
    },
  })
}

const openAtLoginKey = 'openAtLogin'
const initializeOpenAtLogin = async (listenerApi: Container.ListenerApi) => {
  try {
    const val = await RPCTypes.configGuiGetValueRpcPromise({path: openAtLoginKey})
    const openAtLogin: boolean | undefined = val.b || undefined
    const state = listenerApi.getState()
    if (openAtLogin !== undefined && openAtLogin !== state.config.openAtLogin) {
      listenerApi.dispatch(ConfigGen.createSetOpenAtLogin({openAtLogin}))
    }
  } catch (_) {}
}

const onSetOpenAtLogin = async (state: Container.TypedState) => {
  const {openAtLogin} = state.config
  await RPCTypes.configGuiSetValueRpcPromise({
    path: openAtLoginKey,
    value: {
      b: openAtLogin,
      isNull: false,
    },
  })

  if (__DEV__) {
    console.log('onSetOpenAtLogin disabled for dev mode')
    return
  }
  if (isLinux || isWindows) {
    const enabled =
      (await RPCTypes.ctlGetOnLoginStartupRpcPromise()) === RPCTypes.OnLoginStartupStatus.enabled
    if (enabled !== openAtLogin) {
      await RPCTypes.ctlSetOnLoginStartupRpcPromise({enabled: openAtLogin}).catch(err => {
        logger.warn(`Error in sending ctlSetOnLoginStartup: ${err.message}`)
      })
    }
  } else {
    logger.info(`Login item settings changed! now ${openAtLogin}`)
    setOpenAtLogin?.(openAtLogin)
      .then(() => {})
      .catch(() => {})
  }
}

export const requestLocationPermission = async () => Promise.resolve()
export const watchPositionForMap = async () => Promise.resolve(() => {})

const checkNav = async (
  _state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  listenerApi: Container.ListenerApi
) => {
  // have one
  if (_getNavigator()) {
    return
  }

  const name = 'desktopNav'
  const {version} = action.payload

  listenerApi.dispatch(ConfigGen.createDaemonHandshakeWait({increment: true, name, version}))
  try {
    // eslint-disable-next-line
    while (true) {
      logger.info('Waiting on nav')
      await listenerApi.take(a => a.type === ConfigGen.setNavigator)
      if (_getNavigator()) {
        break
      }
    }
  } finally {
    listenerApi.dispatch(ConfigGen.createDaemonHandshakeWait({increment: false, name, version}))
  }
}

const maybePauseVideos = (_: unknown, action: ConfigGen.ChangedFocusPayload) => {
  const {appFocused} = action.payload
  const videos = document.querySelectorAll('video')
  const allVideos = Array.from(videos)

  allVideos.forEach(v => {
    if (appFocused) {
      if (v.hasAttribute('data-focus-paused')) {
        if (v.paused) {
          v.play()
            .then(() => {})
            .catch(() => {})
        }
      }
    } else {
      // only pause looping videos
      if (!v.paused && v.hasAttribute('loop') && v.hasAttribute('autoplay')) {
        v.setAttribute('data-focus-paused', 'true')
        v.pause()
      }
    }
  })
}

export const initPlatformListener = () => {
  Container.listenAction(ConfigGen.setOpenAtLogin, onSetOpenAtLogin)
  Container.listenAction(ConfigGen.setNotifySound, setNotifySound)
  Container.listenAction(ConfigGen.showMain, () => showMainWindow?.())
  Container.listenAction(ConfigGen.dumpLogs, dumpLogs)
  getEngine().registerCustomResponse('keybase.1.logsend.prepareLogsend')
  Container.listenAction(EngineGen.keybase1LogsendPrepareLogsend, prepareLogSend)
  Container.listenAction(EngineGen.connected, onConnected)
  Container.listenAction(EngineGen.keybase1NotifyAppExit, onExit)
  Container.listenAction(EngineGen.keybase1NotifyFSFSActivity, onFSActivity)
  Container.listenAction(EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile, onPgpgKeySecret)
  Container.listenAction(EngineGen.keybase1NotifyServiceShutdown, onShutdown)
  Container.listenAction(EngineGen.keybase1NotifySessionClientOutOfDate, onOutOfDate)
  Container.listenAction(ConfigGen.copyToClipboard, onCopyToClipboard)
  Container.listenAction(ConfigGen.updateNow, updateNow)
  Container.listenAction(ConfigGen.checkForUpdate, checkForUpdate)
  Container.listenAction(ConfigGen.daemonHandshakeWait, sendWindowsKBServiceCheck)
  Container.listenAction(ConfigGen.setUseNativeFrame, saveUseNativeFrame)
  Container.listenAction(ConfigGen.loggedIn, initOsNetworkStatus)
  Container.listenAction(ConfigGen.updateWindowState, saveWindowState)
  Container.listenAction(ConfigGen.changedFocus, maybePauseVideos)
  Container.listenAction(EngineGen.keybase1LogUiLog, onLog)

  if (isWindows) {
    Container.listenAction(ConfigGen.daemonHandshake, checkRPCOwnership)
  }
  Container.listenAction(ConfigGen.daemonHandshake, checkNav)

  Container.spawn(initializeUseNativeFrame, 'initializeUseNativeFrame')
  Container.spawn(initializeNotifySound, 'initializeNotifySound')
  Container.spawn(initializeOpenAtLogin, 'initializeOpenAtLogin')
  Container.spawn(initializeInputMonitor, 'initializeInputMonitor')
  Container.spawn(handleWindowFocusEvents, 'handleWindowFocusEvents')
  Container.spawn(setupReachabilityWatcher, 'setupReachabilityWatcher')
  Container.spawn(startOutOfDateCheckLoop, 'startOutOfDateCheckLoop')
}
