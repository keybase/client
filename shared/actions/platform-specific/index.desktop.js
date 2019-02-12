// @flow
import * as ConfigGen from '../config-gen'
import * as ConfigConstants from '../../constants/config'
import * as GregorGen from '../gregor-gen'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as SafeElectron from '../../util/safe-electron.desktop'
import * as Saga from '../../util/saga'
import logger from '../../logger'
import path from 'path'
import {NotifyPopup} from '../../native/notifications'
import {execFile} from 'child_process'
import {getEngine} from '../../engine'
import {getMainWindow} from '../../desktop/remote/util.desktop'
import {isWindows, socketPath} from '../../constants/platform.desktop'
import {kbfsNotification} from '../../util/kbfs-notifications'
import {quit} from '../../util/quit-helper'
import {showDockIcon} from '../../desktop/app/dock-icon.desktop'
import {writeLogLinesToFile} from '../../util/forward-logs'
import InputMonitor from './input-monitor.desktop'
import {skipAppFocusActions} from '../../local-debug.desktop'

export function showShareActionSheetFromURL(options: {url?: ?any, message?: ?any}): void {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function showShareActionSheetFromFile(fileURL: string): Promise<void> {
  throw new Error('Show Share Action - unsupported on this platform')
}
export function saveAttachmentDialog(filePath: string): Promise<void> {
  throw new Error('Save Attachment - unsupported on this platform')
}
export async function saveAttachmentToCameraRoll(filePath: string, mimeType: string): Promise<void> {
  throw new Error('Save Attachment to camera roll - unsupported on this platform')
}

const showMainWindow = () => {
  const mw = getMainWindow()
  mw && mw.show()
  showDockIcon()
}

export function displayNewMessageNotification(
  text: string,
  convID: ?string,
  badgeCount: ?number,
  myMsgID: ?number,
  soundName: ?string
) {
  throw new Error('Display new message notification not available on this platform')
}

export function clearAllNotifications() {
  throw new Error('Clear all notifications not available on this platform')
}

export const getContentTypeFromURL = (
  url: string,
  cb: ({error?: any, statusCode?: number, contentType?: string, disposition?: string}) => void
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

const writeElectronSettingsOpenAtLogin = (_, action) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {openAtLogin: action.payload.open})

const writeElectronSettingsNotifySound = (_, action) =>
  action.payload.writeFile &&
  SafeElectron.getIpcRenderer().send('setAppState', {notifySound: action.payload.sound})

function* handleWindowFocusEvents(): Generator<any, void, any> {
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

function* initializeInputMonitor(): Generator<any, void, any> {
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
function* initializeAppSettingsState(): Generator<any, void, any> {
  const getAppState = () =>
    new Promise((resolve, reject) => {
      SafeElectron.getIpcRenderer().once('getAppStateReply', (event, data) => resolve(data))
      SafeElectron.getIpcRenderer().send('getAppState')
    })

  const state = yield* Saga.callPromise(getAppState)
  if (state) {
    yield Saga.put(ConfigGen.createSetOpenAtLogin({open: state.openAtLogin, writeFile: false}))
    yield Saga.put(ConfigGen.createSetNotifySound({sound: state.notifySound, writeFile: false}))
  }
}

export const dumpLogs = (_: any, action: ?ConfigGen.DumpLogsPayload) =>
  logger
    .dump()
    .then(fromRender => {
      // $ForceType
      const globalLogger: typeof logger = SafeElectron.getRemote().getGlobal('globalLogger')
      return globalLogger.dump().then(fromMain => writeLogLinesToFile([...fromRender, ...fromMain]))
    })
    .then(() => {
      // quit as soon as possible
      if (action && action.payload.reason === 'quitting through menu') {
        quit('quitButton')
      }
    })

function* checkRPCOwnership(_, action) {
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
          execFile(binPath, args, {windowsHide: true}, (error, stdout, stderr) => {
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

function* setupReachabilityWatcher() {
  const channel = Saga.eventChannel(emitter => {
    window.addEventListener('online', () => emitter('online'))
    window.addEventListener('offline', () => emitter('offline'))
    return () => {}
  }, Saga.buffers.dropping(1))
  while (true) {
    yield Saga.take(channel)
    yield Saga.put(GregorGen.createCheckReachability())
  }
}

const setupEngineListeners = () => {
  getEngine().setCustomResponseIncomingCallMap({
    'keybase.1.logsend.prepareLogsend': (_, response) => {
      dumpLogs().then(() => {
        response && response.result()
      })
    },
  })
  getEngine().setIncomingCallMap({
    'keybase.1.NotifyApp.exit': () => {
      console.log('App exit requested')
      SafeElectron.getApp().exit(0)
    },
    'keybase.1.NotifyFS.FSActivity': ({notification}) =>
      Saga.callUntyped(function*() {
        const state = yield* Saga.selectState()
        kbfsNotification(notification, NotifyPopup, state)
      }),
    'keybase.1.NotifyPGP.pgpKeyInSecretStoreFile': () => {
      RPCTypes.pgpPgpStorageDismissRpcPromise().catch(err => {
        console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
      })
    },
    'keybase.1.NotifyService.shutdown': request => {
      if (isWindows && request.code !== RPCTypes.ctlExitCode.restart) {
        console.log('Quitting due to service shutdown with code: ', request.code)
        // Quit just the app, not the service
        SafeElectron.getApp().quit()
      }
    },
    'keybase.1.NotifySession.clientOutOfDate': ({upgradeTo, upgradeURI, upgradeMsg}) => {
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      NotifyPopup('Client out of date!', {body}, 60 * 60)
      // This is from the API server. Consider notifications from API server
      // always critical.
      return Saga.put(ConfigGen.createUpdateInfo({critical: true, isOutOfDate: true, message: upgradeMsg}))
    },
  })
}

function* loadStartupDetails() {
  yield Saga.put(
    ConfigGen.createSetStartupDetails({
      startupConversation: null,
      startupFollowUser: '',
      startupLink: '',
      startupTab: null,
      startupWasFromPush: false,
    })
  )
}

const copyToClipboard = (_, action) => {
  SafeElectron.getClipboard().writeText(action.payload.text)
}

const sendKBServiceCheck = (state, action) => {
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
      critical: status === RPCTypes.configUpdateInfoStatus.criticallyOutOfDate,
      isOutOfDate: status !== RPCTypes.configUpdateInfoStatus.upToDate,
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

export function* platformConfigSaga(): Saga.SagaGenerator<any, any> {
  yield* Saga.chainAction<ConfigGen.SetOpenAtLoginPayload>(
    ConfigGen.setOpenAtLogin,
    writeElectronSettingsOpenAtLogin
  )
  yield* Saga.chainAction<ConfigGen.SetNotifySoundPayload>(
    ConfigGen.setNotifySound,
    writeElectronSettingsNotifySound
  )
  yield* Saga.chainAction<ConfigGen.ShowMainPayload>(ConfigGen.showMain, showMainWindow)
  yield* Saga.chainAction<ConfigGen.DumpLogsPayload>(ConfigGen.dumpLogs, dumpLogs)
  yield* Saga.chainGenerator<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupReachabilityWatcher
  )
  yield* Saga.chainAction<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    setupEngineListeners
  )
  yield* Saga.chainGenerator<ConfigGen.SetupEngineListenersPayload>(
    ConfigGen.setupEngineListeners,
    startOutOfDateCheckLoop
  )
  yield* Saga.chainAction<ConfigGen.CopyToClipboardPayload>(ConfigGen.copyToClipboard, copyToClipboard)
  yield* Saga.chainAction<ConfigGen.UpdateNowPayload>(ConfigGen.updateNow, updateNow)
  yield* Saga.chainAction<ConfigGen.CheckForUpdatePayload>(ConfigGen.checkForUpdate, checkForUpdate)
  yield* Saga.chainAction<ConfigGen.DaemonHandshakeWaitPayload>(
    ConfigGen.daemonHandshakeWait,
    sendKBServiceCheck
  )

  if (isWindows) {
    yield* Saga.chainGenerator<ConfigGen.DaemonHandshakePayload>(ConfigGen.daemonHandshake, checkRPCOwnership)
  }

  yield Saga.spawn(initializeInputMonitor)
  yield Saga.spawn(handleWindowFocusEvents)
  yield Saga.spawn(initializeAppSettingsState)
  // Start this immediately
  yield Saga.spawn(loadStartupDetails)
}
