import * as ConfigGen from '../config-gen'
import * as ConfigConstants from '../../constants/config'
import * as EngineGen from '../engine-gen-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Electron from 'electron'
import * as Saga from '../../util/saga'
import logger from '../../logger'
import {NotifyPopup} from '../../native/notifications'
import {execFile} from 'child_process'
import {getEngine} from '../../engine'
import {isLinux, isWindows, socketPath, defaultUseNativeFrame} from '../../constants/platform.desktop'
import {kbfsNotification} from '../../util/kbfs-notifications'
import {quit} from '../../desktop/app/ctl.desktop'
import {writeLogLinesToFile} from '../../util/forward-logs'
import InputMonitor from './input-monitor.desktop'
import {skipAppFocusActions} from '../../local-debug.desktop'
import * as Container from '../../util/container'
import {_getNavigator} from '../../constants/router2'

const {resolve} = KB.path
const {argv, env, pid} = KB.process

export function showShareActionSheet() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function saveAttachmentDialog() {
  throw new Error('Save Attachment - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

const showMainWindow = () => {
  Electron.ipcRenderer.invoke('KBkeybase', {type: 'showMainWindow'})
}

export function displayNewMessageNotification() {
  throw new Error('Display new message notification not available on this platform')
}

export function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

function* handleWindowFocusEvents() {
  const channel = Saga.eventChannel(emitter => {
    window.addEventListener('focus', () => emitter('focus'))
    window.addEventListener('blur', () => emitter('blur'))
    return () => {}
  }, Saga.buffers.expanding(1))
  while (true) {
    const type = yield Saga.take(channel)
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      switch (type) {
        case 'focus':
          yield Saga.put(ConfigGen.createChangedFocus({appFocused: true}))
          break
        case 'blur':
          yield Saga.put(ConfigGen.createChangedFocus({appFocused: false}))
          break
      }
    }
  }
}

function* initializeInputMonitor(): Iterable<any> {
  const inputMonitor = new InputMonitor()
  const channel = Saga.eventChannel(emitter => {
    inputMonitor.notifyActive = isActive => emitter(isActive ? 'active' : 'inactive')
    return () => {}
  }, Saga.buffers.expanding(1))

  while (true) {
    const type = yield Saga.take(channel)
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      const userActive = type === 'active'
      yield Saga.put(ConfigGen.createChangedActive({userActive}))
      // let node thread save file
      Electron.ipcRenderer.invoke('KBkeybase', {
        payload: {changedAtMs: Date.now(), isUserActive: userActive},
        type: 'activeChanged',
      })
    }
  }
}

export const dumpLogs = async (action?: ConfigGen.DumpLogsPayload) => {
  const fromRender = await logger.dump()
  const globalLogger: typeof logger = Electron.remote.getGlobal('globalLogger')
  const fromMain = await globalLogger.dump()
  await writeLogLinesToFile([...fromRender, ...fromMain])
  // quit as soon as possible
  if (action && action.payload.reason === 'quitting through menu') {
    quit()
  }
}

function* checkRPCOwnership(_: Container.TypedState, action: ConfigGen.DaemonHandshakePayload) {
  const waitKey = 'pipeCheckFail'
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
  )
  try {
    logger.info('Checking RPC ownership')

    const localAppData = String(env.LOCALAPPDATA)
    var binPath = localAppData ? resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
    const args = ['pipeowner', socketPath]
    yield Saga.callUntyped(
      () =>
        new Promise((resolve, reject) => {
          execFile(binPath, args, {windowsHide: true}, (error, stdout) => {
            if (error) {
              logger.info(`pipeowner check result: ${stdout.toString()}`)
              // error will be logged in bootstrap check
              getEngine().reset()
              reject(error)
              return
            }
            const result = JSON.parse(stdout.toString())
            if (result.isOwner) {
              resolve()
              return
            }
            logger.info(`pipeowner check result: ${stdout.toString()}`)
            reject(new Error('pipeowner check failed'))
          })
        })
    )
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  } catch (e) {
    yield Saga.put(
      ConfigGen.createDaemonHandshakeWait({
        failedFatal: true,
        failedReason: e.message || 'windows pipe owner fail',
        increment: false,
        name: waitKey,
        version: action.payload.version,
      })
    )
  }
}

const initOsNetworkStatus = () =>
  ConfigGen.createOsNetworkStatusChanged({isInit: true, online: navigator.onLine, type: 'notavailable'})

function* setupReachabilityWatcher() {
  const channel = Saga.eventChannel(emitter => {
    window.addEventListener('online', () => emitter('online'))
    window.addEventListener('offline', () => emitter('offline'))
    return () => {}
  }, Saga.buffers.sliding(1))

  while (true) {
    const status = yield Saga.take(channel)
    yield Saga.put(
      ConfigGen.createOsNetworkStatusChanged({online: status === 'online', type: 'notavailable'})
    )
  }
}

const onExit = () => {
  console.log('App exit requested')
  Electron.remote.app.exit(0)
}

const onFSActivity = (state: Container.TypedState, action: EngineGen.Keybase1NotifyFSFSActivityPayload) => {
  kbfsNotification(action.payload.params.notification, NotifyPopup, state)
}

const onPgpgKeySecret = () =>
  RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })

const onShutdown = (action: EngineGen.Keybase1NotifyServiceShutdownPayload) => {
  const {code} = action.payload.params
  if (isWindows && code !== RPCTypes.ExitCode.restart) {
    console.log('Quitting due to service shutdown with code: ', code)
    // Quit just the app, not the service
    Electron.remote.app.quit()
  }
}

const onConnected = () => {
  // Introduce ourselves to the service
  RPCTypes.configHelloIAmRpcPromise({
    details: {
      argv: argv,
      clientType: RPCTypes.ClientType.guiMain,
      desc: 'Main Renderer',
      pid,
      version: __VERSION__, // eslint-disable-line no-undef
    },
  }).catch(_ => {})
}

const onOutOfDate = (action: EngineGen.Keybase1NotifySessionClientOutOfDatePayload) => {
  const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
  const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
  NotifyPopup('Client out of date!', {body}, 60 * 60)
  // This is from the API server. Consider notifications from API server
  // always critical.
  return ConfigGen.createUpdateInfo({critical: true, isOutOfDate: true, message: upgradeMsg})
}

const prepareLogSend = async (action: EngineGen.Keybase1LogsendPrepareLogsendPayload) => {
  const response = action.payload.response
  try {
    await dumpLogs()
  } finally {
    response && response.result()
  }
}

const copyToClipboard = (action: ConfigGen.CopyToClipboardPayload) => {
  Electron.clipboard.writeText(action.payload.text)
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
    Electron.ipcRenderer.invoke('KBkeybase', {type: 'requestWindowsStartService'})
  }
}

function* startOutOfDateCheckLoop() {
  while (1) {
    try {
      const toPut = yield checkForUpdate()
      yield Saga.put(toPut)
      yield Saga.delay(3600 * 1000) // 1 hr
    } catch (err) {
      logger.warn('error getting update info: ', err)
      yield Saga.delay(3600 * 1000) // 1 hr
    }
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

// don't leak these handlers on hot load
module?.hot?.dispose(() => {
  const pm = Electron.remote.powerMonitor
  pm.removeAllListeners()
})

function* startPowerMonitor() {
  const channel = Saga.eventChannel(emitter => {
    const pm = Electron.remote.powerMonitor
    pm.on('suspend', () => emitter('suspend'))
    pm.on('resume', () => emitter('resume'))
    pm.on('shutdown', () => emitter('shutdown'))
    pm.on('lock-screen', () => emitter('lock-screen'))
    pm.on('unlock-screen', () => emitter('unlock-screen'))
    return () => {}
  }, Saga.buffers.expanding(1))
  while (true) {
    const type = yield Saga.take(channel)
    logger.info('Got power change: ', type)
    RPCTypes.appStatePowerMonitorEventRpcPromise({event: type}).catch(err => {
      console.warn('Error sending powerMonitorEvent', err)
    })
  }
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

function* initializeUseNativeFrame() {
  try {
    const val: Saga.RPCPromiseType<typeof RPCTypes.configGuiGetValueRpcPromise> = yield RPCTypes.configGuiGetValueRpcPromise(
      {
        path: nativeFrameKey,
      }
    )
    const useNativeFrame = val.b === undefined || val.b === null ? defaultUseNativeFrame : val.b
    yield Saga.put(ConfigGen.createSetUseNativeFrame({useNativeFrame}))
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
function* initializeNotifySound() {
  try {
    const val: Saga.RPCPromiseType<typeof RPCTypes.configGuiGetValueRpcPromise> = yield RPCTypes.configGuiGetValueRpcPromise(
      {
        path: notifySoundKey,
      }
    )
    const notifySound: boolean | undefined = val.b || undefined
    const state: Container.TypedState = yield Saga.selectState()
    if (notifySound !== undefined && notifySound !== state.config.notifySound) {
      yield Saga.put(ConfigGen.createSetNotifySound({notifySound}))
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
function* initializeOpenAtLogin() {
  try {
    const val: Saga.RPCPromiseType<typeof RPCTypes.configGuiGetValueRpcPromise> = yield RPCTypes.configGuiGetValueRpcPromise(
      {
        path: openAtLoginKey,
      }
    )

    const openAtLogin: boolean | undefined = val.b || undefined
    const state: Container.TypedState = yield Saga.selectState()
    if (openAtLogin !== undefined && openAtLogin !== state.config.openAtLogin) {
      yield Saga.put(ConfigGen.createSetOpenAtLogin({openAtLogin}))
    }
  } catch (_) {}
}

const setOpenAtLogin = async (state: Container.TypedState) => {
  const {openAtLogin} = state.config
  await RPCTypes.configGuiSetValueRpcPromise({
    path: openAtLoginKey,
    value: {
      b: openAtLogin,
      isNull: false,
    },
  })

  if (__DEV__) return
  if (isLinux || isWindows) {
    const enabled =
      (await RPCTypes.ctlGetOnLoginStartupRpcPromise()) === RPCTypes.OnLoginStartupStatus.enabled
    if (enabled !== openAtLogin) await setOnLoginStartup(openAtLogin)
  } else {
    if (Electron.remote.app.getLoginItemSettings().openAtLogin !== openAtLogin) {
      logger.info(`Login item settings changed! now ${openAtLogin}`)
      Electron.remote.app.setLoginItemSettings({openAtLogin})
    }
  }
}

const setOnLoginStartup = async (enabled: boolean) => {
  RPCTypes.ctlSetOnLoginStartupRpcPromise({enabled}).catch(err => {
    logger.warn(`Error in sending ctlSetOnLoginStartup: ${err.message}`)
  })
}

export const requestLocationPermission = () => Promise.resolve()
export const requestAudioPermission = () => Promise.resolve()
export const clearWatchPosition = () => {}
export const watchPositionForMap = () => Promise.resolve(0)

function* checkNav(
  _state: Container.TypedState,
  action: ConfigGen.DaemonHandshakePayload,
  logger: Saga.SagaLogger
) {
  // have one
  if (_getNavigator()) {
    return
  }

  const name = 'desktopNav'
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
  yield* Saga.chainAction2(ConfigGen.setOpenAtLogin, setOpenAtLogin)
  yield* Saga.chainAction2(ConfigGen.setNotifySound, setNotifySound)
  yield* Saga.chainAction2(ConfigGen.showMain, showMainWindow)
  yield* Saga.chainAction(ConfigGen.dumpLogs, dumpLogs)
  getEngine().registerCustomResponse('keybase.1.logsend.prepareLogsend')
  yield* Saga.chainAction(EngineGen.keybase1LogsendPrepareLogsend, prepareLogSend)
  yield* Saga.chainAction2(EngineGen.connected, onConnected)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyAppExit, onExit)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSActivity, onFSActivity)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile, onPgpgKeySecret)
  yield* Saga.chainAction(EngineGen.keybase1NotifyServiceShutdown, onShutdown)
  yield* Saga.chainAction(EngineGen.keybase1NotifySessionClientOutOfDate, onOutOfDate)
  yield* Saga.chainAction(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainAction2(ConfigGen.updateNow, updateNow)
  yield* Saga.chainAction2(ConfigGen.checkForUpdate, checkForUpdate)
  yield* Saga.chainAction2(ConfigGen.daemonHandshakeWait, sendWindowsKBServiceCheck)
  yield* Saga.chainAction2(ConfigGen.setUseNativeFrame, saveUseNativeFrame)
  yield* Saga.chainAction2(ConfigGen.loggedIn, initOsNetworkStatus)
  yield* Saga.chainAction2(ConfigGen.updateWindowState, saveWindowState)

  if (isWindows) {
    yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, checkRPCOwnership)
  }
  yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, checkNav)

  yield Saga.spawn(initializeUseNativeFrame)
  yield Saga.spawn(initializeNotifySound)
  yield Saga.spawn(initializeOpenAtLogin)
  yield Saga.spawn(initializeInputMonitor)
  yield Saga.spawn(handleWindowFocusEvents)
  yield Saga.spawn(setupReachabilityWatcher)
  yield Saga.spawn(startOutOfDateCheckLoop)
  yield Saga.spawn(startPowerMonitor)
}
