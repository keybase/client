import * as ConfigGen from '../config-gen'
import * as SettingsGen from '../settings-gen'
import * as ConfigConstants from '../../constants/config'
import * as EngineGen from '../engine-gen-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Saga from '../../util/saga'
import logger from '../../logger'
import path from 'path'
import {NotifyPopup} from '../../native/notifications'
import {execFile} from 'child_process'
import {getEngine} from '../../engine'
import {getMainWindow} from '../../desktop/remote/util.desktop'
import {isWindows, socketPath, defaultUseNativeFrame} from '../../constants/platform.desktop'
import {kbfsNotification} from '../../util/kbfs-notifications'
import {quit} from '../../util/quit-helper'
import {showDockIcon} from '../../desktop/app/dock-icon.desktop'
import {writeLogLinesToFile} from '../../util/forward-logs'
import InputMonitor from './input-monitor.desktop'
import {skipAppFocusActions} from '../../local-debug.desktop'
import * as Container from '../../util/container'
import AppState from '../../app/app-state.desktop'

export function showShareActionSheetFromURL() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function showShareActionSheetFromFile() {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function saveAttachmentDialog() {
  throw new Error('Save Attachment - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll() {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

const showMainWindow = () => {
  const mw = getMainWindow()
  mw && mw.show()
  showDockIcon()
}

export function displayNewMessageNotification() {
  throw new Error('Display new message notification not available on this platform')
}

export function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

export const getContentTypeFromURL = (
  url: string,
  cb: (arg0: {error?: any; statusCode?: number; contentType?: string; disposition?: string}) => void
) => {
  const req = SafeElectron.getRemote().net.request({method: 'HEAD', url})
  req.on('response', response => {
    let contentType = ''
    let disposition = ''
    if (response.statusCode === 200) {
      const contentTypeHeader = response.headers['content-type']
      contentType = Array.isArray(contentTypeHeader) && contentTypeHeader.length ? contentTypeHeader[0] : ''
      const dispositionHeader = response.headers['content-disposition']
      disposition = Array.isArray(dispositionHeader) && dispositionHeader.length ? dispositionHeader[0] : ''
    }
    cb({contentType, disposition, statusCode: response.statusCode})
  })
  req.on('error', error => cb({error}))
  req.end()
}

const writeElectronSettingsOpenAtLogin = (_: Container.TypedState, action: ConfigGen.SetOpenAtLoginPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {openAtLogin: action.payload.open})

const writeElectronSettingsNotifySound = (_: Container.TypedState, action: ConfigGen.SetNotifySoundPayload) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {notifySound: action.payload.sound})

function* handleWindowFocusEvents(): Iterable<any> {
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
  const channel = Saga.eventChannel(emitter => {
    // eslint-disable-next-line no-new
    new InputMonitor(isActive => emitter(isActive ? 'active' : 'inactive'))
    return () => {}
  }, Saga.buffers.expanding(1))

  while (true) {
    const type = yield Saga.take(channel)
    if (skipAppFocusActions) {
      console.log('Skipping app focus actions!')
    } else {
      yield Saga.put(ConfigGen.createChangedActive({userActive: type === 'active'}))
    }
  }
}

// get this value from electron and update our store version
function* initializeAppSettingsState(): Iterable<any> {
  const getAppState = () =>
    new Promise(resolve => {
      SafeElectron.getIpcRenderer().once('getAppStateReply', (_, data) => resolve(data))
      SafeElectron.getIpcRenderer().send('getAppState')
    })

  const state = yield* Saga.callPromise(getAppState)
  if (state) {
    yield Saga.put(ConfigGen.createSetOpenAtLogin({open: state.openAtLogin, writeFile: false}))
    yield Saga.put(ConfigGen.createSetNotifySound({sound: state.notifySound, writeFile: false}))
  }
}

export const dumpLogs = (_?: Container.TypedState, action?: ConfigGen.DumpLogsPayload) =>
  logger
    .dump()
    .then(fromRender => {
      const globalLogger: typeof logger = SafeElectron.getRemote().getGlobal('globalLogger')
      return globalLogger.dump().then(fromMain => writeLogLinesToFile([...fromRender, ...fromMain]))
    })
    .then(() => {
      // quit as soon as possible
      if (action && action.payload.reason === 'quitting through menu') {
        quit('quitButton')
      }
    })

function* checkRPCOwnership(_: Container.TypedState, action: ConfigGen.DaemonHandshakePayload) {
  const waitKey = 'pipeCheckFail'
  yield Saga.put(
    ConfigGen.createDaemonHandshakeWait({increment: true, name: waitKey, version: action.payload.version})
  )
  try {
    logger.info('Checking RPC ownership')

    const localAppData = String(process.env.LOCALAPPDATA)
    var binPath = localAppData ? path.resolve(localAppData, 'Keybase', 'keybase.exe') : 'keybase.exe'
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
  SafeElectron.getApp().exit(0)
}

const onFSActivity = (state: Container.TypedState, action: EngineGen.Keybase1NotifyFSFSActivityPayload) => {
  kbfsNotification(action.payload.params.notification, NotifyPopup, state)
}

const onPgpgKeySecret = () =>
  RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
    console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
  })

const onShutdown = (_: Container.TypedState, action: EngineGen.Keybase1NotifyServiceShutdownPayload) => {
  const {code} = action.payload.params
  if (isWindows && code !== RPCTypes.ExitCode.restart) {
    console.log('Quitting due to service shutdown with code: ', code)
    // Quit just the app, not the service
    SafeElectron.getApp().quit()
  }
}

const onConnected = () => {
  // Introduce ourselves to the service
  RPCTypes.configHelloIAmRpcPromise({
    details: {
      argv: process.argv,
      clientType: RPCTypes.ClientType.guiMain,
      desc: 'Main Renderer',
      pid: SafeElectron.getRemote().process.pid,
      version: __VERSION__, // eslint-disable-line no-undef
    },
  }).catch(_ => {})
}

const onOutOfDate = (
  _: Container.TypedState,
  action: EngineGen.Keybase1NotifySessionClientOutOfDatePayload
) => {
  const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
  const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
  NotifyPopup('Client out of date!', {body}, 60 * 60)
  // This is from the API server. Consider notifications from API server
  // always critical.
  return ConfigGen.createUpdateInfo({critical: true, isOutOfDate: true, message: upgradeMsg})
}

const prepareLogSend = (_: Container.TypedState, action: EngineGen.Keybase1LogsendPrepareLogsendPayload) => {
  const response = action.payload.response
  dumpLogs().then(() => {
    response && response.result()
  })
}

const copyToClipboard = (_: Container.TypedState, action: ConfigGen.CopyToClipboardPayload) => {
  SafeElectron.getClipboard().writeText(action.payload.text)
}

const sendKBServiceCheck = (state: Container.TypedState, action: ConfigGen.DaemonHandshakeWaitPayload) => {
  if (
    action.payload.version === state.config.daemonHandshakeVersion &&
    state.config.daemonHandshakeWaiters.size === 0 &&
    state.config.daemonHandshakeFailedReason === ConfigConstants.noKBFSFailReason
  ) {
    SafeElectron.getIpcRenderer().send('kb-service-check')
  }
}

function* startOutOfDateCheckLoop() {
  while (1) {
    try {
      const toPut = yield* Saga.callPromise(checkForUpdate)
      yield Saga.put(toPut)
      yield Saga.delay(3600 * 1000) // 1 hr
    } catch (err) {
      logger.warn('error getting update info: ', err)
      yield Saga.delay(3600 * 1000) // 1 hr
    }
  }
}

const checkForUpdate = () =>
  RPCTypes.configGetUpdateInfoRpcPromise().then(({status, message}) =>
    ConfigGen.createUpdateInfo({
      critical: status === RPCTypes.UpdateInfoStatus.criticallyOutOfDate,
      isOutOfDate: status !== RPCTypes.UpdateInfoStatus.upToDate,
      message,
    })
  )

const updateNow = () =>
  RPCTypes.configStartUpdateIfNeededRpcPromise().then(() =>
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
    ConfigGen.createCheckForUpdate()
  )

function* startPowerMonitor() {
  const channel = Saga.eventChannel(emitter => {
    const pm = SafeElectron.getPowerMonitor()
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

const setUseNativeFrame = (state: Container.TypedState) =>
  SafeElectron.getIpcRenderer().send('setAppState', {useNativeFrame: state.settings.useNativeFrame})

function* initializeUseNativeFrame() {
  const useNativeFrame = new AppState().state.useNativeFrame
  yield Saga.put(
    SettingsGen.createOnChangeUseNativeFrame({
      enabled:
        useNativeFrame !== null && useNativeFrame !== undefined ? useNativeFrame : defaultUseNativeFrame,
    })
  )
}

export function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction2(ConfigGen.setOpenAtLogin, writeElectronSettingsOpenAtLogin)
  yield* Saga.chainAction2(ConfigGen.setNotifySound, writeElectronSettingsNotifySound)
  yield* Saga.chainAction2(ConfigGen.showMain, showMainWindow)
  yield* Saga.chainAction2(ConfigGen.dumpLogs, dumpLogs)
  getEngine().registerCustomResponse('keybase.1.logsend.prepareLogsend')
  yield* Saga.chainAction2(EngineGen.keybase1LogsendPrepareLogsend, prepareLogSend)
  yield* Saga.chainAction2(EngineGen.connected, onConnected)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyAppExit, onExit)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyFSFSActivity, onFSActivity)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile, onPgpgKeySecret)
  yield* Saga.chainAction2(EngineGen.keybase1NotifyServiceShutdown, onShutdown)
  yield* Saga.chainAction2(EngineGen.keybase1NotifySessionClientOutOfDate, onOutOfDate)
  yield* Saga.chainAction2(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainAction2(ConfigGen.updateNow, updateNow)
  yield* Saga.chainAction2(ConfigGen.checkForUpdate, checkForUpdate)
  yield* Saga.chainAction2(ConfigGen.daemonHandshakeWait, sendKBServiceCheck)
  yield* Saga.chainAction2(SettingsGen.onChangeUseNativeFrame, setUseNativeFrame)
  yield* Saga.chainAction2(ConfigGen.loggedIn, initOsNetworkStatus)

  if (isWindows) {
    yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, checkRPCOwnership)
  }

  yield Saga.spawn(initializeUseNativeFrame)
  yield Saga.spawn(initializeInputMonitor)
  yield Saga.spawn(handleWindowFocusEvents)
  yield Saga.spawn(initializeAppSettingsState)
  yield Saga.spawn(setupReachabilityWatcher)
  yield Saga.spawn(startOutOfDateCheckLoop)
  yield Saga.spawn(startPowerMonitor)
}
